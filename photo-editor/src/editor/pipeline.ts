// WebGL2 multi-pass render pipeline.
//   BASE → FBO            global light (M1) + color grade (M3)
//   LOCAL → FBO (per adj) masked local adjustments, chained (ping-pong FBOs)
//   COMPOSITE → screen    background matte composite (M4)
//
// render(recipe) re-applies the whole non-destructive recipe each frame.

import { Recipe } from "./recipe";
import { LocalAdjustment } from "./masks";
import { BLEND_INDEX } from "./layers";
import { ImageMask, LayerImage } from "../store/editorStore";
import { BASE_FRAG, COMPOSITE_FRAG, DETAIL_FRAG, HEAL_FRAG, LAYER_FRAG, LOCAL_FRAG, VERT_SRC } from "./shaders";
import { evalCurve } from "./color/curve";
import { wheelTint } from "./color/wheels";
import { CubeLut } from "./color/lut";
import { ChannelCurves, hueSatToRGB } from "./color/look";

const norm = (v: number) => v / 100;

const BASE_UNIFORMS = [
  "u_image", "u_exposure", "u_contrast", "u_highlights", "u_shadows", "u_whites",
  "u_blacks", "u_temp", "u_tint", "u_saturation", "u_vibrance",
  "u_curve", "u_curveOn", "u_hsl", "u_hslOn",
  "u_lift", "u_gain", "u_gammaExp", "u_gmul", "u_wheelsOn",
  "u_splitSh", "u_splitHi", "u_splitBalance", "u_splitOn",
  "u_lut3d", "u_lut3dOn", "u_lutSize", "u_lutDomainMin", "u_lutDomainMax",
];
const LOCAL_UNIFORMS = [
  "u_src", "u_aiMask", "u_maskKind", "u_invert", "u_linear", "u_radial",
  "u_radial2", "u_range", "u_lExposure", "u_lContrast", "u_lTemp", "u_lTint", "u_lSat",
];
const DETAIL_UNIFORMS = ["u_src", "u_texel", "u_clarity", "u_sharpen", "u_nr"];
const HEAL_UNIFORMS = ["u_src", "u_dst", "u_srcpos", "u_radius", "u_feather", "u_aspect", "u_mode"];
const LAYER_UNIFORMS = ["u_src", "u_layer", "u_blend", "u_opacity"];
const COMPOSITE_UNIFORMS = ["u_src", "u_mask", "u_maskOn", "u_bgMode", "u_bgColor"];

const MASK_KIND_INDEX: Record<LocalAdjustment["mask"]["kind"], number> = {
  linear: 0,
  radial: 1,
  rangeLuma: 2,
  aiSubject: 3,
};

type UMap = Record<string, WebGLUniformLocation | null>;

export class RenderPipeline {
  private gl: WebGL2RenderingContext;
  private base: WebGLProgram;
  private detail: WebGLProgram;
  private heal: WebGLProgram;
  private local: WebGLProgram;
  private layer: WebGLProgram;
  private composite: WebGLProgram;
  private baseU: UMap = {};
  private detailU: UMap = {};
  private healU: UMap = {};
  private localU: UMap = {};
  private layerU: UMap = {};
  private compU: UMap = {};
  private layerTextures = new Map<string, WebGLTexture>();

  private texture: WebGLTexture | null = null;
  private curveTex: WebGLTexture | null = null;
  private lut3dTex: WebGLTexture | null = null;
  private dummy3d: WebGLTexture | null = null;
  private maskTex: WebGLTexture | null = null;

  private fbo: [WebGLFramebuffer | null, WebGLFramebuffer | null] = [null, null];
  private fboTex: [WebGLTexture | null, WebGLTexture | null] = [null, null];
  private fboW = 0;
  private fboH = 0;

  private lastCurves: ChannelCurves | null = null;
  private lastLut: CubeLut | null = null;
  imageWidth = 0;
  imageHeight = 0;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: false });
    if (!gl) throw new Error("WebGL2 not supported on this device");
    this.gl = gl;
    this.base = this.program(BASE_FRAG);
    this.detail = this.program(DETAIL_FRAG);
    this.heal = this.program(HEAL_FRAG);
    this.local = this.program(LOCAL_FRAG);
    this.layer = this.program(LAYER_FRAG);
    this.composite = this.program(COMPOSITE_FRAG);
    this.baseU = this.locs(this.base, BASE_UNIFORMS);
    this.detailU = this.locs(this.detail, DETAIL_UNIFORMS);
    this.healU = this.locs(this.heal, HEAL_UNIFORMS);
    this.localU = this.locs(this.local, LOCAL_UNIFORMS);
    this.layerU = this.locs(this.layer, LAYER_UNIFORMS);
    this.compU = this.locs(this.composite, COMPOSITE_UNIFORMS);
  }

  // Upload/refresh layer image textures; drop textures for removed layers.
  setLayers(layers: LayerImage[]) {
    const gl = this.gl;
    const keep = new Set(layers.map((l) => l.id));
    for (const [id, tex] of this.layerTextures) {
      if (!keep.has(id)) {
        gl.deleteTexture(tex);
        this.layerTextures.delete(id);
      }
    }
    for (const l of layers) {
      if (this.layerTextures.has(l.id)) continue;
      gl.activeTexture(gl.TEXTURE7);
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, l.bitmap);
      this.layerTextures.set(l.id, tex);
    }
  }

  private compile(type: number, src: string): WebGLShader {
    const gl = this.gl;
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      throw new Error("Shader compile error: " + log);
    }
    return sh;
  }

  private program(frag: string): WebGLProgram {
    const gl = this.gl;
    const vs = this.compile(gl.VERTEX_SHADER, VERT_SRC);
    const fs = this.compile(gl.FRAGMENT_SHADER, frag);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error("Program link error: " + gl.getProgramInfoLog(prog));
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return prog;
  }

  private locs(prog: WebGLProgram, names: string[]): UMap {
    const gl = this.gl;
    const m: UMap = {};
    for (const n of names) m[n] = gl.getUniformLocation(prog, n);
    return m;
  }

  setImage(source: TexImageSource, width: number, height: number) {
    const gl = this.gl;
    if (this.texture) gl.deleteTexture(this.texture);
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    this.imageWidth = width;
    this.imageHeight = height;
  }

  hasImage(): boolean {
    return this.texture !== null;
  }

  setMask(mask: ImageMask | null) {
    const gl = this.gl;
    if (this.maskTex) {
      gl.deleteTexture(this.maskTex);
      this.maskTex = null;
    }
    if (!mask) return;
    gl.activeTexture(gl.TEXTURE7);
    this.maskTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.maskTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, mask.width, mask.height, 0, gl.RED, gl.UNSIGNED_BYTE, mask.data);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  }

  private ensureFbos(w: number, h: number) {
    if (this.fboW === w && this.fboH === h && this.fbo[0]) return;
    const gl = this.gl;
    for (let i = 0; i < 2; i++) {
      if (this.fboTex[i]) gl.deleteTexture(this.fboTex[i]);
      if (this.fbo[i]) gl.deleteFramebuffer(this.fbo[i]);
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        throw new Error(`Render target ${w}×${h} incomplete (image too large for this GPU)`);
      }
      this.fboTex[i] = tex;
      this.fbo[i] = fb;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.fboW = w;
    this.fboH = h;
  }

  // --- texture builders (curve LUT + 3D LUT + dummy) ---

  private buildCurveTexture(curves: ChannelCurves) {
    const gl = this.gl;
    const N = 256;
    const data = new Uint8Array(N * 4);
    for (let i = 0; i < N; i++) {
      const m = evalCurve(curves.rgb, i / (N - 1));
      data[i * 4 + 0] = Math.round(evalCurve(curves.r, m) * 255);
      data[i * 4 + 1] = Math.round(evalCurve(curves.g, m) * 255);
      data[i * 4 + 2] = Math.round(evalCurve(curves.b, m) * 255);
      data[i * 4 + 3] = 255;
    }
    gl.activeTexture(gl.TEXTURE7); // scratch upload unit — never aliases sampler units
    if (!this.curveTex) this.curveTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.curveTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  }

  private buildLut3DTexture(lut: CubeLut) {
    const gl = this.gl;
    const s = lut.size;
    const data = new Uint8Array(s * s * s * 4);
    for (let i = 0; i < s * s * s; i++) {
      data[i * 4 + 0] = Math.round(Math.min(1, Math.max(0, lut.data[i * 3 + 0])) * 255);
      data[i * 4 + 1] = Math.round(Math.min(1, Math.max(0, lut.data[i * 3 + 1])) * 255);
      data[i * 4 + 2] = Math.round(Math.min(1, Math.max(0, lut.data[i * 3 + 2])) * 255);
      data[i * 4 + 3] = 255;
    }
    gl.activeTexture(gl.TEXTURE7);
    if (!this.lut3dTex) this.lut3dTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, this.lut3dTex);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA, s, s, s, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  }

  private ensureDummy3D() {
    if (this.dummy3d) return;
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE7);
    this.dummy3d = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, this.dummy3d);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA, 1, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 255]));
  }

  // --- per-program uniform setup ---

  private setBaseUniforms(recipe: Recipe) {
    const gl = this.gl;
    const u = this.baseU;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(u.u_image, 0);

    gl.uniform1f(u.u_exposure, recipe.exposure);
    gl.uniform1f(u.u_contrast, norm(recipe.contrast));
    gl.uniform1f(u.u_highlights, norm(recipe.highlights));
    gl.uniform1f(u.u_shadows, norm(recipe.shadows));
    gl.uniform1f(u.u_whites, norm(recipe.whites));
    gl.uniform1f(u.u_blacks, norm(recipe.blacks));
    gl.uniform1f(u.u_temp, norm(recipe.temp));
    gl.uniform1f(u.u_tint, norm(recipe.tint));
    gl.uniform1f(u.u_saturation, norm(recipe.saturation));
    gl.uniform1f(u.u_vibrance, norm(recipe.vibrance));

    const look = recipe.look;
    const curvesOn = [look.curves.rgb, look.curves.r, look.curves.g, look.curves.b].some(
      (p) => p.length >= 2
    );
    if (curvesOn && look.curves !== this.lastCurves) {
      this.buildCurveTexture(look.curves);
      this.lastCurves = look.curves;
    }
    gl.uniform1i(u.u_curveOn, curvesOn ? 1 : 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.curveTex);
    gl.uniform1i(u.u_curve, 1);

    const hslArr = new Float32Array(8 * 3);
    let hslOn = false;
    look.hsl.forEach((b, i) => {
      hslArr[i * 3] = b.h;
      hslArr[i * 3 + 1] = b.s;
      hslArr[i * 3 + 2] = b.l;
      if (b.h || b.s || b.l) hslOn = true;
    });
    gl.uniform3fv(u.u_hsl, hslArr);
    gl.uniform1i(u.u_hslOn, hslOn ? 1 : 0);

    const w = look.wheels;
    const tSh = wheelTint(w.shadows), tMid = wheelTint(w.midtones);
    const tHi = wheelTint(w.highlights), tG = wheelTint(w.global);
    const lift = [0, 1, 2].map((c) => w.shadows.l * 0.5 + tSh[c]);
    const gain = [0, 1, 2].map((c) => 1 + w.highlights.l + tHi[c]);
    const gammaExp = [0, 1, 2].map((c) => 1 / Math.min(10, Math.max(0.1, 1 + w.midtones.l + tMid[c])));
    const gmul = [0, 1, 2].map((c) => 1 + w.global.l + tG[c]);
    gl.uniform3f(u.u_lift, lift[0], lift[1], lift[2]);
    gl.uniform3f(u.u_gain, gain[0], gain[1], gain[2]);
    gl.uniform3f(u.u_gammaExp, gammaExp[0], gammaExp[1], gammaExp[2]);
    gl.uniform3f(u.u_gmul, gmul[0], gmul[1], gmul[2]);
    gl.uniform1i(u.u_wheelsOn, [w.shadows, w.midtones, w.highlights, w.global].some((x) => x.h || x.s || x.l) ? 1 : 0);

    const s = look.split;
    const sh = hueSatToRGB(s.shadowHue, s.shadowSat);
    const hi = hueSatToRGB(s.highlightHue, s.highlightSat);
    gl.uniform3f(u.u_splitSh, sh[0], sh[1], sh[2]);
    gl.uniform3f(u.u_splitHi, hi[0], hi[1], hi[2]);
    gl.uniform1f(u.u_splitBalance, s.balance);
    gl.uniform1i(u.u_splitOn, s.shadowSat || s.highlightSat ? 1 : 0);

    this.ensureDummy3D();
    gl.activeTexture(gl.TEXTURE2);
    if (recipe.lut) {
      if (recipe.lut !== this.lastLut) {
        this.buildLut3DTexture(recipe.lut);
        this.lastLut = recipe.lut;
      }
      gl.bindTexture(gl.TEXTURE_3D, this.lut3dTex);
      gl.uniform1f(u.u_lutSize, recipe.lut.size);
      gl.uniform3f(u.u_lutDomainMin, recipe.lut.domainMin[0], recipe.lut.domainMin[1], recipe.lut.domainMin[2]);
      gl.uniform3f(u.u_lutDomainMax, recipe.lut.domainMax[0], recipe.lut.domainMax[1], recipe.lut.domainMax[2]);
      gl.uniform1i(u.u_lut3dOn, 1);
    } else {
      gl.bindTexture(gl.TEXTURE_3D, this.dummy3d);
      gl.uniform1f(u.u_lutSize, 2);
      gl.uniform3f(u.u_lutDomainMin, 0, 0, 0);
      gl.uniform3f(u.u_lutDomainMax, 1, 1, 1);
      gl.uniform1i(u.u_lut3dOn, 0);
    }
    gl.uniform1i(u.u_lut3d, 2);
  }

  private setLocalUniforms(la: LocalAdjustment) {
    const gl = this.gl;
    const u = this.localU;
    const m = la.mask;
    gl.uniform1i(u.u_maskKind, MASK_KIND_INDEX[m.kind]);
    gl.uniform1i(u.u_invert, m.invert ? 1 : 0);
    gl.uniform4f(u.u_linear, m.linear.x1, m.linear.y1, m.linear.x2, m.linear.y2);
    gl.uniform4f(u.u_radial, m.radial.cx, m.radial.cy, m.radial.rx, m.radial.ry);
    gl.uniform2f(u.u_radial2, m.radial.angle, m.radial.feather);
    gl.uniform3f(u.u_range, m.range.lo, m.range.hi, m.range.feather);
    const p = la.params;
    gl.uniform1f(u.u_lExposure, p.exposure / 100); // ±1 EV
    gl.uniform1f(u.u_lContrast, norm(p.contrast));
    gl.uniform1f(u.u_lTemp, norm(p.temp));
    gl.uniform1f(u.u_lTint, norm(p.tint));
    gl.uniform1f(u.u_lSat, norm(p.saturation));
  }

  render(recipe: Recipe) {
    const gl = this.gl;
    if (!this.texture) return;
    const canvas = gl.canvas as HTMLCanvasElement;
    const w = canvas.width;
    const h = canvas.height;
    this.ensureFbos(w, h);

    // BASE → fbo[0]
    gl.useProgram(this.base);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo[0]);
    gl.viewport(0, 0, w, h);
    this.setBaseUniforms(recipe);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    let cur = 0;

    // DETAIL pass (clarity + sharpening + noise reduction) — only if any are active.
    // `|| 0` guards against a legacy recipe missing these fields (NaN → black).
    const clarity = recipe.clarity || 0;
    const sharpening = recipe.sharpening || 0;
    const noiseReduction = recipe.noiseReduction || 0;
    if (clarity !== 0 || sharpening !== 0 || noiseReduction !== 0) {
      const dst = 1 - cur;
      gl.useProgram(this.detail);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo[dst]);
      gl.viewport(0, 0, w, h);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.fboTex[cur]);
      gl.uniform1i(this.detailU.u_src, 0);
      gl.uniform2f(this.detailU.u_texel, 1 / w, 1 / h);
      gl.uniform1f(this.detailU.u_clarity, (clarity / 100) * 0.5);
      gl.uniform1f(this.detailU.u_sharpen, (sharpening / 100) * 1.5);
      gl.uniform1f(this.detailU.u_nr, (noiseReduction / 100) * 0.9);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      cur = dst;
    }

    // HEAL passes → spot clone/heal (each samples the prior accumulator).
    const spots = recipe.spots ?? [];
    if (spots.length) {
      gl.useProgram(this.heal);
      const aspect = this.imageHeight ? this.imageWidth / this.imageHeight : 1;
      for (const sp of spots) {
        const dst = 1 - cur;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo[dst]);
        gl.viewport(0, 0, w, h);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.fboTex[cur]);
        gl.uniform1i(this.healU.u_src, 0);
        gl.uniform2f(this.healU.u_dst, sp.dx, sp.dy);
        gl.uniform2f(this.healU.u_srcpos, sp.sx, sp.sy);
        gl.uniform1f(this.healU.u_radius, sp.radius);
        gl.uniform1f(this.healU.u_feather, sp.feather);
        gl.uniform1f(this.healU.u_aspect, aspect);
        gl.uniform1i(this.healU.u_mode, sp.mode === "clone" ? 1 : 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        cur = dst;
      }
    }

    // LOCAL passes → ping-pong. Skip AI-subject masks with no matte loaded (an
    // inverted no-matte subject mask would otherwise select the whole image).
    const locals = (recipe.localAdjustments ?? []).filter(
      (l) => l.visible && (l.mask.kind !== "aiSubject" || this.maskTex !== null)
    );
    if (locals.length) {
      gl.useProgram(this.local);
      for (const la of locals) {
        const dst = 1 - cur;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo[dst]);
        gl.viewport(0, 0, w, h);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.fboTex[cur]);
        gl.uniform1i(this.localU.u_src, 0);
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, this.maskTex);
        gl.uniform1i(this.localU.u_aiMask, 3);
        this.setLocalUniforms(la);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        cur = dst;
      }
    }

    // LAYER passes → composite each image layer (bottom → top)
    const stack = (recipe.layerStack ?? []).filter(
      (p) => p.visible && this.layerTextures.has(p.id)
    );
    if (stack.length) {
      gl.useProgram(this.layer);
      for (const p of stack) {
        const dst = 1 - cur;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo[dst]);
        gl.viewport(0, 0, w, h);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.fboTex[cur]);
        gl.uniform1i(this.layerU.u_src, 0);
        gl.activeTexture(gl.TEXTURE4);
        gl.bindTexture(gl.TEXTURE_2D, this.layerTextures.get(p.id)!);
        gl.uniform1i(this.layerU.u_layer, 4);
        gl.uniform1i(this.layerU.u_blend, BLEND_INDEX[p.blend]);
        gl.uniform1f(this.layerU.u_opacity, p.opacity);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        cur = dst;
      }
    }

    // COMPOSITE → screen
    gl.useProgram(this.composite);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.fboTex[cur]);
    gl.uniform1i(this.compU.u_src, 0);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.maskTex);
    gl.uniform1i(this.compU.u_mask, 3);
    const mode = recipe.bg.mode;
    gl.uniform1i(this.compU.u_maskOn, this.maskTex !== null && mode !== "none" ? 1 : 0);
    gl.uniform1i(this.compU.u_bgMode, mode === "transparent" ? 1 : mode === "color" ? 2 : 0);
    gl.uniform3f(this.compU.u_bgColor, recipe.bg.color[0], recipe.bg.color[1], recipe.bg.color[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  readPixels(): { data: Uint8Array; width: number; height: number } {
    const gl = this.gl;
    const canvas = gl.canvas as HTMLCanvasElement;
    const w = canvas.width;
    const h = canvas.height;
    const data = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, data);
    return { data, width: w, height: h };
  }

  dispose() {
    const gl = this.gl;
    if (this.texture) gl.deleteTexture(this.texture);
    if (this.curveTex) gl.deleteTexture(this.curveTex);
    if (this.lut3dTex) gl.deleteTexture(this.lut3dTex);
    if (this.dummy3d) gl.deleteTexture(this.dummy3d);
    if (this.maskTex) gl.deleteTexture(this.maskTex);
    for (let i = 0; i < 2; i++) {
      if (this.fboTex[i]) gl.deleteTexture(this.fboTex[i]);
      if (this.fbo[i]) gl.deleteFramebuffer(this.fbo[i]);
    }
    for (const tex of this.layerTextures.values()) gl.deleteTexture(tex);
    this.layerTextures.clear();
    gl.deleteProgram(this.base);
    gl.deleteProgram(this.detail);
    gl.deleteProgram(this.heal);
    gl.deleteProgram(this.local);
    gl.deleteProgram(this.layer);
    gl.deleteProgram(this.composite);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}

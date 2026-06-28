// WebGL2 render pipeline. Owns the GL context, shader program, source texture, and
// the M3 lookup textures (1D tone-curve + 3D .cube LUT). `render(recipe)` re-applies
// the whole non-destructive recipe each frame — a single fullscreen GPU pass.

import { Recipe } from "./recipe";
import { FRAG_SRC, VERT_SRC } from "./shaders";
import { evalCurve } from "./color/curve";
import { wheelTint } from "./color/wheels";
import { CubeLut } from "./color/lut";
import { ChannelCurves, hueSatToRGB, Look } from "./color/look";

const norm = (v: number) => v / 100;

const UNIFORMS = [
  "u_image",
  "u_exposure", "u_contrast", "u_highlights", "u_shadows", "u_whites", "u_blacks",
  "u_temp", "u_tint", "u_saturation", "u_vibrance",
  "u_curve", "u_curveOn",
  "u_hsl", "u_hslOn",
  "u_lift", "u_gain", "u_gammaExp", "u_gmul", "u_wheelsOn",
  "u_splitSh", "u_splitHi", "u_splitBalance", "u_splitOn",
  "u_lut3d", "u_lut3dOn", "u_lutSize", "u_lutDomainMin", "u_lutDomainMax",
] as const;

export class RenderPipeline {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private texture: WebGLTexture | null = null;
  private curveTex: WebGLTexture | null = null;
  private lut3dTex: WebGLTexture | null = null;
  private dummy3d: WebGLTexture | null = null; // bound to unit 2 when no LUT is active
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  // Caches so we only rebuild lookup textures when their source changes.
  private lastCurves: ChannelCurves | null = null;
  private lastLut: CubeLut | null = null;
  imageWidth = 0;
  imageHeight = 0;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: false });
    if (!gl) throw new Error("WebGL2 not supported on this device");
    this.gl = gl;
    this.program = this.buildProgram();
    gl.useProgram(this.program);
    for (const name of UNIFORMS) {
      this.uniforms[name] = gl.getUniformLocation(this.program, name);
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

  private buildProgram(): WebGLProgram {
    const gl = this.gl;
    const vs = this.compile(gl.VERTEX_SHADER, VERT_SRC);
    const fs = this.compile(gl.FRAGMENT_SHADER, FRAG_SRC);
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

  // --- M3 lookup-texture builders -------------------------------------------

  // 256x1 RGBA texture: per-channel combined map (master curve then channel curve).
  private buildCurveTexture(curves: ChannelCurves) {
    const gl = this.gl;
    const N = 256;
    const data = new Uint8Array(N * 4);
    for (let i = 0; i < N; i++) {
      const x = i / (N - 1);
      const m = evalCurve(curves.rgb, x); // master first
      data[i * 4 + 0] = Math.round(evalCurve(curves.r, m) * 255);
      data[i * 4 + 1] = Math.round(evalCurve(curves.g, m) * 255);
      data[i * 4 + 2] = Math.round(evalCurve(curves.b, m) * 255);
      data[i * 4 + 3] = 255;
    }
    if (!this.curveTex) this.curveTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.curveTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  }

  // size^3 RGBA 3D texture from a .cube LUT (data is r-fastest, then g, then b).
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
    if (!this.lut3dTex) this.lut3dTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, this.lut3dTex);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA, s, s, s, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  }

  // --- M3 enable flags / coefficient prep -----------------------------------

  private curvesActive(curves: ChannelCurves): boolean {
    return [curves.rgb, curves.r, curves.g, curves.b].some((p) => p.length >= 2);
  }

  private setLookUniforms(look: Look) {
    const gl = this.gl;
    const u = this.uniforms;

    // Tone curves (rebuild texture only when the curve set changed).
    const curvesOn = this.curvesActive(look.curves);
    if (curvesOn && look.curves !== this.lastCurves) {
      this.buildCurveTexture(look.curves);
      this.lastCurves = look.curves;
    }
    gl.uniform1i(u.u_curveOn, curvesOn ? 1 : 0);
    // Always point u_curve at unit 1 (same sampler type as u_image, so even an empty
    // bind is harmless); the GLSL u_curveOn flag gates actual use.
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.curveTex);
    gl.uniform1i(u.u_curve, 1);

    // HSL bands (8 × vec3).
    const hslArr = new Float32Array(8 * 3);
    let hslOn = false;
    look.hsl.forEach((b, i) => {
      hslArr[i * 3 + 0] = b.h;
      hslArr[i * 3 + 1] = b.s;
      hslArr[i * 3 + 2] = b.l;
      if (b.h || b.s || b.l) hslOn = true;
    });
    gl.uniform3fv(u.u_hsl, hslArr);
    gl.uniform1i(u.u_hslOn, hslOn ? 1 : 0);

    // Color wheels → lift / gain / gammaExp / gmul (matches wheels.ts CPU math).
    const w = look.wheels;
    const tSh = wheelTint(w.shadows), tMid = wheelTint(w.midtones);
    const tHi = wheelTint(w.highlights), tG = wheelTint(w.global);
    const lift = [0, 1, 2].map((c) => w.shadows.l * 0.5 + tSh[c]);
    const gain = [0, 1, 2].map((c) => 1 + w.highlights.l + tHi[c]);
    const gammaExp = [0, 1, 2].map((c) => {
      const g0 = 1 + w.midtones.l + tMid[c];
      return 1 / Math.min(10, Math.max(0.1, g0));
    });
    const gmul = [0, 1, 2].map((c) => 1 + w.global.l + tG[c]);
    const wheelsOn = [w.shadows, w.midtones, w.highlights, w.global].some(
      (x) => x.h || x.s || x.l
    );
    gl.uniform3f(u.u_lift, lift[0], lift[1], lift[2]);
    gl.uniform3f(u.u_gain, gain[0], gain[1], gain[2]);
    gl.uniform3f(u.u_gammaExp, gammaExp[0], gammaExp[1], gammaExp[2]);
    gl.uniform3f(u.u_gmul, gmul[0], gmul[1], gmul[2]);
    gl.uniform1i(u.u_wheelsOn, wheelsOn ? 1 : 0);

    // Split toning.
    const s = look.split;
    const sh = hueSatToRGB(s.shadowHue, s.shadowSat);
    const hi = hueSatToRGB(s.highlightHue, s.highlightSat);
    gl.uniform3f(u.u_splitSh, sh[0], sh[1], sh[2]);
    gl.uniform3f(u.u_splitHi, hi[0], hi[1], hi[2]);
    gl.uniform1f(u.u_splitBalance, s.balance);
    gl.uniform1i(u.u_splitOn, s.shadowSat || s.highlightSat ? 1 : 0);
  }

  // A 1×1×1 black 3D texture so the sampler3D u_lut3d always has a valid 3D texture
  // on its unit — otherwise it would default to unit 0 and collide (type mismatch)
  // with the 2D image sampler, making draws a no-op on conformant drivers.
  private ensureDummy3D() {
    if (this.dummy3d) return;
    const gl = this.gl;
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

  private setLutUniform(lut: CubeLut | null) {
    const gl = this.gl;
    const u = this.uniforms;
    this.ensureDummy3D();
    gl.activeTexture(gl.TEXTURE2);
    if (lut) {
      if (lut !== this.lastLut) {
        this.buildLut3DTexture(lut);
        this.lastLut = lut;
      }
      gl.bindTexture(gl.TEXTURE_3D, this.lut3dTex);
      gl.uniform1f(u.u_lutSize, lut.size);
      gl.uniform3f(u.u_lutDomainMin, lut.domainMin[0], lut.domainMin[1], lut.domainMin[2]);
      gl.uniform3f(u.u_lutDomainMax, lut.domainMax[0], lut.domainMax[1], lut.domainMax[2]);
      gl.uniform1i(u.u_lut3dOn, 1);
    } else {
      gl.bindTexture(gl.TEXTURE_3D, this.dummy3d);
      gl.uniform1f(u.u_lutSize, 2);
      gl.uniform3f(u.u_lutDomainMin, 0, 0, 0);
      gl.uniform3f(u.u_lutDomainMax, 1, 1, 1);
      gl.uniform1i(u.u_lut3dOn, 0);
    }
    gl.uniform1i(u.u_lut3d, 2); // u_lut3d always resolves to unit 2 (only 3D textures)
  }

  render(recipe: Recipe) {
    const gl = this.gl;
    if (!this.texture) return;
    const canvas = gl.canvas as HTMLCanvasElement;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.uniforms.u_image, 0);

    const u = this.uniforms;
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

    this.setLookUniforms(recipe.look);
    this.setLutUniform(recipe.lut);

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
    gl.deleteProgram(this.program);
  }
}

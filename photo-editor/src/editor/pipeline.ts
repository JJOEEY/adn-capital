// WebGL2 render pipeline. Owns the GL context, the shader program, and the source
// texture. `render(recipe)` re-applies the whole non-destructive recipe each frame —
// cheap because it's a single fullscreen pass on the GPU.

import { Recipe } from "./recipe";
import { FRAG_SRC, VERT_SRC } from "./shaders";

// Map a -100..100 slider to a -1..1 shader uniform.
const norm = (v: number) => v / 100;

export class RenderPipeline {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private texture: WebGLTexture | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  imageWidth = 0;
  imageHeight = 0;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: false });
    if (!gl) throw new Error("WebGL2 not supported on this device");
    this.gl = gl;
    this.program = this.buildProgram();
    gl.useProgram(this.program);
    for (const name of [
      "u_image",
      "u_exposure",
      "u_contrast",
      "u_highlights",
      "u_shadows",
      "u_whites",
      "u_blacks",
      "u_temp",
      "u_tint",
      "u_saturation",
      "u_vibrance",
    ]) {
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

  // Upload a decoded image (ImageBitmap / canvas / video frame) as the source.
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

    gl.uniform1f(this.uniforms.u_exposure, recipe.exposure);
    gl.uniform1f(this.uniforms.u_contrast, norm(recipe.contrast));
    gl.uniform1f(this.uniforms.u_highlights, norm(recipe.highlights));
    gl.uniform1f(this.uniforms.u_shadows, norm(recipe.shadows));
    gl.uniform1f(this.uniforms.u_whites, norm(recipe.whites));
    gl.uniform1f(this.uniforms.u_blacks, norm(recipe.blacks));
    gl.uniform1f(this.uniforms.u_temp, norm(recipe.temp));
    gl.uniform1f(this.uniforms.u_tint, norm(recipe.tint));
    gl.uniform1f(this.uniforms.u_saturation, norm(recipe.saturation));
    gl.uniform1f(this.uniforms.u_vibrance, norm(recipe.vibrance));

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // Read back the current framebuffer as RGBA pixels (for histogram / export).
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
    gl.deleteProgram(this.program);
  }
}

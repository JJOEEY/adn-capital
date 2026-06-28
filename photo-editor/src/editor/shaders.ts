// GLSL ES 3.00 shaders for the WebGL2 render pipeline.
//
// The fragment shader applies the full Recipe in a single pass. Adjustments are
// done in a (display-referred) linear-ish space — good enough for an interactive
// preview. The serious color-managed / 16-bit-float path arrives in M2 (RAW) and
// the dedicated color-grading shaders in M3.

export const VERT_SRC = /* glsl */ `#version 300 es
precision highp float;
// Fullscreen triangle — no vertex buffer needed.
out vec2 v_uv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  v_uv = p; // 0..2 -> sampled as 0..1, flipped below for image orientation
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

export const FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_image;

uniform float u_exposure;   // EV
uniform float u_contrast;   // -1 .. 1
uniform float u_highlights; // -1 .. 1
uniform float u_shadows;    // -1 .. 1
uniform float u_whites;     // -1 .. 1
uniform float u_blacks;     // -1 .. 1
uniform float u_temp;       // -1 .. 1
uniform float u_tint;       // -1 .. 1
uniform float u_saturation; // -1 .. 1
uniform float u_vibrance;   // -1 .. 1

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

float luma(vec3 c) { return dot(c, LUMA); }

void main() {
  // Image is uploaded top-down; flip V so it renders upright.
  vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);
  vec3 c = texture(u_image, uv).rgb;

  // --- Exposure (multiplicative, in stops) ---
  c *= exp2(u_exposure);

  // --- White balance (simple channel scaling) ---
  // temp: warm => boost R, cut B. tint: magenta => boost R/B, cut G.
  c.r *= 1.0 + 0.4 * u_temp + 0.2 * u_tint;
  c.b *= 1.0 - 0.4 * u_temp + 0.2 * u_tint;
  c.g *= 1.0 - 0.2 * u_tint;

  // --- Tonal regions: highlights / shadows / whites / blacks ---
  float l = luma(c);
  // smooth masks over the tonal range
  float hiMask = smoothstep(0.5, 1.0, l);
  float shMask = 1.0 - smoothstep(0.0, 0.5, l);
  float whMask = smoothstep(0.7, 1.0, l);
  float blMask = 1.0 - smoothstep(0.0, 0.3, l);
  c += c * (u_highlights * 0.5 * hiMask);
  c += c * (u_shadows * 0.5 * shMask);
  c += vec3(u_whites * 0.3 * whMask);
  c += vec3(u_blacks * 0.3 * blMask);

  // --- Contrast (pivot around mid-grey) ---
  c = (c - 0.5) * (1.0 + u_contrast) + 0.5;

  // --- Vibrance (saturation weighted toward less-saturated pixels) ---
  {
    float mx = max(c.r, max(c.g, c.b));
    float mn = min(c.r, min(c.g, c.b));
    float sat = mx - mn;
    float g = luma(c);
    c = mix(vec3(g), c, 1.0 + u_vibrance * (1.0 - sat));
  }

  // --- Saturation (global) ---
  {
    float g = luma(c);
    c = mix(vec3(g), c, 1.0 + u_saturation);
  }

  fragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

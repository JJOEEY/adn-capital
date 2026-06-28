// GLSL ES 3.00 shaders for the WebGL2 render pipeline.
//
// The fragment shader applies the full Recipe in a single pass:
//   M1 light/color adjustments  →  M3 color grade (curves, HSL, wheels, split)
//   →  optional 3D .cube LUT.
//
// The M3 section mirrors the CPU reference in src/editor/color/* exactly (the
// pipeline computes per-channel wheel coefficients and the curve LUT on the CPU and
// uploads them, so GPU and CPU stay in lockstep — important for LUT export).

export const VERT_SRC = /* glsl */ `#version 300 es
precision highp float;
out vec2 v_uv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  v_uv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

export const FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler3D;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_image;

// --- M1 ---
uniform float u_exposure, u_contrast, u_highlights, u_shadows, u_whites, u_blacks;
uniform float u_temp, u_tint, u_saturation, u_vibrance;

// --- M3 color grade ---
uniform sampler2D u_curve;   // 256x1 RGB: per-channel combined (master∘channel) maps
uniform bool u_curveOn;
uniform vec3 u_hsl[8];        // per band: (hueShift, sat, lum) in -1..1
uniform bool u_hslOn;
uniform vec3 u_lift, u_gain, u_gammaExp, u_gmul; // wheel coefficients
uniform bool u_wheelsOn;
uniform vec3 u_splitSh, u_splitHi; // hueSat->rgb tints
uniform float u_splitBalance;
uniform bool u_splitOn;
uniform sampler3D u_lut3d;
uniform bool u_lut3dOn;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
const float PI = 3.14159265359;
float luma(vec3 c) { return dot(c, LUMA); }

vec3 rgb2hsl(vec3 c) {
  float mx = max(max(c.r, c.g), c.b);
  float mn = min(min(c.r, c.g), c.b);
  float l = (mx + mn) * 0.5;
  float h = 0.0, s = 0.0;
  float d = mx - mn;
  if (d > 1e-6) {
    s = l > 0.5 ? d / (2.0 - mx - mn) : d / (mx + mn);
    if (mx == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
    else if (mx == c.g) h = (c.b - c.r) / d + 2.0;
    else h = (c.r - c.g) / d + 4.0;
    h /= 6.0;
  }
  return vec3(h * 360.0, s, l);
}
float hue2rgb(float p, float q, float t) {
  if (t < 0.0) t += 1.0;
  if (t > 1.0) t -= 1.0;
  if (t < 1.0 / 6.0) return p + (q - p) * 6.0 * t;
  if (t < 0.5) return q;
  if (t < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - t) * 6.0;
  return p;
}
vec3 hsl2rgb(vec3 hsl) {
  float h = hsl.x / 360.0, s = hsl.y, l = hsl.z;
  if (s < 1e-6) return vec3(l);
  float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
  float p = 2.0 * l - q;
  return vec3(hue2rgb(p, q, h + 1.0 / 3.0), hue2rgb(p, q, h), hue2rgb(p, q, h - 1.0 / 3.0));
}

vec3 applyHsl(vec3 c) {
  vec3 hsl = rgb2hsl(c);
  float hues[8] = float[8](0.0, 30.0, 60.0, 120.0, 180.0, 240.0, 270.0, 300.0);
  float W = 0.0, hShift = 0.0, sAcc = 0.0, lAcc = 0.0;
  for (int i = 0; i < 8; i++) {
    float d = abs(hsl.x - hues[i]);
    d = min(d, 360.0 - d);
    float w = d < 60.0 ? 0.5 * (1.0 + cos(PI * d / 60.0)) : 0.0;
    W += w;
    hShift += w * u_hsl[i].x;
    sAcc += w * u_hsl[i].y;
    lAcc += w * u_hsl[i].z;
  }
  if (W <= 0.0) return c;
  float newH = mod(hsl.x + (hShift / W) * 30.0, 360.0);
  float newS = clamp(hsl.y * (1.0 + sAcc / W), 0.0, 1.0);
  float newL = clamp(hsl.z + (lAcc / W) * 0.5, 0.0, 1.0);
  return hsl2rgb(vec3(newH, newS, newL));
}

vec3 applyWheels(vec3 c) {
  c = c * u_gmul;
  c = c * u_gain;
  c = c + u_lift;
  c = clamp(c, 0.0, 1.0);
  c = pow(c, u_gammaExp);
  return clamp(c, 0.0, 1.0);
}

vec3 applySplit(vec3 c) {
  float l = luma(c);
  float pivot = 0.5 + u_splitBalance * 0.5;
  float hiW = clamp((l - pivot) / max(1e-3, 1.0 - pivot), 0.0, 1.0);
  float shW = clamp((pivot - l) / max(1e-3, pivot), 0.0, 1.0);
  return clamp(c + u_splitSh * shW * 0.5 + u_splitHi * hiW * 0.5, 0.0, 1.0);
}

void main() {
  vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);
  vec3 c = texture(u_image, uv).rgb;

  // ---------------- M1 ----------------
  c *= exp2(u_exposure);
  c.r *= 1.0 + 0.4 * u_temp + 0.2 * u_tint;
  c.b *= 1.0 - 0.4 * u_temp + 0.2 * u_tint;
  c.g *= 1.0 - 0.2 * u_tint;
  {
    float l = luma(c);
    float hiMask = smoothstep(0.5, 1.0, l);
    float shMask = 1.0 - smoothstep(0.0, 0.5, l);
    float whMask = smoothstep(0.7, 1.0, l);
    float blMask = 1.0 - smoothstep(0.0, 0.3, l);
    c += c * (u_highlights * 0.5 * hiMask);
    c += c * (u_shadows * 0.5 * shMask);
    c += vec3(u_whites * 0.3 * whMask);
    c += vec3(u_blacks * 0.3 * blMask);
  }
  c = (c - 0.5) * (1.0 + u_contrast) + 0.5;
  {
    float mx = max(c.r, max(c.g, c.b));
    float mn = min(c.r, min(c.g, c.b));
    float sat = mx - mn;
    float g = luma(c);
    c = mix(vec3(g), c, 1.0 + u_vibrance * (1.0 - sat));
  }
  {
    float g = luma(c);
    c = mix(vec3(g), c, 1.0 + u_saturation);
  }
  c = clamp(c, 0.0, 1.0);

  // ---------------- M3 color grade ----------------
  if (u_curveOn) {
    c = vec3(
      texture(u_curve, vec2(c.r, 0.5)).r,
      texture(u_curve, vec2(c.g, 0.5)).g,
      texture(u_curve, vec2(c.b, 0.5)).b
    );
  }
  if (u_hslOn) c = applyHsl(c);
  if (u_wheelsOn) c = applyWheels(c);
  if (u_splitOn) c = applySplit(c);
  if (u_lut3dOn) c = clamp(texture(u_lut3d, clamp(c, 0.0, 1.0)).rgb, 0.0, 1.0);

  fragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

// GLSL ES 3.00 shaders for the multi-pass WebGL2 pipeline:
//   BASE      — global light (M1) + color grade (M3) → offscreen FBO
//   LOCAL     — one local adjustment (mask + param deltas), chained per adjustment
//   COMPOSITE — background matte composite (M4) → screen, with alpha
//
// Split into passes so local adjustments (and, later, layers) stack arbitrarily.

export const VERT_SRC = /* glsl */ `#version 300 es
precision highp float;
out vec2 v_uv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  v_uv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

// ---------------- BASE: global adjustments + color grade ----------------
export const BASE_FRAG = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler3D;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_image;
uniform float u_exposure, u_contrast, u_highlights, u_shadows, u_whites, u_blacks;
uniform float u_temp, u_tint, u_saturation, u_vibrance;

uniform sampler2D u_curve;
uniform bool u_curveOn;
uniform vec3 u_hsl[8];
uniform bool u_hslOn;
uniform vec3 u_lift, u_gain, u_gammaExp, u_gmul;
uniform bool u_wheelsOn;
uniform vec3 u_splitSh, u_splitHi;
uniform float u_splitBalance;
uniform bool u_splitOn;
uniform sampler3D u_lut3d;
uniform bool u_lut3dOn;
uniform float u_lutSize;
uniform vec3 u_lutDomainMin, u_lutDomainMax;

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
  if (hsl.y < 1e-6) return c;
  float hues[8] = float[8](0.0, 30.0, 60.0, 120.0, 180.0, 240.0, 270.0, 300.0);
  float W = 0.0, hShift = 0.0, sAcc = 0.0, lAcc = 0.0;
  for (int i = 0; i < 8; i++) {
    float d = abs(hsl.x - hues[i]);
    d = min(d, 360.0 - d);
    float w = d < 60.0 ? 0.5 * (1.0 + cos(PI * d / 60.0)) : 0.0;
    W += w; hShift += w * u_hsl[i].x; sAcc += w * u_hsl[i].y; lAcc += w * u_hsl[i].z;
  }
  if (W <= 0.0) return c;
  float newH = mod(hsl.x + (hShift / W) * 30.0, 360.0);
  float newS = clamp(hsl.y * (1.0 + sAcc / W), 0.0, 1.0);
  float newL = clamp(hsl.z + (lAcc / W) * 0.5, 0.0, 1.0);
  return hsl2rgb(vec3(newH, newS, newL));
}
vec3 applyWheels(vec3 c) {
  c = c * u_gmul; c = c * u_gain; c = c + u_lift;
  c = clamp(c, 0.0, 1.0); c = pow(c, u_gammaExp);
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

  c *= exp2(u_exposure);
  c.r *= 1.0 + 0.4 * u_temp + 0.2 * u_tint;
  c.b *= 1.0 - 0.4 * u_temp + 0.2 * u_tint;
  c.g *= 1.0 - 0.2 * u_tint;
  {
    float l = luma(c);
    c += c * (u_highlights * 0.5 * smoothstep(0.5, 1.0, l));
    c += c * (u_shadows * 0.5 * (1.0 - smoothstep(0.0, 0.5, l)));
    c += vec3(u_whites * 0.3 * smoothstep(0.7, 1.0, l));
    c += vec3(u_blacks * 0.3 * (1.0 - smoothstep(0.0, 0.3, l)));
  }
  c = (c - 0.5) * (1.0 + u_contrast) + 0.5;
  {
    float mx = max(c.r, max(c.g, c.b));
    float mn = min(c.r, min(c.g, c.b));
    float g = luma(c);
    c = mix(vec3(g), c, 1.0 + u_vibrance * (1.0 - (mx - mn)));
  }
  { float g = luma(c); c = mix(vec3(g), c, 1.0 + u_saturation); }
  c = clamp(c, 0.0, 1.0);

  if (u_curveOn) {
    c = vec3(
      texture(u_curve, vec2((c.r * 255.0 + 0.5) / 256.0, 0.5)).r,
      texture(u_curve, vec2((c.g * 255.0 + 0.5) / 256.0, 0.5)).g,
      texture(u_curve, vec2((c.b * 255.0 + 0.5) / 256.0, 0.5)).b
    );
  }
  if (u_hslOn) c = applyHsl(c);
  if (u_wheelsOn) c = applyWheels(c);
  if (u_splitOn) c = applySplit(c);
  if (u_lut3dOn) {
    vec3 t = (clamp(c, 0.0, 1.0) - u_lutDomainMin) / max(vec3(1e-6), u_lutDomainMax - u_lutDomainMin);
    t = clamp(t, 0.0, 1.0);
    vec3 q = (t * (u_lutSize - 1.0) + 0.5) / u_lutSize;
    c = clamp(texture(u_lut3d, q).rgb, 0.0, 1.0);
  }
  fragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

// ---------------- LOCAL: one masked adjustment ----------------
export const LOCAL_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_src;     // previous pass result (upright)
uniform sampler2D u_aiMask;  // AI matte (top-down)
uniform int u_maskKind;      // 0 linear, 1 radial, 2 rangeLuma, 3 aiSubject
uniform bool u_invert;
uniform vec4 u_linear;       // x1,y1,x2,y2 (image space, y down)
uniform vec4 u_radial;       // cx,cy,rx,ry
uniform vec2 u_radial2;      // angle, feather
uniform vec3 u_range;        // lo, hi, feather
uniform float u_lExposure, u_lContrast, u_lTemp, u_lTint, u_lSat;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
float clamp01(float v) { return clamp(v, 0.0, 1.0); }

float maskWeight(vec2 p, float lum) {
  if (u_maskKind == 0) {
    vec2 d = u_linear.zw - u_linear.xy;
    float l2 = dot(d, d);
    if (l2 < 1e-9) return 1.0;
    return clamp01(dot(p - u_linear.xy, d) / l2);
  } else if (u_maskKind == 1) {
    float ca = cos(u_radial2.x), sa = sin(u_radial2.x);
    vec2 o = p - u_radial.xy;
    float lx = (o.x * ca + o.y * sa) / max(1e-6, u_radial.z);
    float ly = (-o.x * sa + o.y * ca) / max(1e-6, u_radial.w);
    float dd = length(vec2(lx, ly));
    float f = max(1e-4, clamp01(u_radial2.y));
    return 1.0 - smoothstep(1.0 - f, 1.0, dd);
  } else if (u_maskKind == 2) {
    float f = max(1e-4, u_range.z);
    float lower = smoothstep(u_range.x - f, u_range.x, lum);
    float upper = 1.0 - smoothstep(u_range.y, u_range.y + f, lum);
    return clamp01(min(lower, upper));
  }
  return texture(u_aiMask, p).r; // aiSubject: p is image-space (top-down)
}

void main() {
  vec2 iuv = vec2(v_uv.x, 1.0 - v_uv.y);
  vec3 c = texture(u_src, v_uv).rgb;
  float lum = dot(c, LUMA);
  float m = maskWeight(iuv, lum);
  if (u_invert) m = 1.0 - m;

  vec3 a = c;
  a *= exp2(u_lExposure);
  a.r *= 1.0 + 0.4 * u_lTemp + 0.2 * u_lTint;
  a.b *= 1.0 - 0.4 * u_lTemp + 0.2 * u_lTint;
  a.g *= 1.0 - 0.2 * u_lTint;
  a = (a - 0.5) * (1.0 + u_lContrast) + 0.5;
  { float g = dot(a, LUMA); a = mix(vec3(g), a, 1.0 + u_lSat); }
  a = clamp(a, 0.0, 1.0);

  fragColor = vec4(mix(c, a, m), 1.0);
}
`;

// ---------------- DETAIL: clarity + sharpening + noise reduction ----------------
export const DETAIL_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_src;
uniform vec2 u_texel;     // 1/width, 1/height
uniform float u_clarity;  // -1 .. 1
uniform float u_sharpen;  // 0 .. ~2
uniform float u_nr;       // 0 .. 1

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

void main() {
  vec3 c = texture(u_src, v_uv).rgb;
  // 3x3 box blur of the neighborhood.
  vec3 blur = vec3(0.0);
  for (int dy = -1; dy <= 1; dy++)
    for (int dx = -1; dx <= 1; dx++)
      blur += texture(u_src, v_uv + vec2(float(dx), float(dy)) * u_texel).rgb;
  blur /= 9.0;

  // Noise reduction: pull toward the blur but preserve luminance (chroma-ish smoothing).
  if (u_nr > 0.0) {
    float l0 = dot(c, LUMA);
    vec3 sm = mix(c, blur, u_nr);
    c = sm + (l0 - dot(sm, LUMA));
  }
  // Sharpening: unsharp mask.
  c += u_sharpen * (c - blur);
  // Clarity: mild local contrast on luminance.
  c += vec3(u_clarity * (dot(c, LUMA) - dot(blur, LUMA)));

  fragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

// ---------------- HEAL: spot clone / heal ----------------
export const HEAL_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_src;
uniform vec2 u_dst;     // destination center (image space, y down)
uniform vec2 u_srcpos;  // source center (image space)
uniform float u_radius, u_feather, u_aspect;
uniform int u_mode;     // 0 heal, 1 clone

void main() {
  vec2 iuv = vec2(v_uv.x, 1.0 - v_uv.y);
  vec3 c = texture(u_src, v_uv).rgb;

  vec2 dd = vec2((iuv.x - u_dst.x) * u_aspect, iuv.y - u_dst.y);
  float dist = length(dd) / max(1e-4, u_radius);
  float f = max(1e-4, clamp(u_feather, 0.0, 1.0));
  float w = 1.0 - smoothstep(1.0 - f, 1.0, dist);
  if (w <= 0.0) {
    fragColor = vec4(c, 1.0);
    return;
  }

  vec2 srcImg = iuv + (u_srcpos - u_dst);
  vec3 srcPix = texture(u_src, vec2(srcImg.x, 1.0 - srcImg.y)).rgb;
  vec3 healed = srcPix;

  if (u_mode == 0) {
    // Tone/color match: low-frequency of destination minus that of source.
    vec3 dMean = vec3(0.0), sMean = vec3(0.0);
    for (int i = 0; i < 4; i++) {
      float a = float(i) * 1.5707963;
      vec2 o = vec2(cos(a) * u_radius / u_aspect, sin(a) * u_radius);
      dMean += texture(u_src, vec2(iuv.x + o.x, 1.0 - (iuv.y + o.y))).rgb;
      sMean += texture(u_src, vec2(srcImg.x + o.x, 1.0 - (srcImg.y + o.y))).rgb;
    }
    healed = clamp(srcPix + (dMean - sMean) * 0.25, 0.0, 1.0);
  }

  fragColor = vec4(mix(c, healed, w), 1.0);
}
`;

// ---------------- HEAL STROKE: freehand brush (rasterized stroke mask) ----------------
export const HEAL_STROKE_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_src;
uniform sampler2D u_strokeMask; // R8 coverage (top-down, image orientation)
uniform vec2 u_offset;          // source offset (image space)
uniform float u_radius, u_aspect;
uniform int u_mode;             // 0 heal, 1 clone

void main() {
  vec2 iuv = vec2(v_uv.x, 1.0 - v_uv.y);
  vec3 c = texture(u_src, v_uv).rgb;
  float w = texture(u_strokeMask, iuv).r;
  if (w <= 0.0) {
    fragColor = vec4(c, 1.0);
    return;
  }
  vec2 srcImg = iuv + u_offset;
  vec3 srcPix = texture(u_src, vec2(srcImg.x, 1.0 - srcImg.y)).rgb;
  vec3 healed = srcPix;
  if (u_mode == 0) {
    vec3 dMean = vec3(0.0), sMean = vec3(0.0);
    for (int i = 0; i < 4; i++) {
      float a = float(i) * 1.5707963;
      vec2 o = vec2(cos(a) * u_radius / u_aspect, sin(a) * u_radius);
      dMean += texture(u_src, vec2(iuv.x + o.x, 1.0 - (iuv.y + o.y))).rgb;
      sMean += texture(u_src, vec2(srcImg.x + o.x, 1.0 - (srcImg.y + o.y))).rgb;
    }
    healed = clamp(srcPix + (dMean - sMean) * 0.25, 0.0, 1.0);
  }
  fragColor = vec4(mix(c, healed, w), 1.0);
}
`;

// ---------------- LAYER: composite one image layer with a blend mode ----------------
export const LAYER_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_src;    // accumulator (upright)
uniform sampler2D u_layer;  // layer image (top-down)
uniform sampler2D u_aiMask; // AI matte (top-down), for layer masks of kind aiSubject
uniform int u_blend;        // 0 normal,1 mult,2 screen,3 overlay,4 softlight,5 darken,6 lighten,7 diff,8 add
uniform float u_opacity;
// optional layer mask: u_maskKind -1=none, 0 linear,1 radial,2 rangeLuma,3 aiSubject
uniform int u_maskKind;
uniform bool u_maskInvert;
uniform vec4 u_linear;      // x1,y1,x2,y2
uniform vec4 u_radial;      // cx,cy,rx,ry
uniform vec2 u_radial2;     // angle, feather
uniform vec3 u_range;       // lo,hi,feather

float clamp01v(float v) { return clamp(v, 0.0, 1.0); }

float layerMaskWeight(vec2 p, float lum) {
  if (u_maskKind < 0) return 1.0;
  float m = 1.0;
  if (u_maskKind == 0) {
    vec2 d = u_linear.zw - u_linear.xy;
    float l2 = dot(d, d);
    m = l2 < 1e-9 ? 1.0 : clamp01v(dot(p - u_linear.xy, d) / l2);
  } else if (u_maskKind == 1) {
    float ca = cos(u_radial2.x), sa = sin(u_radial2.x);
    vec2 o = p - u_radial.xy;
    float lx = (o.x * ca + o.y * sa) / max(1e-6, u_radial.z);
    float ly = (-o.x * sa + o.y * ca) / max(1e-6, u_radial.w);
    float f = max(1e-4, clamp01v(u_radial2.y));
    m = 1.0 - smoothstep(1.0 - f, 1.0, length(vec2(lx, ly)));
  } else if (u_maskKind == 2) {
    float f = max(1e-4, u_range.z);
    m = clamp01v(min(smoothstep(u_range.x - f, u_range.x, lum), 1.0 - smoothstep(u_range.y, u_range.y + f, lum)));
  } else {
    m = texture(u_aiMask, p).r;
  }
  return u_maskInvert ? 1.0 - m : m;
}

vec3 blend(int mode, vec3 d, vec3 s) {
  if (mode == 1) return d * s;
  if (mode == 2) return 1.0 - (1.0 - d) * (1.0 - s);
  if (mode == 3) return mix(2.0 * d * s, 1.0 - 2.0 * (1.0 - d) * (1.0 - s), step(0.5, d));
  if (mode == 4) {
    vec3 r;
    for (int i = 0; i < 3; i++) {
      float dd = d[i], ss = s[i];
      r[i] = ss < 0.5
        ? dd - (1.0 - 2.0 * ss) * dd * (1.0 - dd)
        : dd + (2.0 * ss - 1.0) * ((dd < 0.25 ? ((16.0 * dd - 12.0) * dd + 4.0) * dd : sqrt(dd)) - dd);
    }
    return r;
  }
  if (mode == 5) return min(d, s);
  if (mode == 6) return max(d, s);
  if (mode == 7) return abs(d - s);
  if (mode == 8) return clamp(d + s, 0.0, 1.0);
  return s;
}

void main() {
  vec2 iuv = vec2(v_uv.x, 1.0 - v_uv.y);
  vec3 d = texture(u_src, v_uv).rgb;
  vec4 lp = texture(u_layer, iuv);
  float a = u_opacity * lp.a * layerMaskWeight(iuv, dot(d, vec3(0.2126, 0.7152, 0.0722)));
  vec3 b = clamp(blend(u_blend, d, lp.rgb), 0.0, 1.0);
  fragColor = vec4(mix(d, b, a), 1.0);
}
`;

// ---------------- COMPOSITE: background matte → screen ----------------
export const COMPOSITE_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_src;
uniform sampler2D u_mask;
uniform bool u_maskOn;
uniform int u_bgMode;   // 0 none, 1 transparent, 2 color
uniform vec3 u_bgColor;

void main() {
  vec2 iuv = vec2(v_uv.x, 1.0 - v_uv.y);
  vec3 c = clamp(texture(u_src, v_uv).rgb, 0.0, 1.0);
  float outA = 1.0;
  if (u_maskOn && u_bgMode != 0) {
    float fg = texture(u_mask, iuv).r;
    if (u_bgMode == 2) c = mix(u_bgColor, c, fg);
    else outA = fg;
  }
  fragColor = vec4(c, outA);
}
`;

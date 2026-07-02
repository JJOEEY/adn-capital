// The "Look" — Lumen's color-grading state (M3). This is the contract that the
// color-math modules implement and that both the CPU path (LUT export + unit tests)
// and the GLSL shader mirror.
//
// A Look is part of the non-destructive recipe. The CPU `applyLook` here is the
// single source of truth: the WebGL shader mirrors these exact formulas for the
// real-time preview, and `.cube` LUT export samples `applyLook` over a grid.
//
// Order of operations (matches the shader):
//   1. tone curves   (master RGB, then per-channel R/G/B)
//   2. HSL mixer     (8 hue bands: hue / sat / lum)
//   3. color wheels  (shadows=lift, midtones=gamma, highlights=gain, + global)
//   4. split toning  (tint shadows + highlights)

import { applyCurves } from "./curve";
import { applyHsl } from "./hsl";
import { applyWheels } from "./wheels";

export type RGB = [number, number, number];

/** A control point on a tone curve, in normalized 0..1 input/output space. */
export interface CurvePt {
  x: number;
  y: number;
}

/** Tone curves: a master curve plus per-channel curves. Empty/linear = identity. */
export interface ChannelCurves {
  rgb: CurvePt[];
  r: CurvePt[];
  g: CurvePt[];
  b: CurvePt[];
}

/** One HSL band adjustment. Each value is -1..1 (UI shows -100..100). */
export interface HSLBand {
  h: number; // hue shift
  s: number; // saturation
  l: number; // luminance
}

/** Hue centers (degrees) for the 8 HSL bands, Lightroom order. */
export const HSL_BANDS = [
  "Red",
  "Orange",
  "Yellow",
  "Green",
  "Aqua",
  "Blue",
  "Purple",
  "Magenta",
] as const;
export const HSL_BAND_HUES = [0, 30, 60, 120, 180, 240, 270, 300];

/** A color-grading wheel: hue (deg), saturation 0..1, luminance -1..1. */
export interface Wheel {
  h: number;
  s: number;
  l: number;
}

export interface ColorWheels {
  shadows: Wheel;
  midtones: Wheel;
  highlights: Wheel;
  global: Wheel;
}

/** Split toning: hue 0..360 + sat 0..1 for shadows & highlights, balance -1..1. */
export interface SplitTone {
  shadowHue: number;
  shadowSat: number;
  highlightHue: number;
  highlightSat: number;
  balance: number;
}

export interface Look {
  curves: ChannelCurves;
  hsl: HSLBand[]; // length 8, HSL_BANDS order
  wheels: ColorWheels;
  split: SplitTone;
}

const ZERO_WHEEL: Wheel = { h: 0, s: 0, l: 0 };

export function defaultLook(): Look {
  return {
    curves: { rgb: [], r: [], g: [], b: [] },
    hsl: Array.from({ length: 8 }, () => ({ h: 0, s: 0, l: 0 })),
    wheels: {
      shadows: { ...ZERO_WHEEL },
      midtones: { ...ZERO_WHEEL },
      highlights: { ...ZERO_WHEEL },
      global: { ...ZERO_WHEEL },
    },
    split: {
      shadowHue: 0,
      shadowSat: 0,
      highlightHue: 0,
      highlightSat: 0,
      balance: 0,
    },
  };
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** hue (deg) + sat → a chroma tint vector (sat=0 ⇒ [0,0,0]). Used by split toning;
 *  exported so the GPU pipeline computes identical split tints. */
export function hueSatToRGB(hueDeg: number, sat: number): RGB {
  const h = (((hueDeg % 360) + 360) % 360) / 60;
  const c = sat;
  const x = c * (1 - Math.abs((h % 2) - 1));
  let r = 0,
    g = 0,
    b = 0;
  if (h < 1) [r, g, b] = [c, x, 0];
  else if (h < 2) [r, g, b] = [x, c, 0];
  else if (h < 3) [r, g, b] = [0, c, x];
  else if (h < 4) [r, g, b] = [0, x, c];
  else if (h < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [r, g, b];
}

function luma(rgb: RGB): number {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

/** Apply split toning: add a shadow tint and a highlight tint by luma weight. */
function applySplit(rgb: RGB, s: SplitTone): RGB {
  if (s.shadowSat === 0 && s.highlightSat === 0) return rgb;
  const l = luma(rgb);
  // balance shifts the crossover between shadow/highlight regions.
  const pivot = 0.5 + s.balance * 0.5;
  const hiW = clamp01((l - pivot) / Math.max(1e-3, 1 - pivot));
  const shW = clamp01((pivot - l) / Math.max(1e-3, pivot));
  const sh = hueSatToRGB(s.shadowHue, s.shadowSat);
  const hi = hueSatToRGB(s.highlightHue, s.highlightSat);
  return [
    clamp01(rgb[0] + (sh[0] - 0.0) * shW * 0.5 + (hi[0] - 0.0) * hiW * 0.5),
    clamp01(rgb[1] + (sh[1] - 0.0) * shW * 0.5 + (hi[1] - 0.0) * hiW * 0.5),
    clamp01(rgb[2] + (sh[2] - 0.0) * shW * 0.5 + (hi[2] - 0.0) * hiW * 0.5),
  ];
}

/**
 * Apply the full color-grading look to a single linear-ish 0..1 RGB pixel.
 * This is the CPU reference used by unit tests and LUT export; the shader mirrors it.
 */
export function applyLook(rgb: RGB, look: Look): RGB {
  let c = applyCurves(rgb, look.curves);
  c = applyHsl(c, look.hsl);
  c = applyWheels(c, look.wheels);
  c = applySplit(c, look.split);
  return [clamp01(c[0]), clamp01(c[1]), clamp01(c[2])];
}

export function isDefaultLook(look: Look): boolean {
  const def = defaultLook();
  return JSON.stringify(look) === JSON.stringify(def);
}

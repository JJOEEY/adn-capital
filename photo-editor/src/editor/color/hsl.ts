// 8-band HSL mixer (M3). Converts a pixel to HSL, applies per-hue-band hue/sat/lum
// adjustments with smooth overlapping cosine weights, then converts back.
// Pure functions, no side effects. All RGB channels are 0..1.

import type { RGB, HSLBand } from "./look";

// Hue centers (degrees) for the 8 HSL bands, in look.ts HSL_BAND_HUES order.
// Mirrored locally so this module has no runtime dependency on look.ts (which
// transitively pulls in sibling color modules); the values match HSL_BAND_HUES.
const HSL_BAND_HUES: readonly number[] = [0, 30, 60, 120, 180, 240, 270, 300];

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** RGB (0..1) → HSL with h in 0..360, s in 0..1, l in 0..1. */
export function rgb2hsl(rgb: RGB): [number, number, number] {
  const r = rgb[0];
  const g = rgb[1];
  const b = rgb[2];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) {
    // achromatic — no hue, no saturation.
    return [0, 0, l];
  }

  const s = delta / (1 - Math.abs(2 * l - 1));

  let h: number;
  if (max === r) {
    h = ((g - b) / delta) % 6;
  } else if (max === g) {
    h = (b - r) / delta + 2;
  } else {
    h = (r - g) / delta + 4;
  }
  h *= 60;
  if (h < 0) h += 360;

  return [h, s, l];
}

/** HSL (h 0..360, s 0..1, l 0..1) → RGB (0..1). Inverse of rgb2hsl. */
export function hsl2rgb(hsl: [number, number, number]): RGB {
  const h = hsl[0];
  const s = hsl[1];
  const l = hsl[2];

  if (s === 0) {
    return [l, l, l];
  }

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const m = l - c / 2;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hp < 1) {
    r1 = c;
    g1 = x;
  } else if (hp < 2) {
    r1 = x;
    g1 = c;
  } else if (hp < 3) {
    g1 = c;
    b1 = x;
  } else if (hp < 4) {
    g1 = x;
    b1 = c;
  } else if (hp < 5) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  return [r1 + m, g1 + m, b1 + m];
}

const isZeroBand = (b: HSLBand): boolean => b.h === 0 && b.s === 0 && b.l === 0;

/**
 * Apply the 8-band HSL mixer. `bands` is length 8, in HSL_BAND_HUES order.
 * Identity when every band is {h:0,s:0,l:0}.
 */
export function applyHsl(rgb: RGB, bands: HSLBand[]): RGB {
  if (bands.every(isZeroBand)) return rgb;

  const [H, S, L] = rgb2hsl(rgb);

  // A grey pixel has no hue to weight against any band — leave it untouched.
  if (S === 0) return rgb;

  let W = 0;
  let wH = 0;
  let wS = 0;
  let wL = 0;

  for (let i = 0; i < HSL_BAND_HUES.length; i++) {
    const Ci = HSL_BAND_HUES[i];
    const diff = Math.abs(H - Ci);
    const d = Math.min(diff, 360 - diff);
    const wi = d < 60 ? 0.5 * (1 + Math.cos((Math.PI * d) / 60)) : 0;
    if (wi === 0) continue;
    W += wi;
    wH += wi * bands[i].h;
    wS += wi * bands[i].s;
    wL += wi * bands[i].l;
  }

  if (W === 0) return rgb;

  const hueShiftDeg = (wH / W) * 30;
  const satMul = 1 + wS / W;
  const lumAdd = (wL / W) * 0.5;

  const newH = (((H + hueShiftDeg) % 360) + 360) % 360;
  const newS = clamp01(S * satMul);
  const newL = clamp01(L + lumAdd);

  return hsl2rgb([newH, newS, newL]);
}

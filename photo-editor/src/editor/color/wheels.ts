// Color-grading wheels (M3): lift / gamma / gain + global.
//
// Each wheel contributes a hue/sat chroma tint plus a luminance term:
//   shadows    -> lift   (additive)
//   midtones   -> gamma  (power)
//   highlights -> gain   (multiplicative)
//   global     -> overall gain
//
// wheelTint maps a wheel's hue/sat to a zero-sum chroma offset around 0, so a
// fully-desaturated wheel (s=0) contributes nothing. All-zero wheels are an
// exact identity. Pure functions, 0..1 channel space, no side effects.

import type { RGB, Wheel, ColorWheels } from "./look";

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

/**
 * Standard HSV -> RGB with V=1, returning 0..1. sat=0 => [1,1,1] (white).
 */
function hueSatToRGB(hueDeg: number, sat: number): RGB {
  const h = ((((hueDeg % 360) + 360) % 360) / 60);
  const s = clamp01(sat);
  const c = s; // chroma = V*s, with V=1
  const x = c * (1 - Math.abs((h % 2) - 1));
  const m = 1 - c; // min channel = V - c
  let r = 0,
    g = 0,
    b = 0;
  if (h < 1) [r, g, b] = [c, x, 0];
  else if (h < 2) [r, g, b] = [x, c, 0];
  else if (h < 3) [r, g, b] = [0, c, x];
  else if (h < 4) [r, g, b] = [0, x, c];
  else if (h < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [r + m, g + m, b + m];
}

/**
 * hue/sat -> a zero-sum chroma offset centered around 0 (channels sum to ~0).
 * s=0 => [0,0,0]. Magnitude scaled by 0.5.
 */
export function wheelTint(w: Wheel): RGB {
  const c = hueSatToRGB(w.h, w.s);
  const mean = (c[0] + c[1] + c[2]) / 3;
  return [(c[0] - mean) * 0.5, (c[1] - mean) * 0.5, (c[2] - mean) * 0.5];
}

/**
 * Apply lift/gamma/gain wheels (+ global) to a 0..1 RGB pixel.
 * All-zero wheels => exact identity.
 */
export function applyWheels(rgb: RGB, wheels: ColorWheels): RGB {
  const tSh = wheelTint(wheels.shadows);
  const tMid = wheelTint(wheels.midtones);
  const tHi = wheelTint(wheels.highlights);
  const tG = wheelTint(wheels.global);

  const out: RGB = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const lift = wheels.shadows.l * 0.5 + tSh[i];
    const gain = 1 + wheels.highlights.l + tHi[i];
    const gammaIn = 1 + wheels.midtones.l + tMid[i];
    const gammaExp = 1 / clamp(gammaIn, 0.1, 10);
    const gmul = 1 + wheels.global.l + tG[i];

    let v = rgb[i];
    v = v * gmul; // global gain
    v = v * gain; // highlights gain
    v = v + lift; // shadows lift
    v = Math.pow(clamp01(v), gammaExp); // midtones gamma
    out[i] = clamp01(v);
  }
  return out;
}

// Tone curves via monotone cubic interpolation (Fritsch–Carlson).
//
// The master RGB curve is applied first, then the per-channel R/G/B curve.
// Monotone Hermite tangents guarantee no overshoot/ringing on monotone control
// data, so a monotone-increasing control set always yields a monotone LUT.

import type { CurvePt, RGB, ChannelCurves } from "./look";

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Evaluate a tone curve at x using monotone cubic Hermite interpolation.
 * Fewer than 2 points => identity (clamp01(x)). Input array is not mutated.
 */
export function evalCurve(points: CurvePt[], x: number): number {
  const n = points.length;
  if (n < 2) return clamp01(x);

  // Copy + sort by x ascending without mutating the caller's array.
  const pts = points.slice().sort((a, b) => a.x - b.x);

  const p0 = pts[0];
  const pLast = pts[n - 1];
  if (x <= p0.x) return clamp01(p0.y);
  if (x >= pLast.x) return clamp01(pLast.y);

  // Secant slopes between consecutive points.
  const dx: number[] = new Array(n - 1);
  const slope: number[] = new Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    const h = pts[i + 1].x - pts[i].x;
    dx[i] = h;
    // Degenerate (duplicate x) segment => treat slope as flat to avoid div-by-zero.
    slope[i] = h > 0 ? (pts[i + 1].y - pts[i].y) / h : 0;
  }

  // Fritsch–Carlson tangents.
  const m: number[] = new Array(n);
  m[0] = slope[0];
  m[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    const s0 = slope[i - 1];
    const s1 = slope[i];
    // If the data is not monotone across this point (sign change or a flat
    // segment), set the tangent to zero so we never overshoot.
    if (s0 * s1 <= 0) {
      m[i] = 0;
    } else {
      // Weighted harmonic mean of the two secant slopes.
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      m[i] = (w1 + w2) / (w1 / s0 + w2 / s1);
    }
  }

  // Locate the segment [i, i+1] containing x (binary search).
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].x <= x) lo = mid;
    else hi = mid;
  }
  const i = lo;

  const h = dx[i];
  const t = (x - pts[i].x) / h;
  const t2 = t * t;
  const t3 = t2 * t;

  // Cubic Hermite basis functions.
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;

  const y =
    h00 * pts[i].y +
    h10 * h * m[i] +
    h01 * pts[i + 1].y +
    h11 * h * m[i + 1];

  return clamp01(y);
}

/**
 * Build a lookup table by sampling evalCurve over [0,1].
 * lut[i] = evalCurve(points, i/(size-1)). Default size 256.
 */
export function buildLut(points: CurvePt[], size = 256): Float32Array {
  const lut = new Float32Array(size);
  if (size === 1) {
    lut[0] = evalCurve(points, 0);
    return lut;
  }
  for (let i = 0; i < size; i++) {
    lut[i] = evalCurve(points, i / (size - 1));
  }
  return lut;
}

/**
 * Apply tone curves to an RGB pixel: master RGB curve first, then the
 * matching per-channel curve. All outputs clamped to 0..1.
 */
export function applyCurves(rgb: RGB, curves: ChannelCurves): RGB {
  const channels: [number, CurvePt[]][] = [
    [rgb[0], curves.r],
    [rgb[1], curves.g],
    [rgb[2], curves.b],
  ];
  const out = channels.map(([v, ch]) => {
    const m = evalCurve(curves.rgb, v);
    return clamp01(evalCurve(ch, m));
  });
  return [out[0], out[1], out[2]];
}

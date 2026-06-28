// Adobe/IRIDAS `.cube` LUT support: parse / apply / generate / serialize.
//
// A `.cube` LUT is the portable interchange format for a color grade. Lumen
// exports a Look by sampling `applyLook` over a 3D grid into a CubeLut, then
// serializing it here; other apps (Premiere, Resolve, …) can read it back.
//
// Data ordering (Adobe spec): RED varies fastest, then GREEN, then BLUE.
//   flatIndex = ((b * size + g) * size + r) * 3
//
// All channel values are 0..1. applyCube clamps its output to 0..1.

import type { RGB } from "./look";

export interface CubeLut {
  dim: 1 | 3;
  size: number;
  data: Float32Array;
  domainMin: RGB;
  domainMax: RGB;
  title?: string;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Linear interpolation. */
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Parse a `.cube` LUT (1D or 3D). Ignores blank lines and `#` comments.
 * Throws a clear Error if a size keyword is missing or the data row count
 * does not match the expected size (size^3 for 3D, size for 1D).
 */
export function parseCube(text: string): CubeLut {
  const lines = text.split(/\r?\n/);

  let dim: 1 | 3 | undefined;
  let size: number | undefined;
  let title: string | undefined;
  let domainMin: RGB = [0, 0, 0];
  let domainMax: RGB = [1, 1, 1];
  const rows: number[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;

    const upper = line.toUpperCase();

    if (upper.startsWith("TITLE")) {
      const m = line.match(/"([^"]*)"/);
      title = m ? m[1] : line.slice(5).trim();
      continue;
    }
    if (upper.startsWith("LUT_3D_SIZE")) {
      const n = Number(line.split(/\s+/)[1]);
      if (!Number.isInteger(n) || n < 2) {
        throw new Error(`Invalid LUT_3D_SIZE: ${line}`);
      }
      dim = 3;
      size = n;
      continue;
    }
    if (upper.startsWith("LUT_1D_SIZE")) {
      const n = Number(line.split(/\s+/)[1]);
      if (!Number.isInteger(n) || n < 2) {
        throw new Error(`Invalid LUT_1D_SIZE: ${line}`);
      }
      dim = 1;
      size = n;
      continue;
    }
    if (upper.startsWith("DOMAIN_MIN")) {
      const p = line.split(/\s+/).slice(1).map(Number);
      if (p.length !== 3 || p.some((v) => !Number.isFinite(v))) {
        throw new Error(`Invalid DOMAIN_MIN: ${line}`);
      }
      domainMin = [p[0], p[1], p[2]];
      continue;
    }
    if (upper.startsWith("DOMAIN_MAX")) {
      const p = line.split(/\s+/).slice(1).map(Number);
      if (p.length !== 3 || p.some((v) => !Number.isFinite(v))) {
        throw new Error(`Invalid DOMAIN_MAX: ${line}`);
      }
      domainMax = [p[0], p[1], p[2]];
      continue;
    }

    // Otherwise: a data row of three floats.
    const parts = line.split(/\s+/).map(Number);
    if (parts.length !== 3 || parts.some((v) => !Number.isFinite(v))) {
      throw new Error(`Malformed LUT data row: "${line}"`);
    }
    rows.push(parts[0], parts[1], parts[2]);
  }

  if (dim === undefined || size === undefined) {
    throw new Error(
      "Missing LUT size keyword (expected LUT_3D_SIZE or LUT_1D_SIZE)",
    );
  }

  const expectedRows = dim === 3 ? size * size * size : size;
  const gotRows = rows.length / 3;
  if (gotRows !== expectedRows) {
    throw new Error(
      `LUT data row count mismatch: expected ${expectedRows}, got ${gotRows}`,
    );
  }

  const lut: CubeLut = {
    dim,
    size,
    data: Float32Array.from(rows),
    domainMin,
    domainMax,
  };
  if (title !== undefined) lut.title = title;
  return lut;
}

/** Round a float for serialization with fixed precision, trimming "-0". */
const fmt = (v: number): string => {
  const s = v.toFixed(6);
  return s === "-0.000000" ? "0.000000" : s;
};

/**
 * Serialize a CubeLut back to `.cube` text. Round-trips with parseCube.
 * Emits TITLE (if present), the size keyword, DOMAIN_MIN/MAX, then rows
 * in RED-fastest order with 6 decimals of precision.
 */
export function serializeCube(lut: CubeLut): string {
  const out: string[] = [];
  if (lut.title !== undefined) out.push(`TITLE "${lut.title}"`);
  out.push(`${lut.dim === 3 ? "LUT_3D_SIZE" : "LUT_1D_SIZE"} ${lut.size}`);
  out.push(`DOMAIN_MIN ${lut.domainMin.map(fmt).join(" ")}`);
  out.push(`DOMAIN_MAX ${lut.domainMax.map(fmt).join(" ")}`);

  const rows = lut.data.length / 3;
  for (let i = 0; i < rows; i++) {
    const o = i * 3;
    out.push(`${fmt(lut.data[o])} ${fmt(lut.data[o + 1])} ${fmt(lut.data[o + 2])}`);
  }
  return out.join("\n") + "\n";
}

/** Normalize a channel value through the domain into 0..1. */
const domainNorm = (v: number, lo: number, hi: number): number => {
  const span = hi - lo;
  if (span === 0) return 0;
  return clamp01((v - lo) / span);
};

/**
 * Apply a LUT to an RGB triple. Input is normalized through the domain and
 * clamped to 0..1, then:
 *   - 3D: trilinear interpolation over the lattice (RED-fastest indexing),
 *   - 1D: per-channel linear interpolation along the axis.
 * Output is clamped to 0..1.
 */
export function applyCube(lut: CubeLut, rgb: RGB): RGB {
  const tr = domainNorm(rgb[0], lut.domainMin[0], lut.domainMax[0]);
  const tg = domainNorm(rgb[1], lut.domainMin[1], lut.domainMax[1]);
  const tb = domainNorm(rgb[2], lut.domainMin[2], lut.domainMax[2]);
  const n = lut.size;
  const data = lut.data;

  if (lut.dim === 1) {
    const axis = (t: number, c: number): number => {
      const f = t * (n - 1);
      const i0 = Math.floor(f);
      const i1 = Math.min(i0 + 1, n - 1);
      const frac = f - i0;
      return lerp(data[i0 * 3 + c], data[i1 * 3 + c], frac);
    };
    return [
      clamp01(axis(tr, 0)),
      clamp01(axis(tg, 1)),
      clamp01(axis(tb, 2)),
    ];
  }

  // 3D trilinear.
  const idx = (r: number, g: number, b: number, c: number): number =>
    data[((b * n + g) * n + r) * 3 + c];

  const fr = tr * (n - 1);
  const fg = tg * (n - 1);
  const fb = tb * (n - 1);

  const r0 = Math.floor(fr);
  const g0 = Math.floor(fg);
  const b0 = Math.floor(fb);
  const r1 = Math.min(r0 + 1, n - 1);
  const g1 = Math.min(g0 + 1, n - 1);
  const b1 = Math.min(b0 + 1, n - 1);

  const dr = fr - r0;
  const dg = fg - g0;
  const db = fb - b0;

  const out: [number, number, number] = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const c000 = idx(r0, g0, b0, c);
    const c100 = idx(r1, g0, b0, c);
    const c010 = idx(r0, g1, b0, c);
    const c110 = idx(r1, g1, b0, c);
    const c001 = idx(r0, g0, b1, c);
    const c101 = idx(r1, g0, b1, c);
    const c011 = idx(r0, g1, b1, c);
    const c111 = idx(r1, g1, b1, c);

    const c00 = lerp(c000, c100, dr);
    const c10 = lerp(c010, c110, dr);
    const c01 = lerp(c001, c101, dr);
    const c11 = lerp(c011, c111, dr);

    const c0 = lerp(c00, c10, dg);
    const c1 = lerp(c01, c11, dg);

    out[c] = clamp01(lerp(c0, c1, db));
  }
  return out;
}

/**
 * Build a 3D CubeLut by sampling `fn` at every grid node g/(size-1).
 * Stored in RED-fastest order; domain defaults to [0,1].
 */
export function generateCube(size: number, fn: (rgb: RGB) => RGB): CubeLut {
  if (!Number.isInteger(size) || size < 2) {
    throw new Error(`generateCube size must be an integer >= 2, got ${size}`);
  }
  const data = new Float32Array(size * size * size * 3);
  const denom = size - 1;
  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        const sample = fn([r / denom, g / denom, b / denom]);
        const o = ((b * size + g) * size + r) * 3;
        data[o] = sample[0];
        data[o + 1] = sample[1];
        data[o + 2] = sample[2];
      }
    }
  }
  return {
    dim: 3,
    size,
    data,
    domainMin: [0, 0, 0],
    domainMax: [1, 1, 1],
  };
}

/** A 3D identity LUT of the given size. */
export function identityCube(size: number): CubeLut {
  return generateCube(size, (rgb) => rgb);
}

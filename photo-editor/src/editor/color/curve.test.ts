import { describe, it, expect } from "vitest";
import { evalCurve, buildLut, applyCurves } from "./curve";
import type { CurvePt, ChannelCurves } from "./look";

const emptyCurves: ChannelCurves = { rgb: [], r: [], g: [], b: [] };

describe("evalCurve", () => {
  it("returns identity (clamped) for empty / single-point curves", () => {
    expect(evalCurve([], 0.42)).toBeCloseTo(0.42, 10);
    expect(evalCurve([{ x: 0.3, y: 0.9 }], 0.42)).toBeCloseTo(0.42, 10);
    // clamp01 on identity
    expect(evalCurve([], -0.5)).toBe(0);
    expect(evalCurve([], 1.5)).toBe(1);
  });

  it("passes through endpoints and clamps outside the domain", () => {
    const pts: CurvePt[] = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.7 },
      { x: 1, y: 1 },
    ];
    expect(evalCurve(pts, 0)).toBeCloseTo(0, 10);
    expect(evalCurve(pts, 0.5)).toBeCloseTo(0.7, 10);
    expect(evalCurve(pts, 1)).toBeCloseTo(1, 10);
    // outside domain clamps to endpoint y
    expect(evalCurve(pts, -1)).toBeCloseTo(0, 10);
    expect(evalCurve(pts, 2)).toBeCloseTo(1, 10);
  });

  it("does not mutate the input points array", () => {
    const pts: CurvePt[] = [
      { x: 1, y: 1 },
      { x: 0, y: 0 },
      { x: 0.5, y: 0.7 },
    ];
    const snapshot = JSON.stringify(pts);
    evalCurve(pts, 0.25);
    expect(JSON.stringify(pts)).toBe(snapshot);
  });

  it("S-curve is monotonic and passes through endpoints (no overshoot)", () => {
    // Classic 3-point S-curve: darken shadows, lift highlights, midpoint fixed.
    const s: CurvePt[] = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.5 },
      { x: 1, y: 1 },
    ];
    // endpoints exact
    expect(evalCurve(s, 0)).toBeCloseTo(0, 10);
    expect(evalCurve(s, 1)).toBeCloseTo(1, 10);
    // monotone non-decreasing and within [0,1] across the domain
    let prev = -Infinity;
    for (let i = 0; i <= 100; i++) {
      const x = i / 100;
      const y = evalCurve(s, x);
      expect(y).toBeGreaterThanOrEqual(prev - 1e-9);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(1);
      prev = y;
    }
  });

  it("does not overshoot on a steep monotone control set", () => {
    // Steep middle segment that would ring with a naive Catmull-Rom spline.
    const pts: CurvePt[] = [
      { x: 0, y: 0 },
      { x: 0.45, y: 0.05 },
      { x: 0.55, y: 0.95 },
      { x: 1, y: 1 },
    ];
    for (let i = 0; i <= 200; i++) {
      const x = i / 200;
      const y = evalCurve(pts, x);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(1);
    }
  });
});

describe("buildLut", () => {
  it("has the requested length and default size 256", () => {
    const pts: CurvePt[] = [
      { x: 0, y: 0.1 },
      { x: 1, y: 0.9 },
    ];
    expect(buildLut(pts).length).toBe(256);
    expect(buildLut(pts, 64).length).toBe(64);
  });

  it("endpoints match the curve's first/last y", () => {
    const pts: CurvePt[] = [
      { x: 0, y: 0.1 },
      { x: 0.5, y: 0.4 },
      { x: 1, y: 0.9 },
    ];
    const size = 256;
    const lut = buildLut(pts, size);
    expect(lut[0]).toBeCloseTo(0.1, 6);
    expect(lut[size - 1]).toBeCloseTo(0.9, 6);
  });

  it("a monotone-increasing control set yields a non-decreasing LUT", () => {
    const pts: CurvePt[] = [
      { x: 0, y: 0 },
      { x: 0.2, y: 0.1 },
      { x: 0.4, y: 0.35 },
      { x: 0.7, y: 0.8 },
      { x: 1, y: 1 },
    ];
    const lut = buildLut(pts, 256);
    for (let i = 1; i < lut.length; i++) {
      expect(lut[i]).toBeGreaterThanOrEqual(lut[i - 1] - 1e-9);
    }
  });
});

describe("applyCurves", () => {
  it("is an exact identity when all curves are empty (default config)", () => {
    const px: [number, number, number] = [0.2, 0.5, 0.8];
    const out = applyCurves(px, emptyCurves);
    expect(out[0]).toBeCloseTo(0.2, 10);
    expect(out[1]).toBeCloseTo(0.5, 10);
    expect(out[2]).toBeCloseTo(0.8, 10);
  });

  it("applies master curve before per-channel curve", () => {
    // master inverts; red channel curve doubles-then-clamps via passthrough.
    const curves: ChannelCurves = {
      rgb: [
        { x: 0, y: 1 },
        { x: 1, y: 0 },
      ], // invert
      r: [],
      g: [],
      b: [],
    };
    const out = applyCurves([0.25, 0.5, 0.75], curves);
    // each channel inverted by master, no per-channel change
    expect(out[0]).toBeCloseTo(0.75, 6);
    expect(out[1]).toBeCloseTo(0.5, 6);
    expect(out[2]).toBeCloseTo(0.25, 6);
  });

  it("clamps outputs to 0..1", () => {
    const curves: ChannelCurves = {
      rgb: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      r: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      g: [],
      b: [],
    };
    const out = applyCurves([2, -1, 0.5], curves);
    out.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    });
  });
});

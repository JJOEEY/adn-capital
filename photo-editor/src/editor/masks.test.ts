import { describe, expect, it } from "vitest";
import { linearWeight, radialWeight, rangeLumaWeight, defaultMask } from "./masks";

describe("mask weights", () => {
  it("linear gradient ramps 0→1 along the axis and clamps", () => {
    const m = { x1: 0, y1: 0, x2: 1, y2: 0 }; // horizontal
    expect(linearWeight(0, 0, m)).toBeCloseTo(0);
    expect(linearWeight(0.5, 0.3, m)).toBeCloseTo(0.5); // perpendicular offset ignored
    expect(linearWeight(1, 0, m)).toBeCloseTo(1);
    expect(linearWeight(-0.5, 0, m)).toBe(0); // before start clamps
    expect(linearWeight(2, 0, m)).toBe(1); // past end clamps
  });

  it("radial is 1 at center and 0 outside the ellipse", () => {
    const m = defaultMask("radial").radial;
    expect(radialWeight(m.cx, m.cy, m)).toBeCloseTo(1);
    // Well outside the radius → 0.
    expect(radialWeight(m.cx + m.rx * 2, m.cy, m)).toBeCloseTo(0);
    // Monotonic falloff: nearer center ≥ farther.
    const near = radialWeight(m.cx + m.rx * 0.3, m.cy, m);
    const far = radialWeight(m.cx + m.rx * 0.7, m.cy, m);
    expect(near).toBeGreaterThanOrEqual(far);
  });

  it("luminance range selects inside the band", () => {
    const m = { lo: 0.3, hi: 0.6, feather: 0.05 };
    expect(rangeLumaWeight(0.45, m)).toBeCloseTo(1); // middle
    expect(rangeLumaWeight(0.0, m)).toBeCloseTo(0); // shadows excluded
    expect(rangeLumaWeight(1.0, m)).toBeCloseTo(0); // highlights excluded
    // transition is monotonic on the way in
    expect(rangeLumaWeight(0.45, m)).toBeGreaterThanOrEqual(rangeLumaWeight(0.31, m));
  });
});

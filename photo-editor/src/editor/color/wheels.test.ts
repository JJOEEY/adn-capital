import { describe, it, expect } from "vitest";
import { wheelTint, applyWheels } from "./wheels";
import type { RGB, Wheel, ColorWheels } from "./look";

const ZERO: Wheel = { h: 0, s: 0, l: 0 };
const zeroWheels = (): ColorWheels => ({
  shadows: { ...ZERO },
  midtones: { ...ZERO },
  highlights: { ...ZERO },
  global: { ...ZERO },
});

const close = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;

describe("wheelTint", () => {
  it("sat=0 => [0,0,0] for any hue", () => {
    for (const h of [0, 30, 90, 180, 240, 359]) {
      const t = wheelTint({ h, s: 0, l: 0 });
      expect(t[0]).toBe(0);
      expect(t[1]).toBe(0);
      expect(t[2]).toBe(0);
    }
  });

  it("is zero-sum (sums to ~0) for any hue/sat", () => {
    for (const h of [0, 30, 60, 120, 180, 240, 270, 300, 359]) {
      for (const s of [0, 0.25, 0.5, 1]) {
        const t = wheelTint({ h, s, l: 0 });
        expect(Math.abs(t[0] + t[1] + t[2])).toBeLessThan(1e-9);
      }
    }
  });

  it("red hue pushes the red channel positive", () => {
    const t = wheelTint({ h: 0, s: 1, l: 0 });
    expect(t[0]).toBeGreaterThan(0);
    expect(t[1]).toBeLessThan(0);
    expect(t[2]).toBeLessThan(0);
  });
});

describe("applyWheels", () => {
  it("all-zero wheels => exact identity (within 1e-6)", () => {
    const samples: RGB[] = [
      [0, 0, 0],
      [1, 1, 1],
      [0.5, 0.5, 0.5],
      [0.2, 0.6, 0.9],
      [0.13, 0.77, 0.41],
    ];
    for (const px of samples) {
      const out = applyWheels(px, zeroWheels());
      expect(close(out[0], px[0])).toBe(true);
      expect(close(out[1], px[1])).toBe(true);
      expect(close(out[2], px[2])).toBe(true);
    }
  });

  it("highlights.l > 0 brightens a mid-grey", () => {
    const w = zeroWheels();
    w.highlights.l = 0.5;
    const out = applyWheels([0.5, 0.5, 0.5], w);
    expect(out[0]).toBeGreaterThan(0.5);
    expect(out[1]).toBeGreaterThan(0.5);
    expect(out[2]).toBeGreaterThan(0.5);
  });

  it("shadows tint with red hue pushes shadows toward red", () => {
    const w = zeroWheels();
    w.shadows = { h: 0, s: 1, l: 0 };
    const base: RGB = [0.3, 0.3, 0.3];
    const out = applyWheels(base, w);
    // red lifted up, green/blue lowered relative to the others
    expect(out[0]).toBeGreaterThan(base[0]);
    expect(out[0]).toBeGreaterThan(out[1]);
    expect(out[0]).toBeGreaterThan(out[2]);
    expect(out[1]).toBeLessThan(base[1]);
    expect(out[2]).toBeLessThan(base[2]);
  });

  it("clamps outputs to 0..1", () => {
    const w = zeroWheels();
    w.global.l = 5;
    w.highlights.l = 5;
    const out = applyWheels([0.9, 0.9, 0.9], w);
    for (const c of out) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    }
  });
});

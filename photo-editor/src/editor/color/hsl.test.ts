import { describe, it, expect } from "vitest";
import { rgb2hsl, hsl2rgb, applyHsl } from "./hsl";
import type { RGB, HSLBand } from "./look";

const zeroBands = (): HSLBand[] =>
  Array.from({ length: 8 }, () => ({ h: 0, s: 0, l: 0 }));

const closeRGB = (a: RGB, b: RGB, eps = 1e-4) => {
  for (let i = 0; i < 3; i++) expect(a[i]).toBeCloseTo(b[i], 4);
  void eps;
};

describe("rgb2hsl <-> hsl2rgb roundtrip", () => {
  const colors: RGB[] = [
    [1, 0, 0], // red
    [0, 1, 0], // green
    [0, 0, 1], // blue
    [1, 1, 0], // yellow
    [0, 1, 1], // cyan
    [1, 0, 1], // magenta
    [0.2, 0.6, 0.8], // arbitrary saturated
    [0.9, 0.4, 0.1],
    [0.5, 0.5, 0.5], // grey
    [0, 0, 0], // black
    [1, 1, 1], // white
  ];

  it("roundtrips within 1e-4", () => {
    for (const c of colors) {
      const back = hsl2rgb(rgb2hsl(c));
      closeRGB(back, c);
    }
  });

  it("produces expected HSL for pure red", () => {
    const [h, s, l] = rgb2hsl([1, 0, 0]);
    expect(h).toBeCloseTo(0, 4);
    expect(s).toBeCloseTo(1, 4);
    expect(l).toBeCloseTo(0.5, 4);
  });
});

describe("applyHsl", () => {
  it("all-zero bands => identity", () => {
    const inputs: RGB[] = [
      [1, 0, 0],
      [0.2, 0.6, 0.8],
      [0.5, 0.5, 0.5],
      [0.1, 0.9, 0.3],
    ];
    for (const c of inputs) {
      const out = applyHsl(c, zeroBands());
      expect(out).toEqual(c);
    }
  });

  it("default/zero configuration is an exact no-op", () => {
    const c: RGB = [0.37, 0.62, 0.81];
    expect(applyHsl(c, zeroBands())).toEqual(c);
  });

  it("Red band s=+1 increases saturation of a pure-red pixel", () => {
    const red: RGB = [1, 0, 0];
    const bands = zeroBands();
    bands[0] = { h: 0, s: 1, l: 0 }; // Red band, full saturation boost
    const out = applyHsl(red, bands);
    const sBefore = rgb2hsl(red)[1];
    const sAfter = rgb2hsl(out)[1];
    // Pure red is already fully saturated (s=1), so it cannot increase further;
    // use a less-saturated red to observe the boost.
    expect(sAfter).toBeGreaterThanOrEqual(sBefore - 1e-9);

    const dullRed: RGB = hsl2rgb([0, 0.4, 0.5]);
    const out2 = applyHsl(dullRed, bands);
    expect(rgb2hsl(out2)[1]).toBeGreaterThan(rgb2hsl(dullRed)[1]);
  });

  it("grey pixel (S=0) is unchanged by any band", () => {
    const grey: RGB = [0.5, 0.5, 0.5];
    for (let i = 0; i < 8; i++) {
      const bands = zeroBands();
      bands[i] = { h: 1, s: 1, l: 1 };
      expect(applyHsl(grey, bands)).toEqual(grey);
    }
  });

  it("Red band hue shift rotates a red pixel's hue", () => {
    const red: RGB = [1, 0, 0];
    const bands = zeroBands();
    bands[0] = { h: 1, s: 0, l: 0 }; // +30° max shift on Red center
    const out = applyHsl(red, bands);
    const hAfter = rgb2hsl(out)[0];
    expect(hAfter).toBeGreaterThan(0);
    expect(hAfter).toBeLessThanOrEqual(30 + 1e-6);
  });
});

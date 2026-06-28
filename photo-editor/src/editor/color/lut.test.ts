import { describe, it, expect } from "vitest";
import {
  parseCube,
  serializeCube,
  applyCube,
  generateCube,
  identityCube,
  type CubeLut,
} from "./lut";
import type { RGB } from "./look";

const invert = (rgb: RGB): RGB => [1 - rgb[0], 1 - rgb[1], 1 - rgb[2]];

const samples: RGB[] = [
  [0, 0, 0],
  [1, 1, 1],
  [0.5, 0.5, 0.5],
  [0.2, 0.6, 0.9],
  [0.13, 0.77, 0.41],
  [0.91, 0.04, 0.33],
];

describe("identityCube — identity (no-op) at default config", () => {
  it("applied to colors returns ~the same color (trilinear identity)", () => {
    const lut = identityCube(17);
    for (const px of samples) {
      const out = applyCube(lut, px);
      expect(out[0]).toBeCloseTo(px[0], 4);
      expect(out[1]).toBeCloseTo(px[1], 4);
      expect(out[2]).toBeCloseTo(px[2], 4);
    }
  });

  it("a tiny 2x2x2 identity is still exact at non-grid points", () => {
    const lut = identityCube(2);
    for (const px of samples) {
      const out = applyCube(lut, px);
      // Trilinear interpolation of the identity corners is exactly linear.
      expect(out[0]).toBeCloseTo(px[0], 6);
      expect(out[1]).toBeCloseTo(px[1], 6);
      expect(out[2]).toBeCloseTo(px[2], 6);
    }
  });
});

describe("serializeCube / parseCube round-trip", () => {
  it("parseCube(serializeCube(lut)) deep-equals lut", () => {
    const base = generateCube(9, (rgb) => [
      rgb[0] * rgb[0],
      Math.sqrt(rgb[1]),
      1 - rgb[2],
    ]);
    base.title = "Lumen Test Look";

    const round = parseCube(serializeCube(base));
    expect(round.dim).toBe(base.dim);
    expect(round.size).toBe(base.size);
    expect(round.title).toBe(base.title);
    expect(round.domainMin).toEqual(base.domainMin);
    expect(round.domainMax).toEqual(base.domainMax);
    expect(round.data.length).toBe(base.data.length);
    for (let i = 0; i < base.data.length; i++) {
      expect(round.data[i]).toBeCloseTo(base.data[i], 5);
    }
  });

  it("round-trips a 1D LUT and non-default domain", () => {
    const lut: CubeLut = {
      dim: 1,
      size: 5,
      data: Float32Array.from([
        0, 0, 0, 0.25, 0.2, 0.3, 0.5, 0.4, 0.6, 0.75, 0.6, 0.9, 1, 1, 1,
      ]),
      domainMin: [0, 0, 0],
      domainMax: [2, 2, 2],
    };
    const round = parseCube(serializeCube(lut));
    expect(round.dim).toBe(1);
    expect(round.size).toBe(5);
    expect(round.domainMax).toEqual([2, 2, 2]);
    for (let i = 0; i < lut.data.length; i++) {
      expect(round.data[i]).toBeCloseTo(lut.data[i], 5);
    }
  });
});

describe("generateCube approximates the source function", () => {
  it("invert LUT applied ~= invert(rgb) within interpolation error", () => {
    const lut = generateCube(17, invert);
    for (const px of samples) {
      const out = applyCube(lut, px);
      const exact = invert(px);
      expect(out[0]).toBeCloseTo(exact[0], 4);
      expect(out[1]).toBeCloseTo(exact[1], 4);
      expect(out[2]).toBeCloseTo(exact[2], 4);
    }
  });
});

describe("hand-written 2x2x2 .cube", () => {
  // RED-fastest ordering. We make output = input on R and G, but set BLUE's
  // output to 0 at b=0 and 1 at b=1 (matching identity blue), and bump the
  // R channel by +0.1 at the b=1 plane so the midpoint is non-trivial.
  const text = `
# A small hand-written cube
TITLE "tiny"
LUT_3D_SIZE 2
DOMAIN_MIN 0 0 0
DOMAIN_MAX 1 1 1
0.0 0.0 0.0
1.0 0.0 0.0
0.0 1.0 0.0
1.0 1.0 0.0
0.1 0.0 1.0
1.1 0.0 1.0
0.1 1.0 1.0
1.1 1.0 1.0
`;

  it("parses size, dim, title and corner values", () => {
    const lut = parseCube(text);
    expect(lut.dim).toBe(3);
    expect(lut.size).toBe(2);
    expect(lut.title).toBe("tiny");

    // corner r=1,g=1,b=0  =>  flatIndex ((0*2+1)*2+1)*3 = 9
    const o = ((0 * 2 + 1) * 2 + 1) * 3;
    expect(lut.data[o]).toBeCloseTo(1.0, 6);
    expect(lut.data[o + 1]).toBeCloseTo(1.0, 6);
    expect(lut.data[o + 2]).toBeCloseTo(0.0, 6);

    // exact corner via applyCube at (1,1,0)
    const corner = applyCube(lut, [1, 1, 0]);
    expect(corner[0]).toBeCloseTo(1, 6);
    expect(corner[1]).toBeCloseTo(1, 6);
    expect(corner[2]).toBeCloseTo(0, 6);
  });

  it("computes a known trilinear midpoint", () => {
    const lut = parseCube(text);
    const mid = applyCube(lut, [0.5, 0.5, 0.5]);

    // Trilinear over the 8 corners at (0.5,0.5,0.5) = average of all 8.
    // R: avg(0,1,0,1, 0.1,1.1,0.1,1.1) = 4.4/8 = 0.55
    // G: avg(0,0,1,1, 0,0,1,1) = 4/8 = 0.5
    // B: avg(0,0,0,0, 1,1,1,1) = 4/8 = 0.5
    expect(mid[0]).toBeCloseTo(0.55, 5);
    expect(mid[1]).toBeCloseTo(0.5, 5);
    expect(mid[2]).toBeCloseTo(0.5, 5);
  });
});

describe("parseCube throws on malformed input", () => {
  it("throws when the size keyword is missing", () => {
    expect(() => parseCube("0 0 0\n1 1 1\n")).toThrow();
  });

  it("throws on a data row with the wrong arity", () => {
    const bad = `LUT_1D_SIZE 2
0 0
1 1 1`;
    expect(() => parseCube(bad)).toThrow();
  });

  it("throws on a data row count mismatch", () => {
    const bad = `LUT_3D_SIZE 2
0 0 0
1 1 1`;
    expect(() => parseCube(bad)).toThrow();
  });
});

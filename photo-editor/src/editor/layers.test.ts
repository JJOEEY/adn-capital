import { describe, expect, it } from "vitest";
import { blendChannel, blendRGB } from "./layers";

describe("blend modes", () => {
  it("normal returns the source", () => {
    expect(blendChannel("normal", 0.2, 0.8)).toBe(0.8);
  });
  it("multiply darkens, screen lightens", () => {
    expect(blendChannel("multiply", 0.5, 0.5)).toBeCloseTo(0.25);
    expect(blendChannel("screen", 0.5, 0.5)).toBeCloseTo(0.75);
  });
  it("darken/lighten pick the extreme", () => {
    expect(blendChannel("darken", 0.3, 0.7)).toBe(0.3);
    expect(blendChannel("lighten", 0.3, 0.7)).toBe(0.7);
  });
  it("difference is symmetric magnitude", () => {
    expect(blendChannel("difference", 0.9, 0.4)).toBeCloseTo(0.5);
  });
  it("overlay equals screen/ multiply on the two halves", () => {
    // dark base → multiply-like, bright base → screen-like
    expect(blendChannel("overlay", 0.25, 0.5)).toBeCloseTo(0.25); // 2*0.25*0.5
    expect(blendChannel("overlay", 0.75, 0.5)).toBeCloseTo(0.75);
  });
  it("opacity 0 keeps the base, opacity 1 applies the blend", () => {
    const base: [number, number, number] = [0.2, 0.4, 0.6];
    const layer: [number, number, number] = [0.8, 0.8, 0.8];
    expect(blendRGB("multiply", base, layer, 0)).toEqual(base);
    const full = blendRGB("multiply", base, layer, 1);
    expect(full[0]).toBeCloseTo(0.16);
  });
});

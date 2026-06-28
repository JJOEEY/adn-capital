import { describe, expect, it } from "vitest";
import { cloneRecipe, DEFAULT_RECIPE, recipesEqual } from "./recipe";
import { identityCube } from "./color/lut";

describe("recipe equality / cloning", () => {
  it("default recipe equals its clone", () => {
    expect(recipesEqual(DEFAULT_RECIPE, cloneRecipe(DEFAULT_RECIPE))).toBe(true);
  });

  it("detects a scalar difference", () => {
    const a = cloneRecipe(DEFAULT_RECIPE);
    const b = cloneRecipe(DEFAULT_RECIPE);
    b.exposure = 1;
    expect(recipesEqual(a, b)).toBe(false);
  });

  // Regression: a CubeLut.data is a Float32Array; persisting a preset via
  // JSON.stringify/parse turns it into a plain indexed object with no .length/.every.
  // recipesEqual must not throw and must still compare correctly.
  it("survives a JSON-roundtripped LUT (Float32Array lost to a plain object)", () => {
    const withLut = { ...cloneRecipe(DEFAULT_RECIPE), lut: identityCube(2) };
    const restored = JSON.parse(JSON.stringify(withLut)); // data -> {0:..,1:..}
    expect(restored.lut.data instanceof Float32Array).toBe(false);
    expect(() => recipesEqual(withLut, restored)).not.toThrow();
    expect(recipesEqual(withLut, restored)).toBe(true);
  });
});

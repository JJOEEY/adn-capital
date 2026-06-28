import { describe, expect, it } from "vitest";
import { cloneRecipe, DEFAULT_RECIPE, recipesEqual, reviveRecipe, Recipe } from "./recipe";
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

  // Regression: a recipe serialized before M4 has no `bg` field; reviveRecipe must
  // backfill it so the render pipeline / clone / equality never read undefined.
  it("backfills a missing bg field on legacy recipes", () => {
    const legacy = { ...cloneRecipe(DEFAULT_RECIPE) } as Partial<Recipe>;
    delete legacy.bg;
    const revived = reviveRecipe(legacy as Recipe);
    expect(revived.bg).toEqual({ mode: "none", color: [1, 1, 1] });
    expect(() => cloneRecipe(revived)).not.toThrow();
    expect(() => recipesEqual(revived, DEFAULT_RECIPE)).not.toThrow();
  });
});

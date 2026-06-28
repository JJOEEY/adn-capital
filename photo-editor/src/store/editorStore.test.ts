import { beforeEach, describe, expect, it } from "vitest";
import { useEditorStore } from "./editorStore";
import { cloneRecipe, DEFAULT_RECIPE } from "../editor/recipe";

const S = useEditorStore;

beforeEach(() => {
  S.setState({
    recipe: cloneRecipe(DEFAULT_RECIPE),
    baseline: cloneRecipe(DEFAULT_RECIPE),
    past: [],
    future: [],
    selectedMaskId: null,
  });
});

describe("undo / redo history", () => {
  it("a single undo reverts the last committed gesture", () => {
    S.getState().setAdjust("exposure", 1);
    S.getState().commit();
    expect(S.getState().recipe.exposure).toBe(1);

    S.getState().undo();
    expect(S.getState().recipe.exposure).toBe(0); // one press, not two
  });

  it("redo restores exactly the undone state", () => {
    S.getState().setAdjust("contrast", 40);
    S.getState().commit();
    S.getState().setAdjust("contrast", 80);
    S.getState().commit();

    S.getState().undo();
    expect(S.getState().recipe.contrast).toBe(40);
    S.getState().undo();
    expect(S.getState().recipe.contrast).toBe(0);

    S.getState().redo();
    expect(S.getState().recipe.contrast).toBe(40);
    S.getState().redo();
    expect(S.getState().recipe.contrast).toBe(80);
  });

  it("a new edit clears the redo stack", () => {
    S.getState().setAdjust("exposure", 2);
    S.getState().commit();
    S.getState().undo();
    S.getState().setAdjust("exposure", -1);
    S.getState().commit();
    expect(S.getState().future).toHaveLength(0);
    expect(S.getState().recipe.exposure).toBe(-1);
  });

  it("adding then undoing a local adjustment removes it in one step", () => {
    S.getState().addLocal("radial");
    expect(S.getState().recipe.localAdjustments).toHaveLength(1);
    S.getState().undo();
    expect(S.getState().recipe.localAdjustments).toHaveLength(0);
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { useEditorStore, LayerImage } from "./editorStore";
import { cloneRecipe, DEFAULT_RECIPE } from "../editor/recipe";
import { newLayerProps } from "../editor/layers";

const S = useEditorStore;

beforeEach(() => {
  S.setState({
    recipe: cloneRecipe(DEFAULT_RECIPE),
    baseline: cloneRecipe(DEFAULT_RECIPE),
    past: [],
    future: [],
    layers: [],
    layerCache: new Map(),
    selectedMaskId: null,
  });
});

const fakeLayer = (id: string): LayerImage => ({
  id,
  bitmap: {} as ImageBitmap,
  width: 10,
  height: 10,
  name: id,
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

  it("removing then undoing a layer resurrects its pixels (no ghost row)", () => {
    S.getState().addLayer(fakeLayer("L1"));
    expect(S.getState().layers).toHaveLength(1);
    S.getState().removeLayer("L1");
    expect(S.getState().layers).toHaveLength(0);
    S.getState().undo();
    expect(S.getState().recipe.layerStack).toHaveLength(1);
    expect(S.getState().layers).toHaveLength(1); // pixels restored, not a ghost
  });

  it("applyRecipe drops layer props with no available pixels (catalog ghost)", () => {
    const r = cloneRecipe(DEFAULT_RECIPE);
    r.layerStack = [newLayerProps("ghost", "G")];
    S.getState().applyRecipe(r);
    expect(S.getState().recipe.layerStack).toHaveLength(0);
    expect(S.getState().layers).toHaveLength(0);
  });
});

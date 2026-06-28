// Central editor state: the loaded image, the active recipe, and an undo/redo
// history of recipes. UI components subscribe to slices of this store.

import { create } from "zustand";
import { BackgroundOp, cloneRecipe, DEFAULT_RECIPE, Recipe, recipesEqual } from "../editor/recipe";
import { Look } from "../editor/color/look";
import { CubeLut } from "../editor/color/lut";
import { LocalAdjustment, MaskKind, newLocalAdjustment } from "../editor/masks";
import { LayerProps, newLayerProps } from "../editor/layers";

export interface LoadedImage {
  bitmap: ImageBitmap;
  width: number;
  height: number;
  name: string;
  path?: string; // native filesystem path (desktop only) — used for AI matting
}

// A foreground alpha matte at the source resolution (M4). Kept out of the recipe
// because it is image-sized; the recipe only stores how to composite it (recipe.bg).
export interface ImageMask {
  data: Uint8Array; // single-channel alpha, width*height
  width: number;
  height: number;
}

// A composited image layer's pixels (Pillar 2). Properties (opacity/blend/order)
// live in recipe.layerStack, linked by id.
export interface LayerImage {
  id: string;
  bitmap: ImageBitmap;
  width: number;
  height: number;
  name: string;
}

interface EditorState {
  image: LoadedImage | null;
  mask: ImageMask | null; // AI foreground matte (M4)
  layers: LayerImage[]; // composited layer pixels (Pillar 2)
  recipe: Recipe;
  baseline: Recipe; // last committed state (current edits live in `recipe`)
  past: Recipe[]; // states we can undo to
  future: Recipe[]; // states we can redo to
  showOriginal: boolean; // hold-to-compare (before/after)
  selectedMaskId: string | null; // local adjustment being edited (for the panel + overlay)

  setImage: (img: LoadedImage) => void;
  setAdjust: (key: keyof Recipe, value: number) => void;
  setLook: (look: Look) => void; // live color-grade update (no history; commit on release)
  setLut: (lut: CubeLut | null) => void; // import/clear 3D LUT (own history step)
  setMask: (mask: ImageMask | null) => void; // AI matte result
  setBg: (bg: BackgroundOp) => void; // background compositing mode (own history step)
  addLocal: (kind: MaskKind) => void;
  updateLocal: (id: string, mutate: (la: LocalAdjustment) => void) => void; // live; commit on release
  removeLocal: (id: string) => void;
  selectMask: (id: string | null) => void;
  addLayer: (layer: LayerImage) => void;
  updateLayer: (id: string, mutate: (p: LayerProps) => void) => void; // live; commit on release
  removeLayer: (id: string) => void;
  moveLayer: (id: string, dir: -1 | 1) => void;
  commit: () => void; // push current recipe onto history (call on slider release)
  reset: () => void;
  applyRecipe: (r: Recipe) => void; // e.g. when applying a preset
  undo: () => void;
  redo: () => void;
  setShowOriginal: (v: boolean) => void;
}

const HISTORY_LIMIT = 100;

export const useEditorStore = create<EditorState>((set, get) => ({
  image: null,
  mask: null,
  layers: [],
  recipe: cloneRecipe(DEFAULT_RECIPE),
  baseline: cloneRecipe(DEFAULT_RECIPE),
  past: [],
  future: [],
  showOriginal: false,
  selectedMaskId: null,

  setImage: (img) =>
    set({
      image: img,
      mask: null,
      layers: [],
      recipe: cloneRecipe(DEFAULT_RECIPE),
      baseline: cloneRecipe(DEFAULT_RECIPE),
      past: [],
      future: [],
      selectedMaskId: null,
    }),

  // Live update while dragging — does NOT touch history (avoids one entry per pixel).
  setAdjust: (key, value) =>
    set((s) => ({ recipe: { ...s.recipe, [key]: value } })),

  // Live color-grade update (curve drag, wheel drag, HSL slider). Commit on release.
  setLook: (look) => set((s) => ({ recipe: { ...s.recipe, look } })),

  // Importing/clearing a LUT is a discrete action → its own history step.
  setLut: (lut) => {
    get().commit();
    set((s) => ({ recipe: { ...s.recipe, lut } }));
    get().commit();
  },

  setMask: (mask) => set({ mask }),

  // Background mode is a discrete action → its own history step.
  setBg: (bg) => {
    get().commit();
    set((s) => ({ recipe: { ...s.recipe, bg } }));
    get().commit();
  },

  addLocal: (kind) => {
    get().commit();
    const la = newLocalAdjustment(kind);
    set((s) => ({
      recipe: { ...s.recipe, localAdjustments: [...s.recipe.localAdjustments, la] },
      selectedMaskId: la.id,
    }));
    get().commit();
  },

  // Live edit of a local adjustment (slider/handle drag) — commit on release.
  updateLocal: (id, mutate) =>
    set((s) => ({
      recipe: {
        ...s.recipe,
        localAdjustments: s.recipe.localAdjustments.map((l) => {
          if (l.id !== id) return l;
          const next = structuredClone(l);
          mutate(next);
          return next;
        }),
      },
    })),

  removeLocal: (id) => {
    get().commit();
    set((s) => ({
      recipe: {
        ...s.recipe,
        localAdjustments: s.recipe.localAdjustments.filter((l) => l.id !== id),
      },
      selectedMaskId: s.selectedMaskId === id ? null : s.selectedMaskId,
    }));
    get().commit();
  },

  selectMask: (id) => set({ selectedMaskId: id }),

  addLayer: (layer) => {
    get().commit();
    set((s) => ({
      layers: [...s.layers, layer],
      recipe: {
        ...s.recipe,
        layerStack: [...s.recipe.layerStack, newLayerProps(layer.id, layer.name)],
      },
    }));
    get().commit();
  },

  // Live edit of layer props (opacity drag) — commit on release. Discrete changes
  // (blend/visibility) should call commit() right after.
  updateLayer: (id, mutate) =>
    set((s) => ({
      recipe: {
        ...s.recipe,
        layerStack: s.recipe.layerStack.map((p) => {
          if (p.id !== id) return p;
          const next = { ...p };
          mutate(next);
          return next;
        }),
      },
    })),

  removeLayer: (id) => {
    get().commit();
    set((s) => ({
      layers: s.layers.filter((l) => l.id !== id),
      recipe: { ...s.recipe, layerStack: s.recipe.layerStack.filter((p) => p.id !== id) },
    }));
    get().commit();
  },

  moveLayer: (id, dir) => {
    get().commit();
    set((s) => {
      const stack = [...s.recipe.layerStack];
      const i = stack.findIndex((p) => p.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= stack.length) return {} as Partial<EditorState>;
      [stack[i], stack[j]] = [stack[j], stack[i]];
      return { recipe: { ...s.recipe, layerStack: stack } };
    });
    get().commit();
  },

  // Commit the live recipe as a new history step. `baseline` holds the last
  // committed state; on commit the OLD baseline moves to `past` and becomes the
  // point a single undo returns to (so the first undo always reverts the gesture).
  commit: () =>
    set((s) => {
      if (recipesEqual(s.recipe, s.baseline)) return {} as Partial<EditorState>;
      const past = [...s.past, s.baseline].slice(-HISTORY_LIMIT);
      return { past, baseline: cloneRecipe(s.recipe), future: [] };
    }),

  reset: () => {
    set({ recipe: cloneRecipe(DEFAULT_RECIPE) });
    get().commit();
  },

  applyRecipe: (r) => {
    set({ recipe: cloneRecipe(r) });
    get().commit();
  },

  undo: () =>
    set((s) => {
      if (s.past.length === 0) return {} as Partial<EditorState>;
      const past = [...s.past];
      const prev = past.pop()!;
      return {
        past,
        future: [s.baseline, ...s.future],
        baseline: prev,
        recipe: cloneRecipe(prev),
      };
    }),

  redo: () =>
    set((s) => {
      if (s.future.length === 0) return {} as Partial<EditorState>;
      const [next, ...rest] = s.future;
      return {
        past: [...s.past, s.baseline],
        future: rest,
        baseline: next,
        recipe: cloneRecipe(next),
      };
    }),

  setShowOriginal: (v) => set({ showOriginal: v }),
}));

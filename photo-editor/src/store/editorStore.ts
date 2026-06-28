// Central editor state: the loaded image, the active recipe, and an undo/redo
// history of recipes. UI components subscribe to slices of this store.

import { create } from "zustand";
import { BackgroundOp, cloneRecipe, DEFAULT_RECIPE, Recipe, recipesEqual } from "../editor/recipe";
import { Look } from "../editor/color/look";
import { CubeLut } from "../editor/color/lut";
import { LocalAdjustment, MaskKind, newLocalAdjustment } from "../editor/masks";
import { LayerProps, newLayerProps } from "../editor/layers";
import { HealSpot, newHealSpot } from "../editor/heal";

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
  layers: LayerImage[]; // ACTIVE layer pixels (derived: layerStack ∩ layerCache, in order)
  layerCache: Map<string, LayerImage>; // every layer added this session (retained for undo)
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
  selectedSpotId: string | null;
  addSpot: () => void;
  updateSpot: (id: string, mutate: (s: HealSpot) => void) => void; // live; commit on release
  removeSpot: (id: string) => void;
  selectSpot: (id: string | null) => void;
  commit: () => void; // push current recipe onto history (call on slider release)
  reset: () => void;
  applyRecipe: (r: Recipe, opts?: { keepLayers?: boolean }) => void; // presets/catalog restore
  clipboardRecipe: Recipe | null; // copied develop settings
  copySettings: () => void; // copy current recipe (look + adjustments, not layers)
  pasteSettings: () => void; // apply copied settings to the current image
  undo: () => void;
  redo: () => void;
  setShowOriginal: (v: boolean) => void;
}

const HISTORY_LIMIT = 100;

export const useEditorStore = create<EditorState>((set, get) => ({
  image: null,
  mask: null,
  layers: [],
  layerCache: new Map(),
  recipe: cloneRecipe(DEFAULT_RECIPE),
  baseline: cloneRecipe(DEFAULT_RECIPE),
  past: [],
  future: [],
  showOriginal: false,
  selectedMaskId: null,
  selectedSpotId: null,

  setImage: (img) =>
    set({
      image: img,
      mask: null,
      layers: [],
      layerCache: new Map(),
      recipe: cloneRecipe(DEFAULT_RECIPE),
      baseline: cloneRecipe(DEFAULT_RECIPE),
      past: [],
      future: [],
      selectedMaskId: null,
      selectedSpotId: null,
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

  addSpot: () => {
    get().commit();
    const sp = newHealSpot();
    set((s) => ({
      recipe: { ...s.recipe, spots: [...s.recipe.spots, sp] },
      selectedSpotId: sp.id,
    }));
    get().commit();
  },
  updateSpot: (id, mutate) =>
    set((s) => ({
      recipe: {
        ...s.recipe,
        spots: s.recipe.spots.map((sp) => {
          if (sp.id !== id) return sp;
          const next = { ...sp };
          mutate(next);
          return next;
        }),
      },
    })),
  removeSpot: (id) => {
    get().commit();
    set((s) => ({
      recipe: { ...s.recipe, spots: s.recipe.spots.filter((sp) => sp.id !== id) },
      selectedSpotId: s.selectedSpotId === id ? null : s.selectedSpotId,
    }));
    get().commit();
  },
  selectSpot: (id) => set({ selectedSpotId: id }),

  clipboardRecipe: null,
  copySettings: () => {
    const r = cloneRecipe(get().recipe);
    r.layerStack = []; // settings are portable; image layers are not
    set({ clipboardRecipe: r });
  },
  pasteSettings: () => {
    const clip = get().clipboardRecipe;
    if (clip) get().applyRecipe(clip, { keepLayers: true });
  },

  addLayer: (layer) => {
    get().commit();
    set((s) => {
      const layerCache = new Map(s.layerCache).set(layer.id, layer);
      const layerStack = [...s.recipe.layerStack, newLayerProps(layer.id, layer.name)];
      return {
        layerCache,
        recipe: { ...s.recipe, layerStack },
        layers: deriveLayers(layerStack, layerCache),
      };
    });
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

  // Keep the pixels in layerCache so undo can resurrect a removed layer.
  removeLayer: (id) => {
    get().commit();
    set((s) => {
      const layerStack = s.recipe.layerStack.filter((p) => p.id !== id);
      return { recipe: { ...s.recipe, layerStack }, layers: deriveLayers(layerStack, s.layerCache) };
    });
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
      return { recipe: { ...s.recipe, layerStack: stack }, layers: deriveLayers(stack, s.layerCache) };
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

  applyRecipe: (r, opts) => {
    const s = get();
    const cloned = cloneRecipe(r);
    if (opts?.keepLayers) {
      // Presets are looks, not compositions — keep the current image's layers.
      cloned.layerStack = s.recipe.layerStack.map((p) => ({ ...p }));
      set({ recipe: cloned });
    } else {
      // Catalog restore: keep only layer props whose pixels we still have (others
      // would be un-renderable ghost rows from a previous session).
      cloned.layerStack = cloned.layerStack.filter((p) => s.layerCache.has(p.id));
      set({ recipe: cloned, layers: deriveLayers(cloned.layerStack, s.layerCache) });
    }
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
        layers: deriveLayers(prev.layerStack, s.layerCache),
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
        layers: deriveLayers(next.layerStack, s.layerCache),
      };
    }),

  setShowOriginal: (v) => set({ showOriginal: v }),
}));

// Active layer pixels = the layerStack ids that have cached pixels, in stack order.
function deriveLayers(
  stack: LayerProps[],
  cache: Map<string, LayerImage>
): LayerImage[] {
  return stack.map((p) => cache.get(p.id)).filter((l): l is LayerImage => l !== undefined);
}

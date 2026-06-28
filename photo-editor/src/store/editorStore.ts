// Central editor state: the loaded image, the active recipe, and an undo/redo
// history of recipes. UI components subscribe to slices of this store.

import { create } from "zustand";
import { BackgroundOp, cloneRecipe, DEFAULT_RECIPE, Recipe, recipesEqual } from "../editor/recipe";
import { Look } from "../editor/color/look";
import { CubeLut } from "../editor/color/lut";
import { LocalAdjustment, MaskKind, newLocalAdjustment } from "../editor/masks";

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

interface EditorState {
  image: LoadedImage | null;
  mask: ImageMask | null; // AI foreground matte (M4)
  recipe: Recipe;
  past: Recipe[];
  future: Recipe[];
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
  recipe: cloneRecipe(DEFAULT_RECIPE),
  past: [],
  future: [],
  showOriginal: false,
  selectedMaskId: null,

  setImage: (img) =>
    set({
      image: img,
      mask: null,
      recipe: cloneRecipe(DEFAULT_RECIPE),
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

  // Snapshot the recipe at the moment a gesture ends so undo steps are meaningful.
  commit: () =>
    set((s) => {
      const last = s.past[s.past.length - 1];
      if (last && recipesEqual(last, s.recipe)) return {} as Partial<EditorState>;
      const past = [...s.past, cloneRecipe(s.recipe)].slice(-HISTORY_LIMIT);
      return { past, future: [] };
    }),

  reset: () => {
    get().commit();
    set({ recipe: cloneRecipe(DEFAULT_RECIPE) });
    get().commit();
  },

  applyRecipe: (r) => {
    get().commit();
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
        future: [cloneRecipe(s.recipe), ...s.future],
        recipe: prev,
      };
    }),

  redo: () =>
    set((s) => {
      if (s.future.length === 0) return {} as Partial<EditorState>;
      const [next, ...rest] = s.future;
      return {
        past: [...s.past, cloneRecipe(s.recipe)],
        future: rest,
        recipe: next,
      };
    }),

  setShowOriginal: (v) => set({ showOriginal: v }),
}));

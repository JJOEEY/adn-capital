// Central editor state: the loaded image, the active recipe, and an undo/redo
// history of recipes. UI components subscribe to slices of this store.

import { create } from "zustand";
import { cloneRecipe, DEFAULT_RECIPE, Recipe, recipesEqual } from "../editor/recipe";
import { Look } from "../editor/color/look";
import { CubeLut } from "../editor/color/lut";

export interface LoadedImage {
  bitmap: ImageBitmap;
  width: number;
  height: number;
  name: string;
}

interface EditorState {
  image: LoadedImage | null;
  recipe: Recipe;
  past: Recipe[];
  future: Recipe[];
  showOriginal: boolean; // hold-to-compare (before/after)

  setImage: (img: LoadedImage) => void;
  setAdjust: (key: keyof Recipe, value: number) => void;
  setLook: (look: Look) => void; // live color-grade update (no history; commit on release)
  setLut: (lut: CubeLut | null) => void; // import/clear 3D LUT (own history step)
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
  recipe: cloneRecipe(DEFAULT_RECIPE),
  past: [],
  future: [],
  showOriginal: false,

  setImage: (img) =>
    set({
      image: img,
      recipe: cloneRecipe(DEFAULT_RECIPE),
      past: [],
      future: [],
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

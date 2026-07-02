// Wires the editor to the catalog: when an image opens, restore its saved edits;
// while editing, auto-save the recipe (debounced) with a thumbnail. Switching images
// flushes the outgoing image's latest edit so nothing in the debounce window is lost.

import { useEffect, useRef } from "react";
import { recipesEqual, Recipe } from "../editor/recipe";
import { getEntry, makeKey, makeThumb, saveEntry } from "../lib/catalog";
import { LoadedImage, useEditorStore } from "./editorStore";

export function useCatalogSync() {
  const image = useEditorStore((s) => s.image);
  const recipe = useEditorStore((s) => s.recipe);
  const applyRecipe = useEditorStore((s) => s.applyRecipe);
  const thumb = useRef("");
  const restored = useRef<Recipe | null>(null);
  const pending = useRef<{ img: LoadedImage; recipe: Recipe } | null>(null);

  // On open: snapshot a thumbnail and restore saved edits. On switch/unmount, flush
  // the previous image's latest edit synchronously.
  useEffect(() => {
    if (!image) return;
    thumb.current = makeThumb(image);
    const entry = getEntry(makeKey(image));
    restored.current = entry?.recipe ?? null;
    if (entry) applyRecipe(entry.recipe);
    return () => {
      const p = pending.current;
      if (p) saveEntry(p.img, p.recipe, thumb.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image]);

  // Auto-save after edits settle; track the latest unsaved edit for the flush above.
  useEffect(() => {
    if (!image) return;
    pending.current = { img: image, recipe };
    if (restored.current && recipesEqual(recipe, restored.current)) return;
    const t = setTimeout(() => saveEntry(image, recipe, thumb.current), 600);
    return () => clearTimeout(t);
  }, [image, recipe]);
}

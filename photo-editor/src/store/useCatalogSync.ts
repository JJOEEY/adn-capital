// Wires the editor to the catalog: when an image opens, restore its saved edits;
// while editing, auto-save the recipe (debounced) with a thumbnail.

import { useEffect, useRef } from "react";
import { recipesEqual, Recipe } from "../editor/recipe";
import { getEntry, makeKey, makeThumb, saveEntry } from "../lib/catalog";
import { useEditorStore } from "./editorStore";

export function useCatalogSync() {
  const image = useEditorStore((s) => s.image);
  const recipe = useEditorStore((s) => s.recipe);
  const applyRecipe = useEditorStore((s) => s.applyRecipe);
  const thumb = useRef("");
  const restored = useRef<Recipe | null>(null); // the recipe applied on open

  // On open: snapshot a thumbnail and restore any saved edits for this image.
  useEffect(() => {
    if (!image) return;
    thumb.current = makeThumb(image);
    const entry = getEntry(makeKey(image));
    restored.current = entry?.recipe ?? null;
    if (entry) applyRecipe(entry.recipe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image]);

  // Auto-save after edits settle — but skip the no-op save right after restoring.
  useEffect(() => {
    if (!image) return;
    if (restored.current && recipesEqual(recipe, restored.current)) return;
    const t = setTimeout(() => saveEntry(image, recipe, thumb.current), 600);
    return () => clearTimeout(t);
  }, [image, recipe]);
}

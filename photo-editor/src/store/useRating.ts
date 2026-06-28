// Rating + flag for the current image, persisted in the catalog. Reads re-run when
// the catalog version bumps; writes ensure a catalog entry exists first.

import { Flag, getEntry, makeKey, saveEntry, setMeta } from "../lib/catalog";
import { useEditorStore } from "./editorStore";
import { useCatalogStore } from "./useCatalogStore";

export function useRating() {
  const image = useEditorStore((s) => s.image);
  const recipe = useEditorStore((s) => s.recipe);
  useCatalogStore((s) => s.version); // re-render on catalog change
  const bump = useCatalogStore((s) => s.bump);

  const entry = image ? getEntry(makeKey(image)) : undefined;

  const ensure = () => {
    if (image && !getEntry(makeKey(image))) saveEntry(image, recipe);
  };
  const setRating = (n: number) => {
    if (!image) return;
    ensure();
    setMeta(makeKey(image), { rating: n });
    bump();
  };
  const setFlag = (f: Flag) => {
    if (!image) return;
    ensure();
    setMeta(makeKey(image), { flag: f });
    bump();
  };

  return {
    hasImage: !!image,
    rating: entry?.rating ?? 0,
    flag: entry?.flag ?? ("none" as Flag),
    setRating,
    setFlag,
  };
}

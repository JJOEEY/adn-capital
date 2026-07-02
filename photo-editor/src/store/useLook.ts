// Convenience hook for editing the non-destructive color-grade Look. `update`
// clones the current look, lets the caller mutate it, and pushes it live (no
// history); call `commit` on gesture end to snapshot an undo step.

import { Look } from "../editor/color/look";
import { useEditorStore } from "./editorStore";

export function useLook() {
  const look = useEditorStore((s) => s.recipe.look);
  const setLook = useEditorStore((s) => s.setLook);
  const commit = useEditorStore((s) => s.commit);

  const update = (mutate: (l: Look) => void) => {
    const next = structuredClone(look);
    mutate(next);
    setLook(next);
  };

  return { look, update, commit };
}

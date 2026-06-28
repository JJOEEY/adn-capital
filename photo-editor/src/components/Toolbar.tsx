// Top toolbar: open image, undo/redo, before/after compare, and a placeholder
// "Remove background" action wired up in M4.

import { useState } from "react";
import { openImage, removeBackground } from "../lib/platform";
import { useEditorStore } from "../store/editorStore";

export function Toolbar() {
  const setImage = useEditorStore((s) => s.setImage);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.past.length > 0);
  const canRedo = useEditorStore((s) => s.future.length > 0);
  const setShowOriginal = useEditorStore((s) => s.setShowOriginal);
  const image = useEditorStore((s) => s.image);
  const setMask = useEditorStore((s) => s.setMask);
  const setBg = useEditorStore((s) => s.setBg);
  const recipe = useEditorStore((s) => s.recipe);
  const hasImage = image !== null;
  const [matting, setMatting] = useState(false);

  async function handleOpen() {
    const img = await openImage();
    if (img) setImage(img);
  }

  async function handleRemoveBg() {
    if (!image?.path) {
      alert("AI background removal runs in the Lumen desktop app.");
      return;
    }
    setMatting(true);
    try {
      const mask = await removeBackground(image.path);
      setMask(mask);
      // Default to transparent so the cut-out is immediately visible.
      if (recipe.bg.mode === "none") setBg({ mode: "transparent", color: recipe.bg.color });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setMatting(false);
    }
  }

  return (
    <header className="toolbar">
      <div className="brand">Lumen</div>
      <div className="tools">
        <button onClick={handleOpen}>Open</button>
        <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          Undo
        </button>
        <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
          Redo
        </button>
        <button
          disabled={!hasImage}
          onMouseDown={() => setShowOriginal(true)}
          onMouseUp={() => setShowOriginal(false)}
          onMouseLeave={() => setShowOriginal(false)}
          title="Hold to see the original"
        >
          Before/After
        </button>
        <button
          disabled={!hasImage || matting}
          title="On-device AI background removal (BiRefNet)"
          onClick={handleRemoveBg}
        >
          {matting ? "Removing…" : "Remove BG"}
        </button>
      </div>
    </header>
  );
}

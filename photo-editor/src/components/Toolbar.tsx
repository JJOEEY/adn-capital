// Top toolbar: open image, undo/redo, before/after compare, and a placeholder
// "Remove background" action wired up in M4.

import { openImage } from "../lib/platform";
import { useEditorStore } from "../store/editorStore";

export function Toolbar() {
  const setImage = useEditorStore((s) => s.setImage);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.past.length > 0);
  const canRedo = useEditorStore((s) => s.future.length > 0);
  const setShowOriginal = useEditorStore((s) => s.setShowOriginal);
  const hasImage = useEditorStore((s) => s.image !== null);

  async function handleOpen() {
    const img = await openImage();
    if (img) setImage(img);
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
          disabled={!hasImage}
          title="On-device AI — arrives in M4"
          onClick={() => alert("AI background removal lands in M4 (on-device BiRefNet).")}
        >
          Remove BG
        </button>
      </div>
    </header>
  );
}

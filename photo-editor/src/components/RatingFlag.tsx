// Toolbar widget: star rating + pick/reject flag for the current image, plus
// copy/paste of develop settings. Mirrors the keyboard shortcuts (1–5, P, X, U).

import { useEditorStore } from "../store/editorStore";
import { useRating } from "../store/useRating";

export function RatingFlag() {
  const { hasImage, rating, flag, setRating, setFlag } = useRating();
  const copy = useEditorStore((s) => s.copySettings);
  const paste = useEditorStore((s) => s.pasteSettings);
  const canPaste = useEditorStore((s) => s.clipboardRecipe !== null);

  if (!hasImage) return null;

  return (
    <div className="rating-flag">
      <div className="stars" title="Rate (1–5, 0 to clear)">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            className={n <= rating ? "star on" : "star"}
            onClick={() => setRating(n === rating ? 0 : n)}
          >
            ★
          </button>
        ))}
      </div>
      <button
        className={flag === "pick" ? "flag pick on" : "flag"}
        title="Pick (P)"
        onClick={() => setFlag(flag === "pick" ? "none" : "pick")}
      >
        ⚑
      </button>
      <button
        className={flag === "reject" ? "flag reject on" : "flag"}
        title="Reject (X)"
        onClick={() => setFlag(flag === "reject" ? "none" : "reject")}
      >
        ✕
      </button>
      <button onClick={copy} title="Copy settings (Ctrl+Shift+C)">
        Copy
      </button>
      <button onClick={paste} disabled={!canPaste} title="Paste settings (Ctrl+Shift+V)">
        Paste
      </button>
    </div>
  );
}

// Library (M5): a grid of recently edited images with their saved-edit thumbnails.
// Click to reopen (desktop, via the stored path); ✕ removes the catalog entry.

import { useEffect, useState } from "react";
import { CatalogEntry, listRecent, removeEntry } from "../lib/catalog";
import { openImageByPath } from "../lib/platform";
import { useEditorStore } from "../store/editorStore";

export function Library() {
  const image = useEditorStore((s) => s.image);
  const setImage = useEditorStore((s) => s.setImage);
  const [entries, setEntries] = useState<CatalogEntry[]>([]);

  // Refresh the recents whenever the current image changes (a save just happened).
  useEffect(() => setEntries(listRecent()), [image]);

  if (entries.length === 0) return null;

  async function reopen(e: CatalogEntry) {
    if (!e.path) {
      alert("Reopening from the library needs the desktop app.");
      return;
    }
    const img = await openImageByPath(e.path);
    if (img) setImage(img);
  }

  return (
    <div className="library">
      <div className="panel-header">
        <span>Library</span>
      </div>
      <div className="lib-grid">
        {entries.map((e) => (
          <div className="lib-item" key={e.key} title={e.name}>
            {e.thumb && <img src={e.thumb} alt={e.name} onClick={() => reopen(e)} />}
            <button
              className="lib-x"
              title="Remove from library"
              onClick={() => {
                removeEntry(e.key);
                setEntries(listRecent());
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

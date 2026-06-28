// Library / browser (M5 + Pillar 3): recently edited images with rating + flag for
// culling, a filter, reopen, and batch export of the filtered set.

import { useEffect, useState } from "react";
import { CatalogEntry, Flag, listRecent, removeEntry, setMeta } from "../lib/catalog";
import { renderToBlob } from "../lib/export";
import { openImageByPath, pickDirectory, writeBinaryToPath } from "../lib/platform";
import { useEditorStore } from "../store/editorStore";
import { useCatalogStore } from "../store/useCatalogStore";
import { useLicense } from "../store/useLicense";

type FilterMode = "all" | "picks" | "rated";

export function Library() {
  const image = useEditorStore((s) => s.image);
  const setImage = useEditorStore((s) => s.setImage);
  const version = useCatalogStore((s) => s.version);
  const bump = useCatalogStore((s) => s.bump);
  const entitled = useLicense((s) => s.entitled);
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [busy, setBusy] = useState(false);

  // Refresh on image change or any catalog write (rating/flag/save).
  useEffect(() => setEntries(listRecent(60)), [image, version]);

  const shown = entries.filter((e) =>
    filter === "picks" ? e.flag === "pick" : filter === "rated" ? e.rating > 0 : e.flag !== "reject"
  );

  if (entries.length === 0) return null;

  async function reopen(e: CatalogEntry) {
    if (!e.path) return alert("Reopening from the library needs the desktop app.");
    const img = await openImageByPath(e.path);
    if (img) setImage(img);
  }

  function rate(e: CatalogEntry, n: number) {
    setMeta(e.key, { rating: n === e.rating ? 0 : n });
    bump();
  }
  function flag(e: CatalogEntry, f: Flag) {
    setMeta(e.key, { flag: e.flag === f ? "none" : f });
    bump();
  }

  async function batchExport() {
    const dir = await pickDirectory();
    if (!dir) return alert("Batch export needs the desktop app (choose an output folder).");
    setBusy(true);
    let n = 0;
    try {
      for (const e of shown) {
        if (!e.path) continue;
        const img = await openImageByPath(e.path);
        if (!img) continue;
        const blob = await renderToBlob(img, e.recipe, null, [], "jpeg", 0.92, !entitled);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const base = e.name.replace(/\.[^.]+$/, "");
        await writeBinaryToPath(`${dir}/${base}-edited.jpg`, bytes);
        n++;
      }
      alert(`Exported ${n} image${n === 1 ? "" : "s"} to ${dir}`);
    } catch (err) {
      alert("Batch export failed: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="library">
      <div className="panel-header">
        <span>Library</span>
        <div>
          {(["all", "picks", "rated"] as FilterMode[]).map((f) => (
            <button key={f} className={filter === f ? "link active" : "link"} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>
      </div>
      <button className="export-btn" disabled={busy || shown.length === 0} onClick={batchExport}>
        {busy ? "Exporting…" : `Batch export ${shown.length}`}
      </button>
      <div className="lib-grid">
        {shown.map((e) => (
          <div className="lib-item" key={e.key} title={e.name}>
            {e.thumb && <img src={e.thumb} alt={e.name} onClick={() => reopen(e)} />}
            <div className="lib-meta">
              <span className="lib-stars">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} className={n <= e.rating ? "star on" : "star"} onClick={() => rate(e, n)}>
                    ★
                  </button>
                ))}
              </span>
              <button
                className={e.flag === "pick" ? "flag pick on" : e.flag === "reject" ? "flag reject on" : "flag"}
                onClick={() => flag(e, e.flag === "pick" ? "reject" : "pick")}
                title="Pick / reject"
              >
                {e.flag === "reject" ? "✕" : "⚑"}
              </button>
            </div>
            <button
              className="lib-x"
              title="Remove from library"
              onClick={() => {
                removeEntry(e.key);
                bump();
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

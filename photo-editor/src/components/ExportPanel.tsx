// Export panel (M5): render the current edit at full resolution and save as
// PNG / JPEG / WebP. PNG preserves transparency from the AI matte.

import { useState } from "react";
import { exportImage, ExportFormat } from "../lib/export";
import { useEditorStore } from "../store/editorStore";
import { useLicense } from "../store/useLicense";

const FORMATS: ExportFormat[] = ["png", "jpeg", "webp"];

export function ExportPanel() {
  const image = useEditorStore((s) => s.image);
  const recipe = useEditorStore((s) => s.recipe);
  const mask = useEditorStore((s) => s.mask);
  const { isPro } = useLicense();
  const [format, setFormat] = useState<ExportFormat>("png");
  const [quality, setQuality] = useState(92);
  const [busy, setBusy] = useState(false);

  if (!image) return null;

  async function run() {
    if (!image) return;
    setBusy(true);
    try {
      await exportImage(image, recipe, mask, format, quality / 100, !isPro);
    } catch (e) {
      alert("Export failed: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="export-panel">
      <div className="panel-header">
        <span>Export</span>
      </div>
      <div className="bg-modes">
        {FORMATS.map((f) => (
          <button
            key={f}
            className={format === f ? "bg-mode active" : "bg-mode"}
            onClick={() => setFormat(f)}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>
      {format !== "png" && (
        <div className="slider-row">
          <label>
            <span>Quality</span>
            <span className="val active">{quality}</span>
          </label>
          <input
            type="range"
            min={1}
            max={100}
            value={quality}
            onChange={(e) => setQuality(parseInt(e.target.value))}
          />
        </div>
      )}
      <button className="export-btn" disabled={busy} onClick={run}>
        {busy ? "Exporting…" : `Export ${image.width}×${image.height}`}
      </button>
      {!isPro && (
        <p className="hint">Free exports include a watermark — activate Lumen Pro to remove.</p>
      )}
    </div>
  );
}

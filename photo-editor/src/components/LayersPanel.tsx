// Layers panel (Pillar 2). Stack imported image layers over the edited photo, each
// with a blend mode + opacity. Top of the list = top of the stack.

import { BLEND_MODES } from "../editor/layers";
import { defaultMask, MaskKind } from "../editor/masks";
import { openImage } from "../lib/platform";
import { useEditorStore } from "../store/editorStore";

const MASK_TYPES: { kind: MaskKind | "none"; label: string }[] = [
  { kind: "none", label: "None" },
  { kind: "linear", label: "Linear" },
  { kind: "radial", label: "Radial" },
  { kind: "rangeLuma", label: "Luma" },
  { kind: "aiSubject", label: "Subject" },
];

export function LayersPanel() {
  const image = useEditorStore((s) => s.image);
  const stack = useEditorStore((s) => s.recipe.layerStack);
  const selectedId = useEditorStore((s) => s.selectedLayerId);
  const addLayer = useEditorStore((s) => s.addLayer);
  const updateLayer = useEditorStore((s) => s.updateLayer);
  const removeLayer = useEditorStore((s) => s.removeLayer);
  const moveLayer = useEditorStore((s) => s.moveLayer);
  const selectLayer = useEditorStore((s) => s.selectLayer);
  const commit = useEditorStore((s) => s.commit);

  if (!image) return null;
  const sel = stack.find((p) => p.id === selectedId) ?? null;

  async function add() {
    const img = await openImage();
    if (!img) return;
    addLayer({
      id: globalThis.crypto?.randomUUID?.() ?? `layer_${Date.now()}`,
      bitmap: img.bitmap,
      width: img.width,
      height: img.height,
      name: img.name,
    });
  }

  // Display top → bottom (last in the array renders on top).
  const ordered = [...stack].reverse();

  return (
    <div className="layers-panel">
      <div className="panel-header">
        <span>Layers</span>
        <button className="link" onClick={add}>
          + Image
        </button>
      </div>
      {stack.length === 0 && <p className="hint">Add an image layer to composite.</p>}
      {ordered.map((p, i) => {
        const idx = stack.length - 1 - i; // index in the real (bottom→top) array
        return (
          <div
            key={p.id}
            className={p.id === selectedId ? "layer-row sel" : "layer-row"}
            onClick={() => selectLayer(p.id)}
          >
            <button
              className="mask-eye"
              title="Toggle"
              onClick={(e) => {
                e.stopPropagation();
                updateLayer(p.id, (lp) => (lp.visible = !lp.visible));
                commit();
              }}
            >
              {p.visible ? "●" : "○"}
            </button>
            <div className="layer-main">
              <div className="layer-top">
                <span className="mask-name">{p.name}</span>
                <span className="layer-move" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => moveLayer(p.id, 1)} disabled={idx === stack.length - 1} title="Up">
                    ▲
                  </button>
                  <button onClick={() => moveLayer(p.id, -1)} disabled={idx === 0} title="Down">
                    ▼
                  </button>
                  <button className="link" onClick={() => removeLayer(p.id)} title="Delete">
                    ✕
                  </button>
                </span>
              </div>
              <div className="layer-controls">
                <select
                  value={p.blend}
                  onChange={(e) => {
                    updateLayer(p.id, (lp) => (lp.blend = e.target.value as typeof lp.blend));
                    commit();
                  }}
                >
                  {BLEND_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(p.opacity * 100)}
                  title="Opacity"
                  onChange={(e) => updateLayer(p.id, (lp) => (lp.opacity = parseInt(e.target.value) / 100))}
                  onPointerUp={commit}
                  onKeyUp={commit}
                />
              </div>
            </div>
          </div>
        );
      })}

      {sel && (
        <div className="mask-edit">
          <h5>Layer mask · {sel.name}</h5>
          <div className="bg-modes">
            {MASK_TYPES.map((t) => (
              <button
                key={t.kind}
                className={
                  (sel.mask?.kind ?? "none") === t.kind ? "bg-mode active" : "bg-mode"
                }
                onClick={() => {
                  updateLayer(sel.id, (lp) => (lp.mask = t.kind === "none" ? null : defaultMask(t.kind)));
                  commit();
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          {sel.mask && (
            <>
              <label className="mask-invert">
                <input
                  type="checkbox"
                  checked={sel.mask.invert}
                  onChange={() => {
                    updateLayer(sel.id, (lp) => lp.mask && (lp.mask.invert = !lp.mask.invert));
                    commit();
                  }}
                />
                Invert
              </label>
              {sel.mask.kind === "radial" && (
                <LayerMaskSlider label="Feather" value={sel.mask.radial.feather * 100}
                  onInput={(v) => updateLayer(sel.id, (lp) => lp.mask && (lp.mask.radial.feather = v / 100))} />
              )}
              {sel.mask.kind === "rangeLuma" && (
                <>
                  <LayerMaskSlider label="Low" value={sel.mask.range.lo * 100}
                    onInput={(v) => updateLayer(sel.id, (lp) => lp.mask && (lp.mask.range.lo = v / 100))} />
                  <LayerMaskSlider label="High" value={sel.mask.range.hi * 100}
                    onInput={(v) => updateLayer(sel.id, (lp) => lp.mask && (lp.mask.range.hi = v / 100))} />
                </>
              )}
              {(sel.mask.kind === "linear" || sel.mask.kind === "radial") && (
                <p className="hint">Drag the handles on the canvas to position.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function LayerMaskSlider({ label, value, onInput }: { label: string; value: number; onInput: (v: number) => void }) {
  const commit = useEditorStore((s) => s.commit);
  return (
    <div className="slider-row">
      <label>
        <span>{label}</span>
        <span className="val">{Math.round(value)}</span>
      </label>
      <input type="range" min={0} max={100} value={value}
        onChange={(e) => onInput(parseFloat(e.target.value))} onPointerUp={commit} onKeyUp={commit} />
    </div>
  );
}

// Retouch panel: add heal/clone spots, pick one to edit (mode / radius / feather).
// Drag the destination & source handles on the canvas (HealOverlay) to position.

import { useEditorStore } from "../store/editorStore";

export function HealPanel() {
  const image = useEditorStore((s) => s.image);
  const spots = useEditorStore((s) => s.recipe.spots);
  const selectedId = useEditorStore((s) => s.selectedSpotId);
  const addSpot = useEditorStore((s) => s.addSpot);
  const updateSpot = useEditorStore((s) => s.updateSpot);
  const removeSpot = useEditorStore((s) => s.removeSpot);
  const selectSpot = useEditorStore((s) => s.selectSpot);
  const commit = useEditorStore((s) => s.commit);

  if (!image) return null;
  const sel = spots.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="heal-panel">
      <div className="panel-header">
        <span>Retouch</span>
        <button className="link" onClick={addSpot}>
          + Spot
        </button>
      </div>
      {spots.length === 0 && <p className="hint">Add a spot, then drag its handles to heal/clone.</p>}
      {spots.map((s, i) => (
        <div
          key={s.id}
          className={s.id === selectedId ? "mask-row sel" : "mask-row"}
          onClick={() => selectSpot(s.id)}
        >
          <span className="mask-name">Spot {i + 1} · {s.mode}</span>
          <button
            className="link"
            onClick={(e) => {
              e.stopPropagation();
              removeSpot(s.id);
            }}
          >
            ✕
          </button>
        </div>
      ))}
      {sel && (
        <div className="mask-edit">
          <div className="bg-modes">
            {(["heal", "clone"] as const).map((m) => (
              <button
                key={m}
                className={sel.mode === m ? "bg-mode active" : "bg-mode"}
                onClick={() => {
                  updateSpot(sel.id, (sp) => (sp.mode = m));
                  commit();
                }}
              >
                {m}
              </button>
            ))}
          </div>
          <Slider label="Size" value={sel.radius * 100} min={1} max={40}
            onInput={(v) => updateSpot(sel.id, (sp) => (sp.radius = v / 100))} />
          <Slider label="Feather" value={sel.feather * 100} min={0} max={100}
            onInput={(v) => updateSpot(sel.id, (sp) => (sp.feather = v / 100))} />
        </div>
      )}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  onInput,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onInput: (v: number) => void;
}) {
  const commit = useEditorStore((s) => s.commit);
  return (
    <div className="slider-row">
      <label>
        <span>{label}</span>
        <span className="val">{Math.round(value)}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onInput(parseFloat(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
      />
    </div>
  );
}

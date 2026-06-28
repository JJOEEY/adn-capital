// Local adjustments / masking panel (Pillar 1). Add masks (linear / radial / luma
// range / AI subject), pick one to edit, tune its mask + local parameters. Spatial
// masks (linear/radial) also get drag handles on the canvas (MaskOverlay).

import { LOCAL_SLIDERS, LocalParams, MaskKind } from "../editor/masks";
import { useEditorStore } from "../store/editorStore";

const ADD: { kind: MaskKind; label: string }[] = [
  { kind: "linear", label: "Linear" },
  { kind: "radial", label: "Radial" },
  { kind: "rangeLuma", label: "Luma" },
  { kind: "aiSubject", label: "Subject" },
];

export function MaskPanel() {
  const image = useEditorStore((s) => s.image);
  const locals = useEditorStore((s) => s.recipe.localAdjustments);
  const selectedId = useEditorStore((s) => s.selectedMaskId);
  const hasMatte = useEditorStore((s) => s.mask !== null);
  const addLocal = useEditorStore((s) => s.addLocal);
  const updateLocal = useEditorStore((s) => s.updateLocal);
  const removeLocal = useEditorStore((s) => s.removeLocal);
  const selectMask = useEditorStore((s) => s.selectMask);
  const commit = useEditorStore((s) => s.commit);

  if (!image) return null;
  const selected = locals.find((l) => l.id === selectedId) ?? null;

  return (
    <div className="mask-panel">
      <div className="panel-header">
        <span>Masking</span>
      </div>
      <div className="bg-modes">
        {ADD.map((a) => (
          <button key={a.kind} className="bg-mode" onClick={() => addLocal(a.kind)}>
            +{a.label}
          </button>
        ))}
      </div>

      {locals.map((l) => (
        <div
          key={l.id}
          className={l.id === selectedId ? "mask-row sel" : "mask-row"}
          onClick={() => selectMask(l.id)}
        >
          <button
            className="mask-eye"
            title="Toggle"
            onClick={(e) => {
              e.stopPropagation();
              updateLocal(l.id, (la) => (la.visible = !la.visible));
              commit();
            }}
          >
            {l.visible ? "●" : "○"}
          </button>
          <span className="mask-name">{l.name}</span>
          <button
            className="link"
            onClick={(e) => {
              e.stopPropagation();
              removeLocal(l.id);
            }}
          >
            ✕
          </button>
        </div>
      ))}

      {selected && (
        <div className="mask-edit">
          {selected.mask.kind === "aiSubject" && !hasMatte && (
            <p className="hint">Run “Remove BG” first to generate the subject matte.</p>
          )}
          <label className="mask-invert">
            <input
              type="checkbox"
              checked={selected.mask.invert}
              onChange={() => {
                updateLocal(selected.id, (la) => (la.mask.invert = !la.mask.invert));
                commit();
              }}
            />
            Invert mask
          </label>

          {selected.mask.kind === "radial" && (
            <MaskSlider
              label="Feather"
              value={selected.mask.radial.feather * 100}
              min={0}
              max={100}
              onInput={(v) => updateLocal(selected.id, (la) => (la.mask.radial.feather = v / 100))}
            />
          )}
          {selected.mask.kind === "rangeLuma" && (
            <>
              <MaskSlider label="Range low" value={selected.mask.range.lo * 100} min={0} max={100}
                onInput={(v) => updateLocal(selected.id, (la) => (la.mask.range.lo = v / 100))} />
              <MaskSlider label="Range high" value={selected.mask.range.hi * 100} min={0} max={100}
                onInput={(v) => updateLocal(selected.id, (la) => (la.mask.range.hi = v / 100))} />
              <MaskSlider label="Feather" value={selected.mask.range.feather * 100} min={0} max={50}
                onInput={(v) => updateLocal(selected.id, (la) => (la.mask.range.feather = v / 100))} />
            </>
          )}

          <h5>Adjustments</h5>
          {LOCAL_SLIDERS.map((s) => (
            <MaskSlider
              key={s.key}
              label={s.label}
              value={selected.params[s.key]}
              min={-100}
              max={100}
              onInput={(v) => updateLocal(selected.id, (la) => (la.params[s.key as keyof LocalParams] = v))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MaskSlider({
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
        <span className={Math.round(value) !== 0 ? "val active" : "val"}>{Math.round(value)}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onInput(parseFloat(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onDoubleClick={() => {
          onInput(0);
          commit();
        }}
      />
    </div>
  );
}

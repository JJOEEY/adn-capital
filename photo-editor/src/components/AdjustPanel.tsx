// Right-hand adjustment panel: one slider per Recipe field, grouped. Dragging
// updates the recipe live (no history); releasing commits a history snapshot.

import { ADJUSTMENTS, AdjustSpec } from "../editor/recipe";
import { useEditorStore } from "../store/editorStore";

const GROUPS: AdjustSpec["group"][] = ["Light", "Color", "Detail"];

export function AdjustPanel() {
  const recipe = useEditorStore((s) => s.recipe);
  const setAdjust = useEditorStore((s) => s.setAdjust);
  const commit = useEditorStore((s) => s.commit);
  const reset = useEditorStore((s) => s.reset);

  return (
    <aside className="panel">
      <div className="panel-header">
        <span>Adjustments</span>
        <button className="link" onClick={reset}>
          Reset
        </button>
      </div>
      {GROUPS.map((group) => (
        <div className="panel-group" key={group}>
          <h4>{group}</h4>
          {ADJUSTMENTS.filter((a) => a.group === group).map((a) => (
            <Slider
              key={a.key}
              spec={a}
              value={recipe[a.key]}
              onInput={(v) => setAdjust(a.key, v)}
              onCommit={commit}
            />
          ))}
        </div>
      ))}
    </aside>
  );
}

function Slider({
  spec,
  value,
  onInput,
  onCommit,
}: {
  spec: AdjustSpec;
  value: number;
  onInput: (v: number) => void;
  onCommit: () => void;
}) {
  const display = spec.step < 1 ? value.toFixed(2) : Math.round(value);
  return (
    <div className="slider-row">
      <label>
        <span>{spec.label}</span>
        <span className={value !== 0 ? "val active" : "val"}>{display}</span>
      </label>
      <input
        type="range"
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={value}
        onChange={(e) => onInput(parseFloat(e.target.value))}
        onMouseUp={onCommit}
        onTouchEnd={onCommit}
        onKeyUp={onCommit}
        onDoubleClick={() => {
          onInput(0);
          onCommit();
        }}
      />
    </div>
  );
}

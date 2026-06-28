// Split toning: independent hue/sat tints for shadows and highlights, plus a
// balance control shifting the crossover.

import { Look } from "../../editor/color/look";
import { useLook } from "../../store/useLook";

export function SplitToning() {
  const { look, update, commit } = useLook();
  const s = look.split;

  const Row = (props: {
    label: string;
    value: number;
    min: number;
    max: number;
    set: (l: Look, v: number) => void;
  }) => (
    <div className="slider-row">
      <label>
        <span>{props.label}</span>
        <span className={props.value !== 0 ? "val active" : "val"}>
          {Math.round(props.value)}
        </span>
      </label>
      <input
        type="range"
        min={props.min}
        max={props.max}
        value={props.value}
        onChange={(e) => update((l) => props.set(l, parseFloat(e.target.value)))}
        onPointerUp={commit}
        onDoubleClick={() => {
          update((l) => props.set(l, 0));
          commit();
        }}
      />
    </div>
  );

  return (
    <div className="split">
      <h5>Shadows</h5>
      <Row label="Hue" value={s.shadowHue} min={0} max={360}
        set={(l, v) => (l.split.shadowHue = v)} />
      <Row label="Saturation" value={s.shadowSat * 100} min={0} max={100}
        set={(l, v) => (l.split.shadowSat = v / 100)} />
      <h5>Highlights</h5>
      <Row label="Hue" value={s.highlightHue} min={0} max={360}
        set={(l, v) => (l.split.highlightHue = v)} />
      <Row label="Saturation" value={s.highlightSat * 100} min={0} max={100}
        set={(l, v) => (l.split.highlightSat = v / 100)} />
      <Row label="Balance" value={s.balance * 100} min={-100} max={100}
        set={(l, v) => (l.split.balance = v / 100)} />
    </div>
  );
}

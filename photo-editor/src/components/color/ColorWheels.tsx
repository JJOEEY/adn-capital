// Color grading wheels: shadows / midtones / highlights / global. Each wheel is a
// circular hue-saturation pad (angle = hue, radius = saturation) plus a luminance
// slider. Maps to the lift/gamma/gain model in the shader + wheels.ts.

import { useRef } from "react";
import { Wheel } from "../../editor/color/look";
import { useLook } from "../../store/useLook";

const REGIONS: { key: "shadows" | "midtones" | "highlights" | "global"; label: string }[] = [
  { key: "shadows", label: "Shadows" },
  { key: "midtones", label: "Midtones" },
  { key: "highlights", label: "Highlights" },
  { key: "global", label: "Global" },
];

export function ColorWheels() {
  const { look, update, commit } = useLook();
  return (
    <div className="wheels">
      {REGIONS.map((r) => (
        <WheelPad
          key={r.key}
          label={r.label}
          wheel={look.wheels[r.key]}
          onChange={(w) => update((l) => (l.wheels[r.key] = w))}
          onCommit={commit}
        />
      ))}
    </div>
  );
}

function WheelPad({
  label,
  wheel,
  onChange,
  onCommit,
}: {
  label: string;
  wheel: Wheel;
  onChange: (w: Wheel) => void;
  onCommit: () => void;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  // Display radius and the pointer→saturation scale must use the SAME radius (R) so
  // the dot tracks the cursor exactly. R=48 keeps a full-saturation dot inside the ring.
  const R = 48;
  const rad = (wheel.h * Math.PI) / 180;
  const cx = 50 + Math.cos(rad) * wheel.s * R;
  const cy = 50 - Math.sin(rad) * wheel.s * R;

  const fromEvent = (e: React.PointerEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    const dx = (e.clientX - rect.left) / rect.width - 0.5;
    const dy = 0.5 - (e.clientY - rect.top) / rect.height;
    const sat = Math.min(1, (Math.hypot(dx, dy) * 100) / R); // viewBox radius / R
    let hue = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (hue < 0) hue += 360;
    onChange({ ...wheel, h: hue, s: sat });
  };

  return (
    <div className="wheel">
      <div className="wheel-label">{label}</div>
      <svg
        ref={ref}
        className="wheel-pad"
        viewBox="0 0 100 100"
        onPointerDown={(e) => {
          if (e.detail > 1) return; // ignore the pointerdown that begins a double-click (reset)
          ref.current!.setPointerCapture(e.pointerId);
          dragging.current = true;
          fromEvent(e);
        }}
        onPointerMove={(e) => dragging.current && fromEvent(e)}
        onPointerUp={() => {
          dragging.current = false;
          onCommit();
        }}
        onDoubleClick={() => {
          onChange({ h: 0, s: 0, l: wheel.l });
          onCommit();
        }}
      >
        <defs>
          <radialGradient id={`g-${label}`}>
            <stop offset="0%" stopColor="#888" />
            <stop offset="100%" stopColor="#444" />
          </radialGradient>
        </defs>
        <circle cx={50} cy={50} r={48} fill={`url(#g-${label})`} stroke="#222" strokeWidth="1" />
        <circle cx={cx} cy={cy} r={3.5} fill="#fff" stroke="#000" strokeWidth="0.8" />
      </svg>
      <input
        type="range"
        className="wheel-lum"
        min={-100}
        max={100}
        title="Luminance"
        value={Math.round(wheel.l * 100)}
        onChange={(e) => onChange({ ...wheel, l: parseFloat(e.target.value) / 100 })}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        onDoubleClick={() => {
          onChange({ ...wheel, l: 0 });
          onCommit();
        }}
      />
    </div>
  );
}

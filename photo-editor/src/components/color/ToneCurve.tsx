// Interactive tone-curve editor. Master (RGB) + per-channel R/G/B curves. Drag to
// move control points, click empty space to add, double-click to remove. Empty
// curve = linear identity. Writes look.curves via the editor store.

import { useRef, useState } from "react";
import { CurvePt } from "../../editor/color/look";
import { evalCurve } from "../../editor/color/curve";
import { useLook } from "../../store/useLook";

type Channel = "rgb" | "r" | "g" | "b";
const CHANNELS: { key: Channel; label: string; color: string }[] = [
  { key: "rgb", label: "RGB", color: "#ddd" },
  { key: "r", label: "R", color: "#ff5b5b" },
  { key: "g", label: "G", color: "#5bff7a" },
  { key: "b", label: "B", color: "#5b8cff" },
];

const SIZE = 256;
const HIT = 0.04; // hit radius in normalized space

export function ToneCurve() {
  const { look, update, commit } = useLook();
  const [chan, setChan] = useState<Channel>("rgb");
  const dragIdx = useRef<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const raw = look.curves[chan];
  const points: CurvePt[] = raw.length >= 2 ? raw : [{ x: 0, y: 0 }, { x: 1, y: 1 }];

  const toXY = (e: React.PointerEvent) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1 - (e.clientY - rect.top) / rect.height;
    return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
  };

  const writePoints = (pts: CurvePt[]) =>
    update((l) => {
      l.curves[chan] = pts.slice().sort((a, b) => a.x - b.x);
    });

  const onDown = (e: React.PointerEvent) => {
    svgRef.current!.setPointerCapture(e.pointerId);
    const p = toXY(e);
    const idx = points.findIndex((pt) => Math.hypot(pt.x - p.x, pt.y - p.y) < HIT);
    if (idx >= 0) {
      dragIdx.current = idx;
    } else {
      const next = [...points, p].sort((a, b) => a.x - b.x);
      dragIdx.current = next.findIndex((pt) => pt.x === p.x && pt.y === p.y);
      writePoints(next);
    }
  };

  const onMove = (e: React.PointerEvent) => {
    if (dragIdx.current == null) return;
    const p = toXY(e);
    const i = dragIdx.current;
    const next = points.map((pt, j) => (j === i ? p : pt));
    // keep endpoints pinned to x=0 / x=1
    if (i === 0) next[0] = { x: 0, y: p.y };
    if (i === points.length - 1) next[i] = { x: 1, y: p.y };
    writePoints(next);
  };

  const onUp = () => {
    if (dragIdx.current != null) commit();
    dragIdx.current = null;
  };

  const removePoint = (i: number) => {
    if (i === 0 || i === points.length - 1) return;
    writePoints(points.filter((_, j) => j !== i));
    commit();
  };

  // Build the curve path by sampling evalCurve so the displayed line matches the GPU.
  const path = Array.from({ length: SIZE }, (_, i) => {
    const x = i / (SIZE - 1);
    const y = evalCurve(points, x);
    return `${i === 0 ? "M" : "L"} ${(x * 100).toFixed(2)} ${((1 - y) * 100).toFixed(2)}`;
  }).join(" ");

  const active = CHANNELS.find((c) => c.key === chan)!;

  return (
    <div className="curve">
      <div className="curve-tabs">
        {CHANNELS.map((c) => (
          <button
            key={c.key}
            className={c.key === chan ? "tab active" : "tab"}
            style={{ color: c.color }}
            onClick={() => setChan(c.key)}
          >
            {c.label}
          </button>
        ))}
        {raw.length >= 2 && (
          <button
            className="link"
            onClick={() => {
              update((l) => (l.curves[chan] = []));
              commit();
            }}
          >
            Reset
          </button>
        )}
      </div>
      <svg
        ref={svgRef}
        className="curve-canvas"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
      >
        {[25, 50, 75].map((g) => (
          <g key={g} stroke="#33333c" strokeWidth="0.4">
            <line x1={g} y1={0} x2={g} y2={100} />
            <line x1={0} y1={g} x2={100} y2={g} />
          </g>
        ))}
        <line x1={0} y1={100} x2={100} y2={0} stroke="#2c2c33" strokeWidth="0.5" />
        <path d={path} fill="none" stroke={active.color} strokeWidth="1" />
        {points.map((pt, i) => (
          <circle
            key={i}
            cx={pt.x * 100}
            cy={(1 - pt.y) * 100}
            r={1.6}
            fill={active.color}
            onDoubleClick={() => removePoint(i)}
          />
        ))}
      </svg>
    </div>
  );
}

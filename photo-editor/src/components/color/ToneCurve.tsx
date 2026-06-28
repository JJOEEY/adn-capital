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
  // During a drag we hold a mutable working array and track the dragged point by
  // OBJECT IDENTITY (not array index), so re-sorting when it crosses a neighbor
  // never grabs the wrong point.
  const work = useRef<CurvePt[] | null>(null);
  const dragPt = useRef<CurvePt | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const raw = look.curves[chan];
  const points: CurvePt[] =
    work.current ?? (raw.length >= 2 ? raw : [{ x: 0, y: 0 }, { x: 1, y: 1 }]);

  const toXY = (e: React.PointerEvent) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1 - (e.clientY - rect.top) / rect.height;
    return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
  };

  // Store deep copies so the committed/live state is decoupled from our work objects.
  const writePoints = (pts: CurvePt[]) =>
    update((l) => {
      l.curves[chan] = pts
        .slice()
        .sort((a, b) => a.x - b.x)
        .map((p) => ({ x: p.x, y: p.y }));
    });

  const onDown = (e: React.PointerEvent) => {
    svgRef.current!.setPointerCapture(e.pointerId);
    const p = toXY(e);
    const base: CurvePt[] = (raw.length >= 2 ? raw : [{ x: 0, y: 0 }, { x: 1, y: 1 }]).map(
      (q) => ({ x: q.x, y: q.y })
    );
    let pt = base.find((q) => Math.hypot(q.x - p.x, q.y - p.y) < HIT);
    if (!pt) {
      pt = { ...p };
      base.push(pt);
    }
    base.sort((a, b) => a.x - b.x);
    work.current = base;
    dragPt.current = pt;
    writePoints(base);
  };

  const onMove = (e: React.PointerEvent) => {
    const arr = work.current;
    const pt = dragPt.current;
    if (!arr || !pt) return;
    const p = toXY(e);
    // Endpoints stay pinned in x; interior points move freely.
    const isFirst = arr[0] === pt;
    const isLast = arr[arr.length - 1] === pt;
    pt.x = isFirst ? 0 : isLast ? 1 : p.x;
    pt.y = p.y;
    arr.sort((a, b) => a.x - b.x);
    writePoints(arr);
  };

  const onUp = () => {
    if (dragPt.current) commit();
    work.current = null;
    dragPt.current = null;
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

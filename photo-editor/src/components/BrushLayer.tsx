// Freehand heal-brush capture layer. Active only while the heal-brush tool is on:
// a div sized to the displayed image captures the drag, collects points in image
// space, previews the stroke, and commits it as a HealStroke on pointer up.

import { RefObject, useEffect, useReducer, useRef, useState } from "react";
import { useEditorStore } from "../store/editorStore";

export function BrushLayer({ canvasRef }: { canvasRef: RefObject<HTMLCanvasElement | null> }) {
  const tool = useEditorStore((s) => s.tool);
  const image = useEditorStore((s) => s.image);
  const brushSize = useEditorStore((s) => s.brushSize);
  const addHealStroke = useEditorStore((s) => s.addHealStroke);
  const [pts, setPts] = useState<number[]>([]);
  const drawing = useRef(false);
  const [, force] = useReducer((n) => n + 1, 0);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => force());
    ro.observe(el);
    window.addEventListener("resize", force);
    window.addEventListener("scroll", force, true);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", force);
      window.removeEventListener("scroll", force, true);
    };
  }, [canvasRef]);

  const canvas = canvasRef.current;
  if (tool !== "healBrush" || !image || !canvas) return null;

  const r = canvas.getBoundingClientRect();
  const scale = Math.min(r.width / canvas.width, r.height / canvas.height);
  const dw = canvas.width * scale;
  const dh = canvas.height * scale;
  const left = r.left + (r.width - dw) / 2;
  const top = r.top + (r.height - dh) / 2;
  const toImg = (cx: number, cy: number): [number, number] => [
    Math.min(1, Math.max(0, (cx - left) / dw)),
    Math.min(1, Math.max(0, (cy - top) / dh)),
  ];
  const minStep = Math.max(0.004, brushSize * 0.25);

  const down = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    drawing.current = true;
    const [x, y] = toImg(e.clientX, e.clientY);
    setPts([x, y]);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const [x, y] = toImg(e.clientX, e.clientY);
    setPts((prev) => {
      const n = prev.length;
      if (n >= 2) {
        const dx = x - prev[n - 2];
        const dy = y - prev[n - 1];
        if (Math.hypot(dx, dy) < minStep) return prev;
      }
      return [...prev, x, y];
    });
  };
  const up = () => {
    drawing.current = false;
    if (pts.length >= 2) addHealStroke(pts);
    setPts([]);
  };

  const polyline = [];
  for (let i = 0; i < pts.length; i += 2) polyline.push(`${pts[i] * dw},${pts[i + 1] * dh}`);

  return (
    <div
      className="brush-layer"
      style={{ left, top, width: dw, height: dh }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
    >
      {pts.length >= 2 && (
        <svg width={dw} height={dh}>
          <polyline
            points={polyline.join(" ")}
            fill="none"
            stroke="rgba(79,140,255,0.45)"
            strokeWidth={brushSize * dh * 2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  );
}

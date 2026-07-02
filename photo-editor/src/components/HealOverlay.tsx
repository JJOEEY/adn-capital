// On-canvas handles for the selected heal/clone spot: a destination circle (where
// the fix lands) and a source circle (where pixels are sampled from), each draggable.

import { RefObject, useEffect, useReducer, useRef } from "react";
import { useEditorStore } from "../store/editorStore";

export function HealOverlay({ canvasRef }: { canvasRef: RefObject<HTMLCanvasElement | null> }) {
  const image = useEditorStore((s) => s.image);
  const spot = useEditorStore((s) =>
    s.recipe.spots.find((sp) => sp.id === s.selectedSpotId)
  );
  const updateSpot = useEditorStore((s) => s.updateSpot);
  const commit = useEditorStore((s) => s.commit);
  const [, force] = useReducer((n) => n + 1, 0);
  const drag = useRef<"dst" | "src" | null>(null);

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
  if (!image || !spot || !canvas) return null;

  const r = canvas.getBoundingClientRect();
  const scale = Math.min(r.width / canvas.width, r.height / canvas.height);
  const dw = canvas.width * scale;
  const dh = canvas.height * scale;
  const left = r.left + (r.width - dw) / 2;
  const top = r.top + (r.height - dh) / 2;
  const toPx = (ix: number, iy: number): [number, number] => [left + ix * dw, top + iy * dh];
  const toImg = (px: number, py: number): [number, number] => [
    Math.min(1, Math.max(0, (px - left) / dw)),
    Math.min(1, Math.max(0, (py - top) / dh)),
  ];
  const rpx = spot.radius * dh; // circular in display space

  const onDown = (which: "dst" | "src") => (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = which;
    e.stopPropagation();
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current || !spot) return;
    const [ix, iy] = toImg(e.clientX, e.clientY);
    updateSpot(spot.id, (sp) => {
      if (drag.current === "dst") {
        sp.dx = ix;
        sp.dy = iy;
      } else {
        sp.sx = ix;
        sp.sy = iy;
      }
    });
  };
  const onUp = () => {
    if (drag.current) commit();
    drag.current = null;
  };

  const [dx, dy] = toPx(spot.dx, spot.dy);
  const [sx, sy] = toPx(spot.sx, spot.sy);

  return (
    <svg className="mask-overlay">
      <line x1={sx} y1={sy} x2={dx} y2={dy} className="mask-line" />
      <circle cx={sx} cy={sy} r={rpx} className="heal-src" />
      <circle cx={dx} cy={dy} r={rpx} className="heal-dst" />
      <circle cx={sx} cy={sy} r={7} className="mask-handle"
        onPointerDown={onDown("src")} onPointerMove={onMove} onPointerUp={onUp} />
      <circle cx={dx} cy={dy} r={7} className="mask-handle"
        onPointerDown={onDown("dst")} onPointerMove={onMove} onPointerUp={onUp} />
    </svg>
  );
}

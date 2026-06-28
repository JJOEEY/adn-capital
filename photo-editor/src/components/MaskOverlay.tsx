// On-canvas handles for the selected spatial mask (linear gradient endpoints,
// radial center + size). A full-viewport SVG (pointer-events: none) draws handles in
// viewport coordinates over the letterboxed canvas content; only the handles capture
// pointer events so panels stay clickable.

import { RefObject, useEffect, useReducer, useRef } from "react";
import { useEditorStore } from "../store/editorStore";

export function MaskOverlay({ canvasRef }: { canvasRef: RefObject<HTMLCanvasElement | null> }) {
  const image = useEditorStore((s) => s.image);
  const local = useEditorStore((s) =>
    s.recipe.localAdjustments.find((l) => l.id === s.selectedMaskId)
  );
  const updateLocal = useEditorStore((s) => s.updateLocal);
  const commit = useEditorStore((s) => s.commit);
  const [, force] = useReducer((n) => n + 1, 0);
  const drag = useRef<string | null>(null);

  // Re-render when the canvas box changes (resize / scroll).
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

  if (!image || !local || (local.mask.kind !== "linear" && local.mask.kind !== "radial")) {
    return null;
  }
  const canvas = canvasRef.current;
  if (!canvas) return null;

  // Displayed content rect (object-fit: contain letterbox).
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

  const onDown = (handle: string) => (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = handle;
    e.stopPropagation();
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current || !local) return;
    const [ix, iy] = toImg(e.clientX, e.clientY);
    updateLocal(local.id, (la) => {
      if (la.mask.kind === "linear") {
        if (drag.current === "p1") {
          la.mask.linear.x1 = ix;
          la.mask.linear.y1 = iy;
        } else {
          la.mask.linear.x2 = ix;
          la.mask.linear.y2 = iy;
        }
      } else if (la.mask.kind === "radial") {
        if (drag.current === "c") {
          la.mask.radial.cx = ix;
          la.mask.radial.cy = iy;
        } else {
          la.mask.radial.rx = Math.max(0.02, Math.abs(ix - la.mask.radial.cx));
          la.mask.radial.ry = Math.max(0.02, Math.abs(iy - la.mask.radial.cy));
        }
      }
    });
  };
  const onUp = () => {
    if (drag.current) commit();
    drag.current = null;
  };

  const handleProps = (id: string) => ({
    r: 7,
    className: "mask-handle",
    onPointerDown: onDown(id),
    onPointerMove: onMove,
    onPointerUp: onUp,
  });

  return (
    <svg className="mask-overlay">
      {local.mask.kind === "linear" &&
        (() => {
          const [x1, y1] = toPx(local.mask.linear.x1, local.mask.linear.y1);
          const [x2, y2] = toPx(local.mask.linear.x2, local.mask.linear.y2);
          return (
            <>
              <line x1={x1} y1={y1} x2={x2} y2={y2} className="mask-line" />
              <circle cx={x1} cy={y1} {...handleProps("p1")} />
              <circle cx={x2} cy={y2} {...handleProps("p2")} />
            </>
          );
        })()}
      {local.mask.kind === "radial" &&
        (() => {
          const m = local.mask.radial;
          const [cx, cy] = toPx(m.cx, m.cy);
          const [ex, ey] = toPx(m.cx + m.rx, m.cy + m.ry);
          return (
            <>
              <ellipse cx={cx} cy={cy} rx={Math.abs(ex - cx)} ry={Math.abs(ey - cy)} className="mask-line" />
              <circle cx={cx} cy={cy} {...handleProps("c")} />
              <circle cx={ex} cy={ey} {...handleProps("e")} />
            </>
          );
        })()}
    </svg>
  );
}

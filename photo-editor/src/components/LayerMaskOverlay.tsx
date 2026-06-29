// Canvas drag handles for the selected layer's spatial mask (linear / radial).
// Mirrors MaskOverlay but edits recipe.layerStack[*].mask via updateLayer.

import { RefObject, useEffect, useReducer, useRef } from "react";
import { useEditorStore } from "../store/editorStore";

export function LayerMaskOverlay({ canvasRef }: { canvasRef: RefObject<HTMLCanvasElement | null> }) {
  const image = useEditorStore((s) => s.image);
  const layer = useEditorStore((s) =>
    s.recipe.layerStack.find((p) => p.id === s.selectedLayerId)
  );
  const updateLayer = useEditorStore((s) => s.updateLayer);
  const commit = useEditorStore((s) => s.commit);
  const [, force] = useReducer((n) => n + 1, 0);
  const drag = useRef<string | null>(null);

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
  const mask = layer?.mask;
  if (!image || !layer || !mask || (mask.kind !== "linear" && mask.kind !== "radial") || !canvas) {
    return null;
  }

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

  const onDown = (h: string) => (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = h;
    e.stopPropagation();
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current || !layer) return;
    const [ix, iy] = toImg(e.clientX, e.clientY);
    updateLayer(layer.id, (lp) => {
      if (!lp.mask) return;
      if (lp.mask.kind === "linear") {
        if (drag.current === "p1") {
          lp.mask.linear.x1 = ix;
          lp.mask.linear.y1 = iy;
        } else {
          lp.mask.linear.x2 = ix;
          lp.mask.linear.y2 = iy;
        }
      } else if (lp.mask.kind === "radial") {
        if (drag.current === "c") {
          lp.mask.radial.cx = ix;
          lp.mask.radial.cy = iy;
        } else {
          lp.mask.radial.rx = Math.max(0.02, Math.abs(ix - lp.mask.radial.cx));
          lp.mask.radial.ry = Math.max(0.02, Math.abs(iy - lp.mask.radial.cy));
        }
      }
    });
  };
  const onUp = () => {
    if (drag.current) commit();
    drag.current = null;
  };
  const hp = (id: string) => ({
    r: 7,
    className: "mask-handle",
    onPointerDown: onDown(id),
    onPointerMove: onMove,
    onPointerUp: onUp,
  });

  return (
    <svg className="mask-overlay">
      {mask.kind === "linear" &&
        (() => {
          const [x1, y1] = toPx(mask.linear.x1, mask.linear.y1);
          const [x2, y2] = toPx(mask.linear.x2, mask.linear.y2);
          return (
            <>
              <line x1={x1} y1={y1} x2={x2} y2={y2} className="mask-line" />
              <circle cx={x1} cy={y1} {...hp("p1")} />
              <circle cx={x2} cy={y2} {...hp("p2")} />
            </>
          );
        })()}
      {mask.kind === "radial" &&
        (() => {
          const m = mask.radial;
          const [cx, cy] = toPx(m.cx, m.cy);
          const [ex, ey] = toPx(m.cx + m.rx, m.cy + m.ry);
          return (
            <>
              <ellipse cx={cx} cy={cy} rx={Math.abs(ex - cx)} ry={Math.abs(ey - cy)} className="mask-line" />
              <circle cx={cx} cy={cy} {...hp("c")} />
              <circle cx={ex} cy={ey} {...hp("e")} />
            </>
          );
        })()}
    </svg>
  );
}

// The GPU-rendered preview. Owns a RenderPipeline tied to a <canvas>, re-renders
// whenever the image or recipe changes. Sizing fits the image into the viewport
// while preserving aspect ratio; zoom/pan is a CSS transform on the canvas element
// (origin top-left) so the on-image overlays keep mapping via getBoundingClientRect.

import { useEffect, useRef } from "react";
import { RenderPipeline } from "../editor/pipeline";
import { DEFAULT_RECIPE } from "../editor/recipe";
import { useEditorStore, ViewTransform, ZOOM_MAX } from "../store/editorStore";
import { MaskOverlay } from "./MaskOverlay";
import { HealOverlay } from "./HealOverlay";
import { LayerMaskOverlay } from "./LayerMaskOverlay";
import { BrushLayer } from "./BrushLayer";

const WRAP_PAD = 28; // must match .canvas-wrap padding

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pipelineRef = useRef<RenderPipeline | null>(null);

  const image = useEditorStore((s) => s.image);
  const recipe = useEditorStore((s) => s.recipe);
  const mask = useEditorStore((s) => s.mask);
  const layers = useEditorStore((s) => s.layers);
  const showOriginal = useEditorStore((s) => s.showOriginal);
  const view = useEditorStore((s) => s.view);
  const setView = useEditorStore((s) => s.setView);
  const resetView = useEditorStore((s) => s.resetView);
  const tool = useEditorStore((s) => s.tool);
  const selMask = useEditorStore((s) => s.selectedMaskId);
  const selSpot = useEditorStore((s) => s.selectedSpotId);
  const selLayer = useEditorStore((s) => s.selectedLayerId);

  // Latest values for the native (non-passive) wheel listener, which is bound once.
  const viewRef = useRef(view);
  viewRef.current = view;
  // True when nothing on-canvas wants the drag (so left-drag is free to pan).
  const idleRef = useRef(true);
  idleRef.current = tool === "none" && !selMask && !selSpot && !selLayer;

  // Init pipeline once.
  useEffect(() => {
    if (!canvasRef.current) return;
    try {
      pipelineRef.current = new RenderPipeline(canvasRef.current);
    } catch (e) {
      console.error(e);
    }
    return () => {
      pipelineRef.current?.dispose();
      pipelineRef.current = null;
    };
  }, []);

  // Upload image when it changes, sizing the canvas to the image resolution
  // (capped) so the GPU render matches the source aspect ratio.
  useEffect(() => {
    const pipe = pipelineRef.current;
    const canvas = canvasRef.current;
    if (!pipe || !canvas || !image) return;
    const MAX = 2400; // preview cap; export renders full-res later
    const scale = Math.min(1, MAX / Math.max(image.width, image.height));
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    pipe.setImage(image.bitmap, image.width, image.height);
    pipe.render(recipe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image]);

  // Upload the AI matte texture when it changes.
  useEffect(() => {
    pipelineRef.current?.setMask(mask);
  }, [mask]);

  // Upload layer textures when the layer set changes.
  useEffect(() => {
    pipelineRef.current?.setLayers(layers);
  }, [layers]);

  // Re-render on recipe / mask / layers / before-after change.
  useEffect(() => {
    const pipe = pipelineRef.current;
    if (!pipe || !pipe.hasImage()) return;
    pipe.render(showOriginal ? DEFAULT_RECIPE : recipe);
  }, [recipe, showOriginal, mask, layers]);

  // The on-image overlays read the canvas rect during render; a CSS-transform change
  // is invisible to them, so nudge them after each view change (post-commit).
  useEffect(() => {
    window.dispatchEvent(new Event("resize"));
  }, [view]);

  // Wheel-to-zoom toward the cursor (native, non-passive so we can preventDefault).
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const onWheel = (e: WheelEvent) => {
      if (!useEditorStore.getState().image) return;
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0015); // smooth, direction-correct
      setView(zoomAt(viewRef.current, canvas, wrap, e.clientX, e.clientY, factor));
    };
    wrap.addEventListener("wheel", onWheel, { passive: false });
    return () => wrap.removeEventListener("wheel", onWheel);
  }, [setView]);

  // Space = temporary hand tool (pan at any zoom), like Lightroom/Photoshop.
  const spaceRef = useRef(false);
  useEffect(() => {
    const isField = (t: EventTarget | null) =>
      t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isField(e.target) && useEditorStore.getState().image) {
        spaceRef.current = true;
        e.preventDefault();
        if (wrapRef.current) wrapRef.current.style.cursor = "grab";
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceRef.current = false;
        if (wrapRef.current) wrapRef.current.style.cursor = "";
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Drag to pan: Space-hold or middle button always; left-drag only when zoomed in
  // and no on-canvas tool/selection wants the gesture.
  const pan = useRef<{ x: number; y: number } | null>(null);
  const overChrome = (e: { target: EventTarget | null }) =>
    e.target instanceof HTMLElement && e.target.closest(".zoom-bar");
  const onPointerDown = (e: React.PointerEvent) => {
    if (!image || overChrome(e)) return;
    const v = viewRef.current;
    // The heal brush owns canvas drags; don't fight it for pointer capture.
    const wantsPan =
      tool !== "healBrush" &&
      (spaceRef.current || e.button === 1 || (e.button === 0 && v.zoom > 1 && idleRef.current));
    if (!wantsPan) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    pan.current = { x: e.clientX, y: e.clientY };
    if (wrapRef.current) wrapRef.current.style.cursor = "grabbing";
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pan.current) return;
    const dx = e.clientX - pan.current.x;
    const dy = e.clientY - pan.current.y;
    pan.current = { x: e.clientX, y: e.clientY };
    const v = viewRef.current;
    setView(clampView({ zoom: v.zoom, x: v.x + dx, y: v.y + dy }, canvasRef.current!, wrapRef.current!));
  };
  const onPointerUp = () => {
    pan.current = null;
    if (wrapRef.current) wrapRef.current.style.cursor = spaceRef.current ? "grab" : "";
  };

  // Double-click toggles Fit ⇄ 100% (centered on the cursor).
  const onDoubleClick = (e: React.MouseEvent) => {
    if (!image || overChrome(e) || !idleRef.current || !canvasRef.current || !wrapRef.current) return;
    const canvas = canvasRef.current;
    if (viewRef.current.zoom > 1.001) {
      resetView();
    } else {
      const target = actualPixelZoom(canvas, wrapRef.current) / viewRef.current.zoom;
      setView(zoomAt(viewRef.current, canvas, wrapRef.current, e.clientX, e.clientY, target));
    }
  };

  const zoomPct = Math.round(view.zoom * 100); // % relative to fit (Fit = 100%)
  const transform = `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`;

  return (
    <div
      className="canvas-wrap"
      ref={wrapRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={onDoubleClick}
    >
      {!image && (
        <div className="canvas-empty">
          <p>Open an image to start editing</p>
          <p className="hint">Drag a slider — every edit is non-destructive.</p>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="preview"
        style={{ display: image ? "block" : "none", transform, transformOrigin: "0 0" }}
      />
      <MaskOverlay canvasRef={canvasRef} />
      <HealOverlay canvasRef={canvasRef} />
      <LayerMaskOverlay canvasRef={canvasRef} />
      <BrushLayer canvasRef={canvasRef} />
      {image && (
        <div className="zoom-bar">
          <button title="Zoom out" onClick={() => zoomStep(0.8)}>
            −
          </button>
          <button className="zoom-pct" title="Reset to Fit" onClick={resetView}>
            {zoomPct}%
          </button>
          <button title="Zoom in" onClick={() => zoomStep(1.25)}>
            +
          </button>
          <button title="Fit to screen" onClick={resetView}>
            Fit
          </button>
          <button title="100% (actual pixels)" onClick={() => zoomTo100()}>
            1:1
          </button>
        </div>
      )}
    </div>
  );

  // Step zoom around the viewport center (for the +/− buttons).
  function zoomStep(factor: number) {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const r = wrap.getBoundingClientRect();
    setView(zoomAt(viewRef.current, canvas, wrap, r.left + r.width / 2, r.top + r.height / 2, factor));
  }
  function zoomTo100() {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const r = wrap.getBoundingClientRect();
    const target = actualPixelZoom(canvas, wrap) / viewRef.current.zoom;
    setView(zoomAt(viewRef.current, canvas, wrap, r.left + r.width / 2, r.top + r.height / 2, target));
  }
}

// ---- view math (pure) ----

// Content box of the wrap (where the fitted canvas is centered).
function contentBox(wrap: HTMLElement) {
  const r = wrap.getBoundingClientRect();
  return {
    left: r.left + WRAP_PAD,
    top: r.top + WRAP_PAD,
    width: Math.max(1, r.width - WRAP_PAD * 2),
    height: Math.max(1, r.height - WRAP_PAD * 2),
  };
}

// The fitted (zoom-1) on-screen size of the canvas, object-fit:contain style.
function fittedSize(canvas: HTMLCanvasElement, wrap: HTMLElement) {
  const c = contentBox(wrap);
  const aspect = canvas.width / canvas.height;
  let w = c.width;
  let h = w / aspect;
  if (h > c.height) {
    h = c.height;
    w = h * aspect;
  }
  return { w, h, c };
}

// Zoom that makes one buffer pixel equal one CSS pixel (≈ Lightroom "100%").
function actualPixelZoom(canvas: HTMLCanvasElement, wrap: HTMLElement) {
  const { w } = fittedSize(canvas, wrap);
  return clampZoom(canvas.width / w);
}

function clampZoom(z: number) {
  return Math.min(ZOOM_MAX, Math.max(1, z));
}

// Apply a zoom factor around a screen point, keeping that point stationary.
function zoomAt(
  v: ViewTransform,
  canvas: HTMLCanvasElement,
  wrap: HTMLElement,
  cx: number,
  cy: number,
  factor: number
): ViewTransform {
  const z2 = clampZoom(v.zoom * factor);
  const rect = canvas.getBoundingClientRect();
  const k = z2 / v.zoom;
  const x = cx - (cx - rect.left) * k - rect.left + v.x;
  const y = cy - (cy - rect.top) * k - rect.top + v.y;
  return clampView({ zoom: z2, x, y }, canvas, wrap);
}

// Keep the scaled image covering the viewport (or centered when smaller than it).
function clampView(v: ViewTransform, canvas: HTMLCanvasElement, wrap: HTMLElement): ViewTransform {
  if (v.zoom <= 1.001) return { zoom: 1, x: 0, y: 0 };
  const { w, h, c } = fittedSize(canvas, wrap);
  const L0 = c.left + (c.width - w) / 2; // centered layout left at zoom 1
  const T0 = c.top + (c.height - h) / 2;
  const sw = w * v.zoom;
  const sh = h * v.zoom;
  const clampAxis = (pos: number, base: number, scaled: number, lo: number, size: number) => {
    if (scaled <= size) return lo + (size - scaled) / 2 - base; // center when smaller
    const min = lo + size - (base + scaled); // image right/bottom edge ≥ viewport
    const max = lo - base; // image left/top edge ≤ viewport
    return Math.min(max, Math.max(min, pos));
  };
  return {
    zoom: v.zoom,
    x: clampAxis(v.x, L0, sw, c.left, c.width),
    y: clampAxis(v.y, T0, sh, c.top, c.height),
  };
}

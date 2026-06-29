// The GPU-rendered preview. Owns a RenderPipeline tied to a <canvas>, re-renders
// whenever the image or recipe changes. Sizing fits the image into the viewport
// while preserving aspect ratio.

import { useEffect, useRef } from "react";
import { RenderPipeline } from "../editor/pipeline";
import { DEFAULT_RECIPE } from "../editor/recipe";
import { useEditorStore } from "../store/editorStore";
import { MaskOverlay } from "./MaskOverlay";
import { HealOverlay } from "./HealOverlay";
import { LayerMaskOverlay } from "./LayerMaskOverlay";
import { BrushLayer } from "./BrushLayer";

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pipelineRef = useRef<RenderPipeline | null>(null);

  const image = useEditorStore((s) => s.image);
  const recipe = useEditorStore((s) => s.recipe);
  const mask = useEditorStore((s) => s.mask);
  const layers = useEditorStore((s) => s.layers);
  const showOriginal = useEditorStore((s) => s.showOriginal);

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

  return (
    <div className="canvas-wrap">
      {!image && (
        <div className="canvas-empty">
          <p>Open an image to start editing</p>
          <p className="hint">Drag a slider — every edit is non-destructive.</p>
        </div>
      )}
      <canvas ref={canvasRef} className="preview" style={{ display: image ? "block" : "none" }} />
      <MaskOverlay canvasRef={canvasRef} />
      <HealOverlay canvasRef={canvasRef} />
      <LayerMaskOverlay canvasRef={canvasRef} />
      <BrushLayer canvasRef={canvasRef} />
    </div>
  );
}

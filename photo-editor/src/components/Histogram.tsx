// Live RGB histogram computed from the source image + current recipe. We compute
// it on a small offscreen canvas (CPU) for simplicity; for M2+ this can read back
// from the GPU framebuffer instead.

import { useEffect, useRef } from "react";
import { useEditorStore } from "../store/editorStore";

const BINS = 128;

export function Histogram() {
  const ref = useRef<HTMLCanvasElement>(null);
  const image = useEditorStore((s) => s.image);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !image) return;

    // Downsample the source for a fast histogram of the underlying pixels.
    const off = document.createElement("canvas");
    const w = (off.width = 256);
    const h = (off.height = Math.max(1, Math.round((256 * image.height) / image.width)));
    const ctx = off.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image.bitmap, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);

    const r = new Array(BINS).fill(0);
    const g = new Array(BINS).fill(0);
    const b = new Array(BINS).fill(0);
    for (let i = 0; i < data.length; i += 4) {
      r[(data[i] * (BINS - 1)) >> 8]++;
      g[(data[i + 1] * (BINS - 1)) >> 8]++;
      b[(data[i + 2] * (BINS - 1)) >> 8]++;
    }
    const max = Math.max(...r, ...g, ...b, 1);

    const c = canvas.getContext("2d")!;
    const cw = canvas.width;
    const ch = canvas.height;
    c.clearRect(0, 0, cw, ch);
    c.globalCompositeOperation = "lighter";
    const draw = (arr: number[], color: string) => {
      c.fillStyle = color;
      for (let i = 0; i < BINS; i++) {
        const x = (i / BINS) * cw;
        const bh = (arr[i] / max) * ch;
        c.fillRect(x, ch - bh, cw / BINS, bh);
      }
    };
    draw(r, "rgba(255,60,60,0.7)");
    draw(g, "rgba(60,255,60,0.7)");
    draw(b, "rgba(80,120,255,0.7)");
    c.globalCompositeOperation = "source-over";
  }, [image]);

  return <canvas ref={ref} className="histogram" width={260} height={90} />;
}

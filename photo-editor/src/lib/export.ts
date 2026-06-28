// Full-resolution export. The preview renders at a capped size for interactivity;
// export renders the recipe at the image's native resolution into an offscreen
// canvas, then encodes to PNG / JPEG / WebP.

import { RenderPipeline } from "../editor/pipeline";
import { Recipe } from "../editor/recipe";
import { ImageMask, LoadedImage } from "../store/editorStore";
import { saveBinaryFile } from "./platform";

export type ExportFormat = "png" | "jpeg" | "webp";

const MIME: Record<ExportFormat, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

// Render the edited image at native resolution and return an encoded Blob.
export async function renderToBlob(
  image: LoadedImage,
  recipe: Recipe,
  mask: ImageMask | null,
  format: ExportFormat,
  quality = 0.92,
  watermark = false
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const pipe = new RenderPipeline(canvas);
  try {
    pipe.setImage(image.bitmap, image.width, image.height);
    pipe.setMask(mask);
    pipe.render(recipe);

    // JPEG/WebP have no alpha — a transparent matte would flatten to black, so
    // composite over white. The watermark also needs a 2D canvas.
    const flatten = format !== "png";
    let source: HTMLCanvasElement = canvas;
    if (watermark || flatten) {
      const c2 = document.createElement("canvas");
      c2.width = canvas.width;
      c2.height = canvas.height;
      const ctx = c2.getContext("2d")!;
      if (flatten) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, c2.width, c2.height);
      }
      ctx.drawImage(canvas, 0, 0);
      if (watermark) {
        const fs = Math.max(18, Math.round(canvas.width * 0.025));
        ctx.font = `600 ${fs}px sans-serif`;
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        const x = canvas.width - fs * 0.6;
        const y = canvas.height - fs * 0.6;
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillText("Made with Lumen", x + 2, y + 2);
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fillText("Made with Lumen", x, y);
      }
      source = c2;
    }

    return await new Promise<Blob>((resolve, reject) =>
      source.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("encoding failed"))),
        MIME[format],
        quality
      )
    );
  } finally {
    pipe.dispose();
  }
}

// Render + save via the platform save dialog / browser download.
export async function exportImage(
  image: LoadedImage,
  recipe: Recipe,
  mask: ImageMask | null,
  format: ExportFormat,
  quality = 0.92,
  watermark = false
): Promise<void> {
  const blob = await renderToBlob(image, recipe, mask, format, quality, watermark);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const base = image.name.replace(/\.[^.]+$/, "");
  const ext = format === "jpeg" ? "jpg" : format;
  await saveBinaryFile(`${base}-edited.${ext}`, bytes);
}

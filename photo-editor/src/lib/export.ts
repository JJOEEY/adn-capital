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
  quality = 0.92
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const pipe = new RenderPipeline(canvas);
  try {
    pipe.setImage(image.bitmap, image.width, image.height);
    pipe.setMask(mask);
    pipe.render(recipe);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
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
  quality = 0.92
): Promise<void> {
  const blob = await renderToBlob(image, recipe, mask, format, quality);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const base = image.name.replace(/\.[^.]+$/, "");
  const ext = format === "jpeg" ? "jpg" : format;
  await saveBinaryFile(`${base}-edited.${ext}`, bytes);
}

// Platform abstraction: the same UI runs as a Tauri desktop app and as a plain web
// app (handy for development in a headless/browser environment). At runtime we
// detect Tauri and use its native file dialog + filesystem; otherwise we fall back
// to a browser <input type="file">.

import { LoadedImage } from "../store/editorStore";

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

// Decode a File/Blob into a LoadedImage (ImageBitmap + dimensions).
async function decodeBlob(blob: Blob, name: string): Promise<LoadedImage> {
  const bitmap = await createImageBitmap(blob);
  return { bitmap, width: bitmap.width, height: bitmap.height, name };
}

// Open an image via the appropriate picker for the current platform.
export async function openImage(): Promise<LoadedImage | null> {
  if (isTauri()) {
    // Native dialog + Rust-side decode (RAW support lands in M2). For standard
    // formats we read bytes and decode in the webview.
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: "Images",
          extensions: ["jpg", "jpeg", "png", "webp", "tif", "tiff", "nef", "cr3", "arw", "dng", "raf"],
        },
      ],
    });
    if (!selected || Array.isArray(selected)) return null;
    const path = selected as string;
    const name = path.split(/[\\/]/).pop() ?? "image";
    const { invoke } = await import("@tauri-apps/api/core");
    // Rust returns raw RGBA bytes + dims (handles RAW decode in M2). Until then it
    // also handles standard formats so the desktop path is uniform.
    const res = await invoke<{ width: number; height: number; rgba: number[] }>(
      "load_image",
      { path }
    );
    const data = new Uint8ClampedArray(res.rgba);
    const imageData = new ImageData(data, res.width, res.height);
    const bitmap = await createImageBitmap(imageData);
    return { bitmap, width: res.width, height: res.height, name };
  }

  // --- Web fallback ---
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      resolve(await decodeBlob(file, file.name));
    };
    input.click();
  });
}

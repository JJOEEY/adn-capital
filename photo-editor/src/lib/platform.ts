// Platform abstraction: the same UI runs as a Tauri desktop app and as a plain web
// app (handy for development in a headless/browser environment). At runtime we
// detect Tauri and use its native file dialog + filesystem; otherwise we fall back
// to a browser <input type="file">.

import { ImageMask, LoadedImage } from "../store/editorStore";

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
    return { bitmap, width: res.width, height: res.height, name, path };
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

// Run on-device AI background removal (desktop only — needs the native ONNX model).
// Returns a foreground alpha matte at the source resolution.
export async function removeBackground(path: string): Promise<ImageMask> {
  if (!isTauri()) {
    throw new Error("AI background removal runs in the Lumen desktop app.");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  const res = await invoke<{ width: number; height: number; alpha: number[] }>(
    "remove_background",
    { path }
  );
  return { data: new Uint8Array(res.alpha), width: res.width, height: res.height };
}

// Open a text file (e.g. a .cube LUT or a preset .json), returning its contents.
export async function openTextFile(extensions: string[]): Promise<{ name: string; text: string } | null> {
  if (isTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({ multiple: false, filters: [{ name: "File", extensions }] });
    if (!selected || Array.isArray(selected)) return null;
    const path = selected as string;
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const text = await readTextFile(path);
    return { name: path.split(/[\\/]/).pop() ?? "file", text };
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = extensions.map((e) => "." + e).join(",");
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      resolve({ name: file.name, text: await file.text() });
    };
    input.click();
  });
}

// Save text to a file via the native save dialog (Tauri) or a browser download.
export async function saveTextFile(defaultName: string, text: string): Promise<void> {
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const path = await save({ defaultPath: defaultName });
    if (!path) return;
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    await writeTextFile(path, text);
    return;
  }
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = defaultName;
  a.click();
  URL.revokeObjectURL(url);
}

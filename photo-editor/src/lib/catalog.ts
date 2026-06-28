// The catalog: per-image non-destructive edit persistence + a recents list. Each
// opened image gets an entry keyed by its identity; its recipe is auto-saved and
// re-applied when the same image is reopened. Stored in localStorage (works in the
// desktop webview and the browser).

import { reviveRecipe, Recipe } from "../editor/recipe";
import { LoadedImage } from "../store/editorStore";

export type Flag = "none" | "pick" | "reject";

export interface CatalogEntry {
  key: string;
  name: string;
  path?: string; // present for desktop-opened files (enables reopen)
  width: number;
  height: number;
  thumb: string; // small data-URL preview
  recipe: Recipe;
  rating: number; // 0..5 stars
  flag: Flag;
  updatedAt: number;
}

const KEY = "lumen.catalog.v1";
const MAX_ENTRIES = 60;

export function makeKey(img: LoadedImage): string {
  return img.path ?? `${img.name}:${img.width}x${img.height}`;
}

type Catalog = Record<string, CatalogEntry>;

function read(): Catalog {
  try {
    const cat = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Catalog;
    Object.values(cat).forEach((e) => reviveRecipe(e.recipe));
    return cat;
  } catch {
    return {};
  }
}

function write(cat: Catalog) {
  // Most-recent first, capped to bound storage.
  let entries = Object.values(cat).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_ENTRIES);
  // Persist, shrinking on quota errors so one big save can't break the catalog.
  for (let attempt = 0; attempt < 4 && entries.length > 0; attempt++) {
    const kept: Catalog = {};
    for (const e of entries) kept[e.key] = e;
    try {
      localStorage.setItem(KEY, JSON.stringify(kept));
      return;
    } catch {
      // Drop thumbnails first (the bulk of the size), then the oldest entries.
      if (attempt === 0) entries = entries.map((e) => ({ ...e, thumb: "" }));
      else entries = entries.slice(0, Math.max(1, Math.floor(entries.length / 2)));
    }
  }
}

export function getEntry(key: string): CatalogEntry | undefined {
  return read()[key];
}

export function listRecent(limit = 24): CatalogEntry[] {
  return Object.values(read())
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
}

export function removeEntry(key: string) {
  const cat = read();
  delete cat[key];
  write(cat);
}

// Build a small JPEG thumbnail data-URL from the source bitmap.
export function makeThumb(img: LoadedImage, size = 200): string {
  const scale = Math.min(1, size / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.width * scale));
  c.height = Math.max(1, Math.round(img.height * scale));
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(img.bitmap, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.6);
}

export function saveEntry(img: LoadedImage, recipe: Recipe, thumb?: string) {
  const cat = read();
  const key = makeKey(img);
  const prev = cat[key];
  cat[key] = {
    key,
    name: img.name,
    path: img.path,
    width: img.width,
    height: img.height,
    thumb: thumb ?? prev?.thumb ?? "",
    recipe,
    rating: prev?.rating ?? 0, // preserve culling metadata across edits
    flag: prev?.flag ?? "none",
    updatedAt: Date.now(),
  };
  write(cat);
}

// Update just the culling metadata (rating / flag) for an entry.
export function setMeta(key: string, patch: { rating?: number; flag?: Flag }) {
  const cat = read();
  const e = cat[key];
  if (!e) return;
  if (patch.rating !== undefined) e.rating = patch.rating;
  if (patch.flag !== undefined) e.flag = patch.flag;
  e.updatedAt = Date.now();
  write(cat);
}

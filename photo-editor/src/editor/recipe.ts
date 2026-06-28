// Non-destructive edit "recipe": the full description of every adjustment applied
// to an image. The source pixels are never mutated — the recipe is serialized to
// the catalog (SQLite) and re-applied by the render pipeline on load.
//
// Keep this in sync with the GLSL uniforms in pipeline.ts. Adding a field here is
// the canonical way to add a new global adjustment.

import { Look, defaultLook, isDefaultLook } from "./color/look";
import { CubeLut } from "./color/lut";

export interface Recipe {
  // Light
  exposure: number; // EV, -5 .. +5
  contrast: number; // -100 .. 100
  highlights: number; // -100 .. 100
  shadows: number; // -100 .. 100
  whites: number; // -100 .. 100
  blacks: number; // -100 .. 100

  // Color — white balance
  temp: number; // -100 (cool) .. 100 (warm)
  tint: number; // -100 (green) .. 100 (magenta)

  // Color — presence
  saturation: number; // -100 .. 100
  vibrance: number; // -100 .. 100

  // Detail (display-space approximation for now)
  clarity: number; // -100 .. 100

  // M3 — color grading (non-scalar; edited via the color panels, not sliders)
  look: Look;
  lut: CubeLut | null; // imported 3D .cube LUT, applied last
}

export const DEFAULT_RECIPE: Recipe = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  temp: 0,
  tint: 0,
  saturation: 0,
  vibrance: 0,
  clarity: 0,
  look: defaultLook(),
  lut: null,
};

// The scalar (number-valued) adjustment fields — the ones driven by sliders.
export type ScalarKey = {
  [K in keyof Recipe]: Recipe[K] extends number ? K : never;
}[keyof Recipe];

// Slider metadata drives the adjustment panel UI and clamping. One source of truth.
export interface AdjustSpec {
  key: ScalarKey;
  label: string;
  group: "Light" | "Color" | "Detail";
  min: number;
  max: number;
  step: number;
}

export const ADJUSTMENTS: AdjustSpec[] = [
  { key: "exposure", label: "Exposure", group: "Light", min: -5, max: 5, step: 0.01 },
  { key: "contrast", label: "Contrast", group: "Light", min: -100, max: 100, step: 1 },
  { key: "highlights", label: "Highlights", group: "Light", min: -100, max: 100, step: 1 },
  { key: "shadows", label: "Shadows", group: "Light", min: -100, max: 100, step: 1 },
  { key: "whites", label: "Whites", group: "Light", min: -100, max: 100, step: 1 },
  { key: "blacks", label: "Blacks", group: "Light", min: -100, max: 100, step: 1 },
  { key: "temp", label: "Temperature", group: "Color", min: -100, max: 100, step: 1 },
  { key: "tint", label: "Tint", group: "Color", min: -100, max: 100, step: 1 },
  { key: "vibrance", label: "Vibrance", group: "Color", min: -100, max: 100, step: 1 },
  { key: "saturation", label: "Saturation", group: "Color", min: -100, max: 100, step: 1 },
  { key: "clarity", label: "Clarity", group: "Detail", min: -100, max: 100, step: 1 },
];

export function isDefault(r: Recipe): boolean {
  const scalarsDefault = ADJUSTMENTS.every((a) => r[a.key] === DEFAULT_RECIPE[a.key]);
  return scalarsDefault && isDefaultLook(r.look) && r.lut === null;
}

export function cloneRecipe(r: Recipe): Recipe {
  // Deep-clone the nested color-grade state (look + LUT typed arrays) so history
  // snapshots are independent.
  return {
    ...r,
    look: structuredClone(r.look),
    lut: r.lut ? structuredClone(r.lut) : null,
  };
}

// Value equality for history dedup (handles nested look + LUT typed arrays).
export function recipesEqual(a: Recipe, b: Recipe): boolean {
  if (!ADJUSTMENTS.every((s) => a[s.key] === b[s.key])) return false;
  return JSON.stringify(a.look) === JSON.stringify(b.look) && lutEqual(a.lut, b.lut);
}

// Coerce LUT data to a real Float32Array (a JSON round-trip turns it into a plain
// indexed object, which has no .length/.every).
function asF32(d: Float32Array | ArrayLike<number>): Float32Array {
  return d instanceof Float32Array ? d : Float32Array.from(Object.values(d as object) as number[]);
}

function lutEqual(a: CubeLut | null, b: CubeLut | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.dim !== b.dim || a.size !== b.size) return false;
  const da = asF32(a.data);
  const db = asF32(b.data);
  if (da.length !== db.length) return false;
  for (let i = 0; i < da.length; i++) if (da[i] !== db[i]) return false;
  return true;
}

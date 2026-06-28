// Non-destructive edit "recipe": the full description of every adjustment applied
// to an image. The source pixels are never mutated — the recipe is serialized to
// the catalog (SQLite) and re-applied by the render pipeline on load.
//
// Keep this in sync with the GLSL uniforms in pipeline.ts. Adding a field here is
// the canonical way to add a new global adjustment.

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
};

// Slider metadata drives the adjustment panel UI and clamping. One source of truth.
export interface AdjustSpec {
  key: keyof Recipe;
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
  return (Object.keys(DEFAULT_RECIPE) as (keyof Recipe)[]).every(
    (k) => r[k] === DEFAULT_RECIPE[k]
  );
}

export function cloneRecipe(r: Recipe): Recipe {
  return { ...r };
}

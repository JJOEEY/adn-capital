// Retouch: spot heal / clone (the "remove an object" tool). Each spot copies pixels
// from a source location to a destination circle; "heal" additionally matches the
// destination's surrounding color/tone, "clone" copies verbatim. Spots are part of
// the recipe (positions in 0..1 image space) and render as extra GPU passes.

export type HealMode = "heal" | "clone";

export interface HealSpot {
  id: string;
  dx: number; // destination center, 0..1 image space
  dy: number;
  sx: number; // source center, 0..1
  sy: number;
  radius: number; // 0..0.5 (fraction of the image's smaller dimension feel)
  feather: number; // 0..1
  mode: HealMode;
}

export function newHealSpot(dx = 0.5, dy = 0.5, idSeed?: string): HealSpot {
  return {
    id: idSeed ?? (globalThis.crypto?.randomUUID?.() ?? `spot_${Date.now()}`),
    dx,
    dy,
    sx: Math.min(0.95, dx + 0.08), // default source just to the side
    sy: dy,
    radius: 0.05,
    feather: 0.5,
    mode: "heal",
  };
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (a: number, b: number, x: number) => {
  if (a === b) return x < a ? 0 : 1;
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// Coverage weight of a spot at image-space (px,py). `aspect` = width/height keeps the
// destination circular regardless of image proportions. Mirrored in the GLSL pass.
export function spotWeight(px: number, py: number, s: HealSpot, aspect: number): number {
  const dx = (px - s.dx) * aspect;
  const dy = py - s.dy;
  const d = Math.sqrt(dx * dx + dy * dy) / Math.max(1e-4, s.radius);
  const f = Math.max(1e-4, clamp01(s.feather));
  return 1 - smoothstep(1 - f, 1, d);
}

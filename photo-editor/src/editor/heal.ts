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

// A freehand heal/clone stroke: a painted polyline (points in 0..1 image space) that
// is rasterized to a coverage mask; pixels under it heal/clone from a source offset.
export interface HealStroke {
  id: string;
  points: number[]; // flattened x0,y0,x1,y1,… in 0..1 image space
  radius: number; // brush radius, 0..0.3
  feather: number; // 0..1
  offsetX: number; // source offset from destination (image space)
  offsetY: number;
  mode: HealMode;
}

export function newHealStroke(points: number[], radius: number, mode: HealMode): HealStroke {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `stroke_${Date.now()}`,
    points,
    radius,
    feather: 0.5,
    offsetX: radius * 2.2, // sample from a couple of brush-widths to the side
    offsetY: 0,
    mode,
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

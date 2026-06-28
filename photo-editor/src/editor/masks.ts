// Local adjustments (Pillar 1 / "pro masking"). A local adjustment is a mask (which
// region) plus a set of parameter deltas applied weighted by the mask. Multiple
// local adjustments stack as separate render passes.
//
// Mask weight is pure math (mirrored in GLSL for the GPU); the functions here are the
// CPU reference and are unit-tested.

export type MaskKind = "linear" | "radial" | "rangeLuma" | "aiSubject";

export interface LinearMask {
  // Gradient runs from line through p1 (weight 0) to line through p2 (weight 1),
  // perpendicular to p1→p2. Points in 0..1 image space.
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface RadialMask {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  angle: number; // radians
  feather: number; // 0..1 transition width
}

export interface RangeMask {
  lo: number;
  hi: number;
  feather: number;
}

export interface MaskDef {
  kind: MaskKind;
  invert: boolean;
  linear: LinearMask;
  radial: RadialMask;
  range: RangeMask;
}

// Local parameter deltas (a focused subset of the global light/color controls).
export interface LocalParams {
  exposure: number; // -100..100 (mapped to a gentle EV range)
  contrast: number;
  temp: number;
  tint: number;
  saturation: number;
}

export interface LocalAdjustment {
  id: string;
  name: string;
  visible: boolean;
  mask: MaskDef;
  params: LocalParams;
}

export const ZERO_LOCAL: LocalParams = {
  exposure: 0,
  contrast: 0,
  temp: 0,
  tint: 0,
  saturation: 0,
};

// Slider metadata for the local-adjustment panel.
export const LOCAL_SLIDERS: { key: keyof LocalParams; label: string }[] = [
  { key: "exposure", label: "Exposure" },
  { key: "contrast", label: "Contrast" },
  { key: "temp", label: "Temp" },
  { key: "tint", label: "Tint" },
  { key: "saturation", label: "Saturation" },
];

export function defaultMask(kind: MaskKind): MaskDef {
  return {
    kind,
    invert: false,
    linear: { x1: 0.5, y1: 0.2, x2: 0.5, y2: 0.8 },
    radial: { cx: 0.5, cy: 0.5, rx: 0.3, ry: 0.3, angle: 0, feather: 0.5 },
    range: { lo: 0.0, hi: 0.5, feather: 0.1 },
  };
}

export function newLocalAdjustment(kind: MaskKind, idSeed?: string): LocalAdjustment {
  const id = idSeed ?? (globalThis.crypto?.randomUUID?.() ?? `m_${Date.now()}_${kind}`);
  const label: Record<MaskKind, string> = {
    linear: "Linear Gradient",
    radial: "Radial Gradient",
    rangeLuma: "Luminance Range",
    aiSubject: "Subject (AI)",
  };
  return {
    id,
    name: label[kind],
    visible: true,
    mask: defaultMask(kind),
    params: { ...ZERO_LOCAL },
  };
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (a: number, b: number, x: number) => {
  if (a === b) return x < a ? 0 : 1;
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// --- Pure mask weight functions (mirrored in GLSL) ---

export function linearWeight(px: number, py: number, m: LinearMask): number {
  const dx = m.x2 - m.x1;
  const dy = m.y2 - m.y1;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) return 1;
  const t = ((px - m.x1) * dx + (py - m.y1) * dy) / len2;
  return clamp01(t);
}

export function radialWeight(px: number, py: number, m: RadialMask): number {
  const ca = Math.cos(m.angle);
  const sa = Math.sin(m.angle);
  const ox = px - m.cx;
  const oy = py - m.cy;
  // rotate into ellipse-local space
  const lx = (ox * ca + oy * sa) / Math.max(1e-6, m.rx);
  const ly = (-ox * sa + oy * ca) / Math.max(1e-6, m.ry);
  const d = Math.sqrt(lx * lx + ly * ly); // 1 at the ellipse edge
  // center = 1, fading to 0 across the feather band ending at the edge
  return 1 - smoothstep(1 - clamp01(m.feather), 1, d);
}

export function rangeLumaWeight(luma: number, m: RangeMask): number {
  const f = Math.max(1e-4, m.feather);
  const lower = smoothstep(m.lo - f, m.lo, luma);
  const upper = 1 - smoothstep(m.hi, m.hi + f, luma);
  return clamp01(Math.min(lower, upper));
}

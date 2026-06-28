// Layer compositing (Pillar 2). Additional image layers stack on top of the edited
// base photo, each with an opacity and a blend mode. The base photo carries the
// global recipe + local adjustments; layers composite after it.
//
// Layer PIXELS live in the editor store (heavy); the recipe holds only the
// serializable per-layer properties (LayerProps), linked by id.
//
// Blend math is pure and unit-tested; the GLSL LAYER_FRAG mirrors it.

export type BlendMode =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "softlight"
  | "darken"
  | "lighten"
  | "difference"
  | "add";

export const BLEND_MODES: BlendMode[] = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "softlight",
  "darken",
  "lighten",
  "difference",
  "add",
];

export const BLEND_INDEX: Record<BlendMode, number> = {
  normal: 0,
  multiply: 1,
  screen: 2,
  overlay: 3,
  softlight: 4,
  darken: 5,
  lighten: 6,
  difference: 7,
  add: 8,
};

export interface LayerProps {
  id: string;
  name: string;
  visible: boolean;
  opacity: number; // 0..1
  blend: BlendMode;
}

export function newLayerProps(id: string, name: string): LayerProps {
  return { id, name, visible: true, opacity: 1, blend: "normal" };
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Blend one channel of `s` (source/top layer) over `d` (destination/below). Matches
// the standard separable blend formulas (Photoshop / W3C compositing).
export function blendChannel(mode: BlendMode, d: number, s: number): number {
  switch (mode) {
    case "normal":
      return s;
    case "multiply":
      return d * s;
    case "screen":
      return 1 - (1 - d) * (1 - s);
    case "overlay":
      return d < 0.5 ? 2 * d * s : 1 - 2 * (1 - d) * (1 - s);
    case "softlight":
      return s < 0.5
        ? d - (1 - 2 * s) * d * (1 - d)
        : d + (2 * s - 1) * ((d < 0.25 ? ((16 * d - 12) * d + 4) * d : Math.sqrt(d)) - d);
    case "darken":
      return Math.min(d, s);
    case "lighten":
      return Math.max(d, s);
    case "difference":
      return Math.abs(d - s);
    case "add":
      return clamp01(d + s);
    default:
      return s;
  }
}

// Full composite of a layer over a base with opacity (mask handled in the shader).
export function blendRGB(
  mode: BlendMode,
  base: [number, number, number],
  layer: [number, number, number],
  opacity: number
): [number, number, number] {
  const a = clamp01(opacity);
  return [0, 1, 2].map((c) => {
    const blended = clamp01(blendChannel(mode, base[c], layer[c]));
    return clamp01(base[c] * (1 - a) + blended * a);
  }) as [number, number, number];
}

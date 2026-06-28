// HSL / color mixer: 8 hue bands, each with Hue / Saturation / Luminance. Values are
// -1..1 internally (shown as -100..100).

import { HSL_BANDS } from "../../editor/color/look";
import { useLook } from "../../store/useLook";

const BAND_COLORS = [
  "#e25555", "#e2934f", "#d9c34a", "#5fb85f",
  "#4fb8c0", "#5b7fe0", "#8a6fd0", "#c060b0",
];
const SUB: { key: "h" | "s" | "l"; label: string }[] = [
  { key: "h", label: "Hue" },
  { key: "s", label: "Sat" },
  { key: "l", label: "Lum" },
];

export function HSLMixer() {
  const { look, update, commit } = useLook();
  return (
    <div className="hsl">
      {HSL_BANDS.map((name, i) => (
        <div className="hsl-band" key={name}>
          <div className="hsl-name" style={{ color: BAND_COLORS[i] }}>
            {name}
          </div>
          <div className="hsl-sliders">
            {SUB.map((sub) => (
              <input
                key={sub.key}
                type="range"
                min={-100}
                max={100}
                title={sub.label}
                value={Math.round(look.hsl[i][sub.key] * 100)}
                onChange={(e) =>
                  update((l) => (l.hsl[i][sub.key] = parseFloat(e.target.value) / 100))
                }
                onPointerUp={commit}
                onDoubleClick={() => {
                  update((l) => (l.hsl[i][sub.key] = 0));
                  commit();
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

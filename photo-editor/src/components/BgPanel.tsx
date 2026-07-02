// Background panel (M4): appears once an AI matte exists. Choose how to composite
// the cut-out — keep, transparent, or replace with a solid color — and clear the matte.

import { BgMode } from "../editor/recipe";
import { useEditorStore } from "../store/editorStore";

const MODES: { mode: BgMode; label: string }[] = [
  { mode: "none", label: "Keep" },
  { mode: "transparent", label: "Transparent" },
  { mode: "color", label: "Color" },
];

const toHex = (c: [number, number, number]) =>
  "#" + c.map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
const fromHex = (h: string): [number, number, number] => [
  parseInt(h.slice(1, 3), 16) / 255,
  parseInt(h.slice(3, 5), 16) / 255,
  parseInt(h.slice(5, 7), 16) / 255,
];

export function BgPanel() {
  const mask = useEditorStore((s) => s.mask);
  const bg = useEditorStore((s) => s.recipe.bg);
  const setBg = useEditorStore((s) => s.setBg);
  const setMask = useEditorStore((s) => s.setMask);

  if (!mask) return null;

  return (
    <div className="bg-panel">
      <div className="panel-header">
        <span>Background</span>
        <button className="link" onClick={() => setMask(null)}>
          Clear matte
        </button>
      </div>
      <div className="bg-modes">
        {MODES.map((m) => (
          <button
            key={m.mode}
            className={bg.mode === m.mode ? "bg-mode active" : "bg-mode"}
            onClick={() => setBg({ ...bg, mode: m.mode })}
          >
            {m.label}
          </button>
        ))}
      </div>
      {bg.mode === "color" && (
        <div className="slider-row">
          <label>
            <span>Fill color</span>
          </label>
          <input
            type="color"
            value={toHex(bg.color)}
            onChange={(e) => setBg({ ...bg, color: fromHex(e.target.value) })}
          />
        </div>
      )}
    </div>
  );
}

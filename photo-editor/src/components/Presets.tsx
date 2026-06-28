// Presets: save the full current recipe (light + color grade + LUT) as a named
// preset, apply it to any image, and export/import presets as JSON for sharing.
// Stored in localStorage; works in both the desktop webview and the browser.

import { useEffect, useState } from "react";
import { cloneRecipe, Recipe, reviveRecipe } from "../editor/recipe";
import { openTextFile, saveTextFile } from "../lib/platform";
import { useEditorStore } from "../store/editorStore";

interface Preset {
  name: string;
  recipe: Recipe;
}

const KEY = "lumen.presets.v1";

function load(): Preset[] {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) ?? "[]") as Preset[];
    arr.forEach((p) => reviveRecipe(p.recipe));
    return arr;
  } catch {
    return [];
  }
}
function persist(p: Preset[]) {
  localStorage.setItem(KEY, JSON.stringify(p));
}

export function Presets() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const recipe = useEditorStore((s) => s.recipe);
  const applyRecipe = useEditorStore((s) => s.applyRecipe);

  useEffect(() => setPresets(load()), []);

  const save = () => {
    const name = prompt("Preset name?");
    if (!name) return;
    // A preset is a portable look — image layers (pixels) aren't part of it.
    const rec = cloneRecipe(recipe);
    rec.layerStack = [];
    const next = [...presets.filter((p) => p.name !== name), { name, recipe: rec }];
    setPresets(next);
    persist(next);
  };

  const remove = (name: string) => {
    const next = presets.filter((p) => p.name !== name);
    setPresets(next);
    persist(next);
  };

  const exportPreset = async (p: Preset) => {
    await saveTextFile(`${p.name}.lumen.json`, JSON.stringify(p, null, 2));
  };

  const importPreset = async () => {
    const file = await openTextFile(["json"]);
    if (!file) return;
    try {
      const p = JSON.parse(file.text) as Preset;
      if (!p.name || !p.recipe) throw new Error("not a Lumen preset");
      reviveRecipe(p.recipe);
      const next = [...presets.filter((x) => x.name !== p.name), p];
      setPresets(next);
      persist(next);
    } catch (e) {
      alert("Invalid preset file: " + (e as Error).message);
    }
  };

  return (
    <div className="presets">
      <div className="panel-header">
        <span>Presets</span>
        <div>
          <button className="link" onClick={save}>
            Save
          </button>
          <button className="link" onClick={importPreset}>
            Import
          </button>
        </div>
      </div>
      {presets.length === 0 && <p className="hint">No presets yet — Save the current look.</p>}
      {presets.map((p) => (
        <div className="preset-row" key={p.name}>
          <button className="preset-apply" onClick={() => applyRecipe(p.recipe, { keepLayers: true })} title="Apply">

            {p.name}
          </button>
          <button className="link" onClick={() => exportPreset(p)} title="Export .json">
            ⤓
          </button>
          <button className="link" onClick={() => remove(p.name)} title="Delete">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

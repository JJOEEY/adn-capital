import { useEffect } from "react";
import { Canvas } from "./components/Canvas";
import { AdjustPanel } from "./components/AdjustPanel";
import { ColorGradePanel } from "./components/ColorGradePanel";
import { MaskPanel } from "./components/MaskPanel";
import { HealPanel } from "./components/HealPanel";
import { LayersPanel } from "./components/LayersPanel";
import { BgPanel } from "./components/BgPanel";
import { ExportPanel } from "./components/ExportPanel";
import { Library } from "./components/Library";
import { LicensePanel } from "./components/LicensePanel";
import { Presets } from "./components/Presets";
import { Histogram } from "./components/Histogram";
import { Toolbar } from "./components/Toolbar";
import { useCatalogSync } from "./store/useCatalogSync";
import { useEditorStore } from "./store/editorStore";
import { useCatalogStore } from "./store/useCatalogStore";
import { Flag, getEntry, makeKey, saveEntry, setMeta } from "./lib/catalog";

// Rating/flag the current image via getState() so App doesn't subscribe to recipe.
function rateCurrent(n: number) {
  const { image, recipe } = useEditorStore.getState();
  if (!image) return;
  if (!getEntry(makeKey(image))) saveEntry(image, recipe);
  setMeta(makeKey(image), { rating: n });
  useCatalogStore.getState().bump();
}
function flagCurrent(f: Flag) {
  const { image, recipe } = useEditorStore.getState();
  if (!image) return;
  if (!getEntry(makeKey(image))) saveEntry(image, recipe);
  setMeta(makeKey(image), { flag: f });
  useCatalogStore.getState().bump();
}

export default function App() {
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);

  // Persist edits per image + restore them on reopen.
  useCatalogSync();

  // Global keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
        return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        useEditorStore.getState().copySettings();
        return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === "v") {
        e.preventDefault();
        useEditorStore.getState().pasteSettings();
        return;
      }
      if (mod || typing) return;
      // Culling shortcuts (no modifier).
      if (e.key >= "0" && e.key <= "5") rateCurrent(parseInt(e.key));
      else if (e.key === "p" || e.key === "P") flagCurrent("pick");
      else if (e.key === "x" || e.key === "X") flagCurrent("reject");
      else if (e.key === "u" || e.key === "U") flagCurrent("none");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  return (
    <div className="app">
      <Toolbar />
      <div className="body">
        <Canvas />
        <div className="sidebar">
          <Histogram />
          <AdjustPanel />
          <ColorGradePanel />
          <MaskPanel />
          <HealPanel />
          <LayersPanel />
          <BgPanel />
          <ExportPanel />
          <Presets />
          <Library />
          <LicensePanel />
        </div>
      </div>
    </div>
  );
}

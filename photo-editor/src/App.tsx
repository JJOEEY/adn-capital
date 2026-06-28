import { useEffect } from "react";
import { Canvas } from "./components/Canvas";
import { AdjustPanel } from "./components/AdjustPanel";
import { ColorGradePanel } from "./components/ColorGradePanel";
import { BgPanel } from "./components/BgPanel";
import { ExportPanel } from "./components/ExportPanel";
import { Library } from "./components/Library";
import { LicensePanel } from "./components/LicensePanel";
import { Presets } from "./components/Presets";
import { Histogram } from "./components/Histogram";
import { Toolbar } from "./components/Toolbar";
import { useCatalogSync } from "./store/useCatalogSync";
import { useEditorStore } from "./store/editorStore";

export default function App() {
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);

  // Persist edits per image + restore them on reopen.
  useCatalogSync();

  // Global keyboard shortcuts for undo/redo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
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

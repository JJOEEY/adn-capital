// .cube LUT controls: import an external 3D LUT (applied last in the pipeline), or
// export the *current color look* as a 3D LUT for sharing / reuse in other tools.

import { applyLook } from "../../editor/color/look";
import { generateCube, parseCube, serializeCube } from "../../editor/color/lut";
import { openTextFile, saveTextFile } from "../../lib/platform";
import { useEditorStore } from "../../store/editorStore";

const EXPORT_SIZE = 33; // standard .cube lattice size

export function LutControls() {
  const lut = useEditorStore((s) => s.recipe.lut);
  const look = useEditorStore((s) => s.recipe.look);
  const setLut = useEditorStore((s) => s.setLut);

  async function importLut() {
    const file = await openTextFile(["cube"]);
    if (!file) return;
    try {
      const parsed = parseCube(file.text);
      if (!parsed.title) parsed.title = file.name.replace(/\.cube$/i, "");
      setLut(parsed);
    } catch (e) {
      alert("Could not parse .cube LUT: " + (e as Error).message);
    }
  }

  async function exportLut() {
    // Bake the current creative look (curves + HSL + wheels + split) into a 3D LUT.
    const cube = generateCube(EXPORT_SIZE, (rgb) => applyLook(rgb, look));
    cube.title = "Lumen Look";
    await saveTextFile("lumen-look.cube", serializeCube(cube));
  }

  return (
    <div className="lut-controls">
      <button onClick={importLut}>Import .cube</button>
      <button onClick={exportLut}>Export look → .cube</button>
      {lut && (
        <div className="lut-active">
          <span title={lut.title}>LUT: {lut.title ?? "untitled"} ({lut.size}³)</span>
          <button className="link" onClick={() => setLut(null)}>
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

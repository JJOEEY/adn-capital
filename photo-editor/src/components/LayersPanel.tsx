// Layers panel (Pillar 2). Stack imported image layers over the edited photo, each
// with a blend mode + opacity. Top of the list = top of the stack.

import { BLEND_MODES } from "../editor/layers";
import { openImage } from "../lib/platform";
import { useEditorStore } from "../store/editorStore";

export function LayersPanel() {
  const image = useEditorStore((s) => s.image);
  const stack = useEditorStore((s) => s.recipe.layerStack);
  const addLayer = useEditorStore((s) => s.addLayer);
  const updateLayer = useEditorStore((s) => s.updateLayer);
  const removeLayer = useEditorStore((s) => s.removeLayer);
  const moveLayer = useEditorStore((s) => s.moveLayer);
  const commit = useEditorStore((s) => s.commit);

  if (!image) return null;

  async function add() {
    const img = await openImage();
    if (!img) return;
    addLayer({
      id: globalThis.crypto?.randomUUID?.() ?? `layer_${Date.now()}`,
      bitmap: img.bitmap,
      width: img.width,
      height: img.height,
      name: img.name,
    });
  }

  // Display top → bottom (last in the array renders on top).
  const ordered = [...stack].reverse();

  return (
    <div className="layers-panel">
      <div className="panel-header">
        <span>Layers</span>
        <button className="link" onClick={add}>
          + Image
        </button>
      </div>
      {stack.length === 0 && <p className="hint">Add an image layer to composite.</p>}
      {ordered.map((p, i) => {
        const idx = stack.length - 1 - i; // index in the real (bottom→top) array
        return (
          <div key={p.id} className="layer-row">
            <button
              className="mask-eye"
              title="Toggle"
              onClick={() => {
                updateLayer(p.id, (lp) => (lp.visible = !lp.visible));
                commit();
              }}
            >
              {p.visible ? "●" : "○"}
            </button>
            <div className="layer-main">
              <div className="layer-top">
                <span className="mask-name">{p.name}</span>
                <span className="layer-move">
                  <button onClick={() => moveLayer(p.id, 1)} disabled={idx === stack.length - 1} title="Up">
                    ▲
                  </button>
                  <button onClick={() => moveLayer(p.id, -1)} disabled={idx === 0} title="Down">
                    ▼
                  </button>
                  <button className="link" onClick={() => removeLayer(p.id)} title="Delete">
                    ✕
                  </button>
                </span>
              </div>
              <div className="layer-controls">
                <select
                  value={p.blend}
                  onChange={(e) => {
                    updateLayer(p.id, (lp) => (lp.blend = e.target.value as typeof lp.blend));
                    commit();
                  }}
                >
                  {BLEND_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(p.opacity * 100)}
                  title="Opacity"
                  onChange={(e) => updateLayer(p.id, (lp) => (lp.opacity = parseInt(e.target.value) / 100))}
                  onPointerUp={commit}
                  onKeyUp={commit}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

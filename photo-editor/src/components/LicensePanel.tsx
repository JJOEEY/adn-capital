// License panel (M6): enter a Lumen Pro key to unlock watermark-free export. The key
// is verified offline against the embedded public key.

import { useState } from "react";
import { useLicense } from "../store/useLicense";

export function LicensePanel() {
  const { license, isPro, key, setKey, clear } = useLicense();
  const [draft, setDraft] = useState("");

  return (
    <div className="license-panel">
      <div className="panel-header">
        <span>License</span>
        <span className={isPro ? "lic-badge pro" : "lic-badge"}>
          {isPro ? `Pro · ${license?.name ?? ""}` : license?.tier === "trial" ? "Trial" : "Free"}
        </span>
      </div>
      {key ? (
        <button className="link" onClick={clear}>
          Remove license key
        </button>
      ) : (
        <div className="lic-entry">
          <input
            type="text"
            placeholder="Paste license key"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button onClick={() => setKey(draft.trim())} disabled={!draft.trim()}>
            Activate
          </button>
        </div>
      )}
      {key && !license && <p className="hint">This key is not valid.</p>}
    </div>
  );
}

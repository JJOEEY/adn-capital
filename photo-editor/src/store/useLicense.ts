// Global license state (Zustand) so every consumer (LicensePanel, ExportPanel)
// shares one source of truth — activating a key in one place unlocks the others
// immediately. Keys are verified offline against the embedded public key.

import { create } from "zustand";
import { License, verifyLicense } from "../lib/license";

const KEY = "lumen.license.key";

interface LicenseState {
  key: string;
  license: License | null;
  isPro: boolean;
  entitled: boolean; // any verified, unexpired license removes the watermark
  setKey: (k: string) => Promise<void>;
  clear: () => void;
}

function derive(license: License | null) {
  return { license, isPro: license?.tier === "pro", entitled: !!license };
}

export const useLicense = create<LicenseState>((set) => ({
  key: localStorage.getItem(KEY) ?? "",
  license: null,
  isPro: false,
  entitled: false,
  setKey: async (k) => {
    localStorage.setItem(KEY, k);
    set({ key: k });
    set(derive(await verifyLicense(k)));
  },
  clear: () => {
    localStorage.removeItem(KEY);
    set({ key: "", ...derive(null) });
  },
}));

// Verify any persisted key once at startup.
const persisted = localStorage.getItem(KEY) ?? "";
if (persisted) {
  verifyLicense(persisted).then((lic) => useLicense.setState(derive(lic)));
}

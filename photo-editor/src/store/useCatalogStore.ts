// A tiny version counter so components re-read the (plain-module) catalog after any
// rating / flag / save change.

import { create } from "zustand";

interface CatalogVersion {
  version: number;
  bump: () => void;
}

export const useCatalogStore = create<CatalogVersion>((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}));

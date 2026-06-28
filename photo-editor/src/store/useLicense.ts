// License state: stores the entered key, verifies it (offline) against the embedded
// public key, and exposes whether Pro features are unlocked.

import { useEffect, useState } from "react";
import { License, verifyLicense } from "../lib/license";

const KEY = "lumen.license.key";

export function useLicense() {
  const [key, setKeyState] = useState(() => localStorage.getItem(KEY) ?? "");
  const [license, setLicense] = useState<License | null>(null);

  useEffect(() => {
    let live = true;
    verifyLicense(key).then((l) => live && setLicense(l));
    return () => {
      live = false;
    };
  }, [key]);

  return {
    license,
    isPro: license?.tier === "pro",
    key,
    setKey: (k: string) => {
      localStorage.setItem(KEY, k);
      setKeyState(k);
    },
    clear: () => {
      localStorage.removeItem(KEY);
      setKeyState("");
      setLicense(null);
    },
  };
}

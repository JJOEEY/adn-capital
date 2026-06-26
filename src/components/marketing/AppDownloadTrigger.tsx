"use client";

/** Nút "Tải app" cố định (footer...) — mở lại popup AppDownloadModal qua custom event. */

import { Download } from "lucide-react";

export function AppDownloadTrigger({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("adn:open-app-download"))}
      className={
        className ??
        "inline-flex items-center gap-2 rounded-full border border-[var(--primary)] px-4 py-2 text-[13px] font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary)] hover:text-white"
      }
    >
      <Download size={15} /> Tải app ADN
    </button>
  );
}

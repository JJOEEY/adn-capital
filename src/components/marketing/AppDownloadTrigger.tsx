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
        "mt-5 inline-flex items-center gap-2 rounded-full border border-[var(--moss)] px-4 py-2 text-[13.5px] font-medium text-[var(--moss)] transition-colors hover:bg-[var(--moss)] hover:text-white"
      }
    >
      <Download size={15} /> Tải app ADN
    </button>
  );
}

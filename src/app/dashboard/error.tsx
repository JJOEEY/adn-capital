"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Dashboard Error Boundary]", error?.message, error?.stack);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg-page)" }}>
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
          <span className="text-2xl">⚠️</span>
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Có lỗi xảy ra</h2>
        <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
          Dashboard không thể tải. Vui lòng thử lại.
        </p>
        {error?.message && (
          <p className="text-xs text-red-400/70 mb-4 font-mono break-all px-4">
            {error.message}
          </p>
        )}
        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-xl font-bold text-sm transition-colors cursor-pointer"
          style={{ background: "var(--primary)", color: "var(--on-primary)" }}
        >
          Thử lại
        </button>
      </div>
    </div>
  );
}

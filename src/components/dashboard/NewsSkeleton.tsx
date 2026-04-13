"use client";

import { Sun, Moon } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
 *  NewsSkeleton — Skeleton khớp 100% layout bản tin thật.
 *  Dùng cho Suspense fallback, chống CLS (Layout Shift).
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Skeleton cho MorningNews — khớp layout: header → 5 index cards → 3 content boxes */
export function MorningNewsSkeleton() {
  return (
    <div className="relative rounded-2xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      {/* Glow top-right removed per ADN Design System */}

      {/* Header */}
      <div className="relative z-10 border-b px-5 py-4 flex items-center gap-3" style={{ borderColor: "var(--border)" }}>
        <Sun className="w-5 h-5" style={{ color: "var(--primary)" }} />
        <div className="h-4 w-60 rounded animate-pulse" style={{ background: "var(--bg-hover)" }} />
      </div>

      <div className="relative z-10 p-5 space-y-5">
        {/* 5 Index cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="border rounded-xl p-3 space-y-2" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
              <div className="h-3 w-16 rounded animate-pulse" style={{ background: "var(--bg-hover)" }} />
              <div className="h-5 w-20 rounded animate-pulse" style={{ background: "var(--bg-hover)" }} />
              <div className="h-3 w-12 rounded animate-pulse" style={{ background: "var(--bg-hover)" }} />
            </div>
          ))}
        </div>

        {/* 3 Content boxes */}
        {[...Array(3)].map((_, i) => (
          <div key={i} className="border rounded-xl p-4 space-y-3" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded animate-pulse" style={{ background: "var(--bg-hover)" }} />
              <div className="h-4 w-48 rounded animate-pulse" style={{ background: "var(--bg-hover)" }} />
            </div>
            <div className="space-y-2 pl-1">
              <div className="h-3 w-full rounded animate-pulse" style={{ background: "var(--bg-hover)" }} />
              <div className="h-3 w-5/6 rounded animate-pulse" style={{ background: "var(--bg-hover)" }} />
              <div className="h-3 w-4/6 rounded animate-pulse" style={{ background: "var(--bg-hover)" }} />
              <div className="h-3 w-5/6 rounded animate-pulse" style={{ background: "var(--bg-hover)" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton cho EveningNews — khớp layout: header → flashnote bullets → data grid rows */
export function EveningNewsSkeleton() {
  return (
    <div className="relative rounded-2xl border overflow-hidden" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      {/* Glow top-right removed per ADN Design System */}

      {/* Header */}
      <div className="relative z-10 border-b px-5 py-4 flex items-center gap-3" style={{ borderColor: "var(--border)" }}>
        <Moon className="w-5 h-5" style={{ color: "var(--primary)" }} />
        <div className="h-4 w-64 rounded animate-pulse" style={{ background: "var(--bg-hover)" }} />
      </div>

      <div className="relative z-10 p-5 space-y-5">
        {/* Flashnote — 3 bullet blocks */}
        <div className="border rounded-xl p-4 space-y-3" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
          <div className="h-4 w-44 rounded animate-pulse" style={{ background: "var(--bg-hover)" }} />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-1.5 pl-3 border-l-2" style={{ borderColor: "var(--border)" }}>
              <div className="h-3 w-full rounded animate-pulse" style={{ background: "var(--bg-hover)" }} />
              <div className="h-3 w-4/5 rounded animate-pulse" style={{ background: "var(--bg-hover)" }} />
            </div>
          ))}
        </div>

        {/* Data grid rows (7 rows) */}
        <div className="border rounded-xl overflow-hidden divide-y divide-[var(--border)]">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="grid grid-cols-12 gap-0">
              <div className="col-span-3 p-3" style={{ background: "var(--surface-2)" }}>
                <div className="h-3 w-20 rounded animate-pulse" style={{ background: "var(--bg-hover)" }} />
              </div>
              <div className="col-span-9 p-3 space-y-1.5">
                <div className="h-3 w-full rounded animate-pulse" style={{ background: "var(--bg-hover)" }} />
                <div className="h-3 w-3/4 rounded animate-pulse" style={{ background: "var(--bg-hover)" }} />
              </div>
            </div>
          ))}
        </div>

        {/* Outlook block */}
        <div className="border rounded-xl p-4" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
          <div className="h-4 w-40 rounded animate-pulse mb-2" style={{ background: "var(--bg-hover)" }} />
          <div className="h-3 w-full rounded animate-pulse" style={{ background: "var(--bg-hover)" }} />
          <div className="h-3 w-2/3 rounded animate-pulse mt-1.5" style={{ background: "var(--bg-hover)" }} />
        </div>
      </div>
    </div>
  );
}

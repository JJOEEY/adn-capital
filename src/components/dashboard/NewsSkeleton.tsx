"use client";

import { Sun, Moon } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
 *  NewsSkeleton — Skeleton khớp 100% layout bản tin thật.
 *  Dùng cho Suspense fallback, chống CLS (Layout Shift).
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Skeleton cho MorningNews — khớp layout: header → 5 index cards → 3 content boxes */
export function MorningNewsSkeleton() {
  return (
    <div className="relative rounded-2xl border border-amber-500/10 bg-gray-900/90 overflow-hidden">
      {/* Glow top-right */}
      <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-amber-500/5 blur-3xl" />

      {/* Header */}
      <div className="relative z-10 border-b border-gray-800/60 px-5 py-4 flex items-center gap-3">
        <Sun className="w-5 h-5 text-amber-500/30" />
        <div className="h-4 w-60 bg-gray-800 rounded animate-pulse" />
      </div>

      <div className="relative z-10 p-5 space-y-5">
        {/* 5 Index cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-gray-800/50 border border-gray-700/30 rounded-xl p-3 space-y-2">
              <div className="h-3 w-16 bg-gray-700/60 rounded animate-pulse" />
              <div className="h-5 w-20 bg-gray-700/60 rounded animate-pulse" />
              <div className="h-3 w-12 bg-gray-700/60 rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* 3 Content boxes */}
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-gray-800/40 border border-gray-700/30 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-gray-700/50 rounded animate-pulse" />
              <div className="h-4 w-48 bg-gray-700/50 rounded animate-pulse" />
            </div>
            <div className="space-y-2 pl-1">
              <div className="h-3 w-full bg-gray-700/40 rounded animate-pulse" />
              <div className="h-3 w-5/6 bg-gray-700/40 rounded animate-pulse" />
              <div className="h-3 w-4/6 bg-gray-700/40 rounded animate-pulse" />
              <div className="h-3 w-5/6 bg-gray-700/40 rounded animate-pulse" />
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
    <div className="relative rounded-2xl border border-indigo-500/10 bg-gray-900/90 overflow-hidden">
      {/* Glow top-right */}
      <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-indigo-500/5 blur-3xl" />

      {/* Header */}
      <div className="relative z-10 border-b border-gray-800/60 px-5 py-4 flex items-center gap-3">
        <Moon className="w-5 h-5 text-indigo-500/30" />
        <div className="h-4 w-64 bg-gray-800 rounded animate-pulse" />
      </div>

      <div className="relative z-10 p-5 space-y-5">
        {/* Flashnote — 3 bullet blocks */}
        <div className="bg-gray-800/40 border border-gray-700/30 rounded-xl p-4 space-y-3">
          <div className="h-4 w-44 bg-gray-700/50 rounded animate-pulse" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-1.5 pl-3 border-l-2 border-gray-700/40">
              <div className="h-3 w-full bg-gray-700/40 rounded animate-pulse" />
              <div className="h-3 w-4/5 bg-gray-700/40 rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Data grid rows (7 rows) */}
        <div className="border border-gray-700/30 rounded-xl overflow-hidden divide-y divide-gray-700/30">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="grid grid-cols-12 gap-0">
              <div className="col-span-3 p-3 bg-gray-800/30">
                <div className="h-3 w-20 bg-gray-700/50 rounded animate-pulse" />
              </div>
              <div className="col-span-9 p-3 space-y-1.5">
                <div className="h-3 w-full bg-gray-700/40 rounded animate-pulse" />
                <div className="h-3 w-3/4 bg-gray-700/40 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>

        {/* Outlook block */}
        <div className="bg-gray-800/40 border border-gray-700/30 rounded-xl p-4">
          <div className="h-4 w-40 bg-gray-700/50 rounded animate-pulse mb-2" />
          <div className="h-3 w-full bg-gray-700/40 rounded animate-pulse" />
          <div className="h-3 w-2/3 bg-gray-700/40 rounded animate-pulse mt-1.5" />
        </div>
      </div>
    </div>
  );
}

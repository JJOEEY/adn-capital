"use client";

import { ShieldCheck, ShieldAlert } from "lucide-react";

interface StrengthCardProps {
  phase: "no_trade" | "probe" | "full_margin";
  verdict: string;
  action: string;
}

export function StrengthCard({ phase, verdict, action }: StrengthCardProps) {
  const isPass = phase !== "no_trade";

  const borderColor = isPass ? "border-[rgba(16,185,129,0.4)]" : "border-[rgba(239,68,68,0.4)]";
  const shadowColor = isPass
    ? "shadow-[0_0_15px_rgba(16,185,129,0.3),0_0_30px_rgba(16,185,129,0.15)]"
    : "shadow-[0_0_15px_rgba(239,68,68,0.3),0_0_30px_rgba(239,68,68,0.15)]";
  const verdictColor = isPass ? "#16a34a" : "var(--danger)";
  const verdictBg = isPass ? "rgba(22,163,74,0.10)" : "rgba(192,57,43,0.10)";
  const Icon = isPass ? ShieldCheck : ShieldAlert;

  return (
    <div className={`rounded-2xl border-2 ${borderColor} ${shadowColor} bg-[var(--surface)] p-4 sm:p-5 h-full flex flex-col`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-xl" style={{ background: verdictBg }}>
          <Icon className="w-5 h-5" style={{ color: verdictColor }} />
        </div>
        <p className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Đánh giá VN-Index
        </p>
      </div>

      {/* Big verdict */}
      <div className="text-center py-6 rounded-xl mb-4 flex-1 flex flex-col items-center justify-center" style={{ background: verdictBg }}>
        <p className="text-[12px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
          Trạng thái
        </p>
        <p className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: verdictColor }}>
          {isPass ? "ĐẠT ✓" : "KHÔNG ĐẠT ✗"}
        </p>
        <p className="text-sm font-bold mt-2" style={{ color: verdictColor }}>
          {verdict}
        </p>
      </div>

      {/* Action */}
      <p className="text-xs leading-relaxed text-center italic" style={{ color: "var(--text-muted)" }}>
        &ldquo;{action}&rdquo;
      </p>
    </div>
  );
}

export function StrengthCardSkeleton() {
  return (
    <div className="rounded-2xl border-2 border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 h-full">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-xl animate-pulse" style={{ background: "var(--surface-2)" }} />
        <div className="h-3 w-28 rounded animate-pulse" style={{ background: "var(--surface-2)" }} />
      </div>
      <div className="h-32 rounded-xl animate-pulse mb-4" style={{ background: "var(--surface-2)" }} />
      <div className="h-4 w-48 mx-auto rounded animate-pulse" style={{ background: "var(--surface-2)" }} />
    </div>
  );
}

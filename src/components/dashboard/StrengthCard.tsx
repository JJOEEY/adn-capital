"use client";

import { ShieldCheck, ShieldAlert } from "lucide-react";

interface StrengthCardProps {
  phase: "no_trade" | "probe" | "full_margin";
  verdict: string;
  action: string;
}

export function StrengthCard({ phase, verdict, action }: StrengthCardProps) {
  const isPass = phase !== "no_trade";

  const borderColor = isPass ? "border-emerald-400" : "border-red-500";
  const shadowColor = isPass
    ? "shadow-[0_0_15px_rgba(16,185,129,0.3),0_0_30px_rgba(16,185,129,0.15)]"
    : "shadow-[0_0_15px_rgba(239,68,68,0.3),0_0_30px_rgba(239,68,68,0.15)]";
  const verdictColor = isPass ? "text-emerald-400" : "text-red-400";
  const verdictBg = isPass ? "bg-emerald-500/10" : "bg-red-500/10";
  const Icon = isPass ? ShieldCheck : ShieldAlert;

  return (
    <div className={`rounded-2xl border-2 ${borderColor} ${shadowColor} bg-neutral-900 p-4 sm:p-5 h-full flex flex-col`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className={`p-2 rounded-xl ${verdictBg}`}>
          <Icon className={`w-5 h-5 ${verdictColor}`} />
        </div>
        <p className="text-[12px] font-bold text-neutral-500 uppercase tracking-wider">
          Đánh giá VN-Index
        </p>
      </div>

      {/* Big verdict */}
      <div className={`text-center py-6 rounded-xl ${verdictBg} mb-4 flex-1 flex flex-col items-center justify-center`}>
        <p className="text-[12px] font-bold text-neutral-400 uppercase tracking-widest mb-1">
          Trạng thái
        </p>
        <p className={`text-2xl sm:text-3xl font-black tracking-tight ${verdictColor}`}>
          {isPass ? "ĐẠT ✓" : "KHÔNG ĐẠT ✗"}
        </p>
        <p className={`text-sm font-bold mt-2 ${verdictColor}`}>
          {verdict}
        </p>
      </div>

      {/* Action */}
      <p className="text-xs text-neutral-400 leading-relaxed text-center italic">
        "{action}"
      </p>
    </div>
  );
}

export function StrengthCardSkeleton() {
  return (
    <div className="rounded-2xl border-2 border-neutral-700 bg-neutral-900 p-4 sm:p-5 h-full">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-xl bg-neutral-800 animate-pulse" />
        <div className="h-3 w-28 bg-neutral-800 rounded animate-pulse" />
      </div>
      <div className="h-32 rounded-xl bg-neutral-800 animate-pulse mb-4" />
      <div className="h-4 w-48 mx-auto bg-neutral-800 rounded animate-pulse" />
    </div>
  );
}

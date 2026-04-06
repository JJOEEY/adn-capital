"use client";

import { Zap, Clock, Target, ShieldAlert, TrendingUp, Crown, Shield, Bot } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatPrice } from "@/lib/utils";
import type { Signal } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

type TierType = "LEADER" | "TRUNG_HAN" | "NGAN_HAN";

interface SignalCardProps {
  signal: Signal;
  index: number;
}

const TIER_CONFIG: Record<TierType, {
  icon: string;
  label: string;
  gradient: string;
  badge: "purple" | "emerald" | "yellow";
  iconColor: string;
  borderColor: string;
  glowClass: string;
  navBarColor: string;
}> = {
  LEADER: {
    icon: "👑",
    label: "LEADER",
    gradient: "from-purple-500/10 via-purple-500/5 to-transparent",
    badge: "purple",
    iconColor: "text-purple-400",
    borderColor: "border-purple-500/30 hover:border-purple-500/50",
    glowClass: "shadow-purple-500/10 hover:shadow-purple-500/20",
    navBarColor: "bg-purple-500",
  },
  TRUNG_HAN: {
    icon: "🛡️",
    label: "TRUNG HẠN",
    gradient: "from-blue-500/10 via-blue-500/5 to-transparent",
    badge: "emerald",
    iconColor: "text-blue-400",
    borderColor: "border-blue-500/30 hover:border-blue-500/50",
    glowClass: "shadow-blue-500/10 hover:shadow-blue-500/20",
    navBarColor: "bg-blue-500",
  },
  NGAN_HAN: {
    icon: "⚡",
    label: "NGẮN HẠN",
    gradient: "from-amber-500/10 via-amber-500/5 to-transparent",
    badge: "yellow",
    iconColor: "text-amber-400",
    borderColor: "border-amber-500/30 hover:border-amber-500/50",
    glowClass: "shadow-amber-500/10 hover:shadow-amber-500/20",
    navBarColor: "bg-amber-500",
  },
};

export function SignalCard({ signal, index }: SignalCardProps) {
  const tier = (signal.tier ?? "NGAN_HAN") as TierType;
  const cfg = TIER_CONFIG[tier] ?? TIER_CONFIG.NGAN_HAN;

  const thoiGian = formatDistanceToNow(new Date(signal.createdAt), {
    addSuffix: true,
    locale: vi,
  });

  const rr = signal.target && signal.stoploss && signal.entryPrice
    ? ((signal.target - signal.entryPrice) / (signal.entryPrice - signal.stoploss)).toFixed(1)
    : null;

  return (
    <Card
      className={`p-0 overflow-hidden bg-gradient-to-br ${cfg.gradient} ${cfg.borderColor} shadow-lg ${cfg.glowClass} transition-all duration-300 backdrop-blur-sm`}
    >
      {/* ── Header: Tier badge + ticker + time ── */}
      <div className="p-4 pb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{cfg.icon}</span>
            <span className="text-lg font-black text-white font-mono tracking-wide">
              {signal.ticker}
            </span>
          </div>
          <div className="flex items-center gap-1 text-neutral-500">
            <Clock className="w-3 h-3" />
            <span className="text-[10px]">{thoiGian}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <Badge variant={cfg.badge} className={tier === "LEADER" ? "animate-pulse" : ""}>
            {cfg.label}
          </Badge>
          {signal.status === "ACTIVE" && (
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/25 px-1.5 py-0.5 rounded">
              ĐANG GIỮ
            </span>
          )}
          {signal.status === "CLOSED" && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
              (signal.pnl ?? 0) >= 0
                ? "text-emerald-400 bg-emerald-500/15 border-emerald-500/25"
                : "text-red-400 bg-red-500/15 border-red-500/25"
            }`}>
              {(signal.pnl ?? 0) >= 0 ? "+" : ""}{signal.pnl?.toFixed(1)}%
            </span>
          )}
        </div>

        {/* ── NAV Allocation progress bar ── */}
        {signal.navAllocation > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider">NAV Phân bổ</span>
              <span className="text-xs font-bold text-white">{signal.navAllocation}%</span>
            </div>
            <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${cfg.navBarColor} transition-all duration-500`}
                style={{ width: `${Math.min(signal.navAllocation, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* ── Trade info grid: Entry / Target / Stoploss ── */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="rounded-lg bg-neutral-900/60 border border-neutral-800 p-2 text-center">
            <p className="text-[9px] text-neutral-500 uppercase mb-0.5">Entry</p>
            <p className="text-sm font-bold text-white font-mono">{formatPrice(signal.entryPrice)}</p>
          </div>
          <div className="rounded-lg bg-neutral-900/60 border border-emerald-900/30 p-2 text-center">
            <p className="text-[9px] text-emerald-500 uppercase mb-0.5">Target</p>
            <p className="text-sm font-bold text-emerald-400 font-mono">
              {signal.target ? formatPrice(signal.target) : "—"}
            </p>
          </div>
          <div className="rounded-lg bg-neutral-900/60 border border-red-900/30 p-2 text-center">
            <p className="text-[9px] text-red-500 uppercase mb-0.5">Stoploss</p>
            <p className="text-sm font-bold text-red-400 font-mono">
              {signal.stoploss ? formatPrice(signal.stoploss) : "—"}
            </p>
          </div>
        </div>

        {/* ── R/R + Seasonality ── */}
        <div className="flex items-center gap-3 text-[10px] text-neutral-500 mb-2">
          {rr && (
            <span className="flex items-center gap-1">
              <Target className="w-3 h-3 text-blue-400" />
              <span className="text-blue-400 font-bold">R/R 1:{rr}</span>
            </span>
          )}
          {signal.winRate != null && signal.winRate > 0 && (
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-cyan-400" />
              <span className="text-cyan-400">WR {signal.winRate}%</span>
            </span>
          )}
          {signal.sharpeRatio != null && signal.sharpeRatio !== 0 && (
            <span className="text-violet-400">Sharpe {signal.sharpeRatio}</span>
          )}
        </div>

        {/* ── Trigger reason ── */}
        {signal.triggerSignal && (
          <p className="text-xs text-neutral-400 line-clamp-2 mb-1">
            <Zap className="w-3 h-3 inline mr-1 text-yellow-500" />
            {signal.triggerSignal}
          </p>
        )}
      </div>

      {/* ── AI Broker Insight box ── */}
      {signal.aiReasoning && (
        <div className="border-t border-neutral-800 bg-neutral-900/40 px-4 py-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Bot className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">AI Broker</span>
          </div>
          <p className="text-[11px] text-neutral-400 line-clamp-3 whitespace-pre-line leading-relaxed">
            {signal.aiReasoning.replace(/\*\*/g, "").replace(/📊|🎯|📐|💡|📅|⚠️/g, "").trim().split("\n").filter(l => l.trim()).slice(0, 3).join("\n")}
          </p>
        </div>
      )}
    </Card>
  );
}

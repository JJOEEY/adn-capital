"use client";

import { Zap, Clock, Target, TrendingUp, Bot, BarChart3 } from "lucide-react";
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
  borderColor: string;
  glowClass: string;
  navBarColor: string;
  navBarBg: string;
}> = {
  LEADER: {
    icon: "👑",
    label: "LEADER",
    gradient: "from-purple-500/10 via-purple-500/5 to-transparent",
    badge: "purple",
    borderColor: "border-purple-500/30 hover:border-purple-500/50",
    glowClass: "shadow-purple-500/10 hover:shadow-purple-500/20",
    navBarColor: "bg-purple-500",
    navBarBg: "bg-purple-950/40",
  },
  TRUNG_HAN: {
    icon: "🛡️",
    label: "TRUNG HẠN",
    gradient: "from-blue-500/10 via-blue-500/5 to-transparent",
    badge: "emerald",
    borderColor: "border-blue-500/30 hover:border-blue-500/50",
    glowClass: "shadow-blue-500/10 hover:shadow-blue-500/20",
    navBarColor: "bg-emerald-500",
    navBarBg: "bg-slate-700/50",
  },
  NGAN_HAN: {
    icon: "⚡",
    label: "NGẮN HẠN",
    gradient: "from-amber-500/10 via-amber-500/5 to-transparent",
    badge: "yellow",
    borderColor: "border-amber-500/30 hover:border-amber-500/50",
    glowClass: "shadow-amber-500/10 hover:shadow-amber-500/20",
    navBarColor: "bg-amber-500",
    navBarBg: "bg-slate-700/50",
  },
};

export function SignalCard({ signal, index }: SignalCardProps) {
  const tier = (signal.tier ?? "NGAN_HAN") as TierType;
  const cfg = TIER_CONFIG[tier] ?? TIER_CONFIG.NGAN_HAN;

  // ── Dữ liệu thật từ UltimateSignalEngine (không mock) ──
  const nav = signal.navAllocation ?? 0;
  const targetPrice = signal.target ?? null;
  const stoplossPrice = signal.stoploss ?? null;
  const rr =
    targetPrice != null && stoplossPrice != null && signal.entryPrice - stoplossPrice > 0
      ? ((targetPrice - signal.entryPrice) / (signal.entryPrice - stoplossPrice)).toFixed(1)
      : null;
  const trigger = signal.triggerSignal || null;
  const aiNote = signal.aiReasoning || null;
  const winRate = signal.winRate ?? 0;
  const sharpe = signal.sharpeRatio ?? 0;

  const thoiGian = formatDistanceToNow(new Date(signal.createdAt), {
    addSuffix: true,
    locale: vi,
  });

  return (
    <Card
      className={`p-0 overflow-hidden bg-gradient-to-br ${cfg.gradient} ${cfg.borderColor} shadow-lg ${cfg.glowClass} transition-all duration-300 backdrop-blur-sm`}
    >
      <div className="p-4 pb-0">
        {/* ═══ HEADER: Tier icon + Ticker + Time ═══ */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-lg leading-none">{cfg.icon}</span>
            <span className="text-xl font-black text-white font-mono tracking-wide">
              {signal.ticker}
            </span>
          </div>
          <div className="flex items-center gap-1 text-neutral-500">
            <Clock className="w-3 h-3" />
            <span className="text-[12px]">{thoiGian}</span>
          </div>
        </div>

        {/* Badges: Tier + Status */}
        <div className="flex items-center gap-2 mb-3">
          <Badge variant={cfg.badge} className={tier === "LEADER" ? "animate-pulse" : ""}>
            {cfg.label}
          </Badge>
          {signal.status === "ACTIVE" && (
            <>
              <span className="text-[12px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/25 px-1.5 py-0.5 rounded">
                ĐANG GIỮ
              </span>
              {signal.currentPnl != null && (
                <span className={`text-[12px] font-bold px-1.5 py-0.5 rounded border ${
                  signal.currentPnl >= 0
                    ? "text-emerald-400 bg-emerald-500/15 border-emerald-500/25"
                    : "text-red-400 bg-red-500/15 border-red-500/25"
                }`}>
                  {signal.currentPnl >= 0 ? "+" : ""}{signal.currentPnl.toFixed(1)}%
                </span>
              )}
            </>
          )}
          {signal.status === "CLOSED" && (
            <span className={`text-[12px] font-bold px-1.5 py-0.5 rounded border ${
              (signal.pnl ?? 0) >= 0
                ? "text-emerald-400 bg-emerald-500/15 border-emerald-500/25"
                : "text-red-400 bg-red-500/15 border-red-500/25"
            }`}>
              {(signal.pnl ?? 0) >= 0 ? "+" : ""}{signal.pnl?.toFixed(1)}%
            </span>
          )}
        </div>

        {/* ═══ 1. THANH TỶ TRỌNG VỐN (NAV Progress Bar) ═══ */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[12px] text-neutral-400 uppercase tracking-wider font-medium">
              Tỷ trọng đề xuất
            </span>
            <span className="text-xs font-bold text-white">{nav}% NAV</span>
          </div>
          <div className={`w-full h-2 rounded-full ${cfg.navBarBg} overflow-hidden`}>
            <div
              className={`h-full rounded-full ${cfg.navBarColor} transition-all duration-700 ease-out`}
              style={{ width: `${Math.min(nav, 100)}%` }}
            />
          </div>
        </div>

        {/* ═══ 2. GRID THÔNG SỐ LỆNH: Entry / Target / Stoploss + R/R ═══ */}
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          <div className="rounded-lg bg-slate-900/60 border border-slate-700/50 p-2 text-center">
            <p className="text-[11px] text-slate-400 uppercase mb-0.5 font-medium">Entry</p>
            <p className="text-sm font-bold text-white font-mono">{formatPrice(signal.entryPrice)}</p>
          </div>
          <div className="rounded-lg bg-slate-900/60 border border-emerald-800/40 p-2 text-center">
            <p className="text-[11px] text-emerald-400 uppercase mb-0.5 font-medium">Target</p>
            <p className="text-sm font-bold text-emerald-400 font-mono">
              {targetPrice != null ? formatPrice(targetPrice) : "—"}
            </p>
          </div>
          <div className="rounded-lg bg-slate-900/60 border border-red-800/40 p-2 text-center">
            <p className="text-[11px] text-red-400 uppercase mb-0.5 font-medium">Stoploss</p>
            <p className="text-sm font-bold text-red-400 font-mono">
              {stoplossPrice != null ? formatPrice(stoplossPrice) : "—"}
            </p>
          </div>
        </div>

        {/* ── Giá hiện tại (ACTIVE) hoặc Giá đóng (CLOSED) ── */}
        {signal.status === "ACTIVE" && signal.currentPrice != null && (
          <div className={`flex items-center justify-between rounded-lg p-2 mb-3 border ${
            (signal.currentPnl ?? 0) >= 0
              ? "bg-emerald-950/30 border-emerald-800/40"
              : "bg-red-950/30 border-red-800/40"
          }`}>
            <span className="text-[11px] text-neutral-400 uppercase font-medium">Giá hiện tại</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white font-mono">{formatPrice(signal.currentPrice)}</span>
              <span className={`text-xs font-bold ${(signal.currentPnl ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {(signal.currentPnl ?? 0) >= 0 ? "+" : ""}{(signal.currentPnl ?? 0).toFixed(1)}%
              </span>
            </div>
          </div>
        )}
        {signal.status === "CLOSED" && signal.closePrice != null && (
          <div className={`flex items-center justify-between rounded-lg p-2 mb-3 border ${
            (signal.pnl ?? 0) >= 0
              ? "bg-emerald-950/30 border-emerald-800/40"
              : "bg-red-950/30 border-red-800/40"
          }`}>
            <span className="text-[11px] text-neutral-400 uppercase font-medium">Giá đóng</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white font-mono">{formatPrice(signal.closePrice)}</span>
              <span className={`text-xs font-bold ${(signal.pnl ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {(signal.pnl ?? 0) >= 0 ? "+" : ""}{(signal.pnl ?? 0).toFixed(1)}%
              </span>
            </div>
          </div>
        )}

        {/* ── Quant metrics: R/R + Seasonality ── */}
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[12px] mb-3">
          {rr != null && (
            <span className="flex items-center gap-1">
              <Target className="w-3 h-3 text-blue-400" />
              <span className="text-blue-400 font-bold">R/R 1:{rr}</span>
            </span>
          )}
          {winRate > 0 && (
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-cyan-400" />
              <span className="text-cyan-400 font-medium">WR {winRate}%</span>
            </span>
          )}
          {sharpe !== 0 && (
            <span className="flex items-center gap-1">
              <BarChart3 className="w-3 h-3 text-violet-400" />
              <span className="text-violet-400 font-medium">Sharpe {sharpe}</span>
            </span>
          )}
        </div>

        {/* ── Trigger (Dấu hiệu kích hoạt) ── */}
        {trigger && (
          <div className="flex items-start gap-1.5 mb-3">
            <Zap className="w-3.5 h-3.5 text-yellow-500 mt-0.5 flex-shrink-0" />
            <div>
              <span className="text-[11px] text-yellow-500/70 uppercase font-bold tracking-wider">Trigger</span>
              <p className="text-xs text-neutral-300 leading-snug line-clamp-2">{trigger}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Lý do đóng (CLOSED) ── */}
      {signal.status === "CLOSED" && signal.closedReason && (
        <div className="mx-3 mb-2 px-3 py-2 rounded-lg bg-neutral-900/60 border border-neutral-700/50">
          <p className="text-[12px] text-neutral-400 leading-snug">
            <span className="font-bold text-neutral-300">Lý do:</span> {signal.closedReason}
          </p>
        </div>
      )}

      {/* ═══ 3. AI BROKER INSIGHT BOX ═══ */}
      {aiNote && (
        <div className="bg-slate-900/50 rounded-xl mx-3 mb-3 p-3 border-l-2 border-emerald-500">
          <div className="flex items-start gap-2">
            <Bot className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">AI Broker Insight</span>
              <p className="text-sm text-gray-300 italic leading-relaxed mt-1 line-clamp-4">
                {aiNote.replace(/\*\*/g, "").replace(/📊|🎯|📐|💡|📅|⚠️/g, "").trim().split("\n").filter(l => l.trim()).slice(0, 3).join(" · ")}
              </p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

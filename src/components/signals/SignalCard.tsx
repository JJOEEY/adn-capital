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

/** Mock defaults cho tier nếu API chưa trả về */
const TIER_DEFAULTS: Record<TierType, { targetMul: number; stopMul: number; defaultNav: number }> = {
  LEADER:    { targetMul: 1.15, stopMul: 0.93, defaultNav: 30 },
  TRUNG_HAN: { targetMul: 1.10, stopMul: 0.95, defaultNav: 20 },
  NGAN_HAN:  { targetMul: 1.07, stopMul: 0.97, defaultNav: 10 },
};

const DEFAULT_AI_NOTE = "AI Note: Tín hiệu đạt chuẩn VSA Breakout. Mùa vụ tháng này Win Rate 80%. Tự tin giải ngân.";

export function SignalCard({ signal, index }: SignalCardProps) {
  const tier = (signal.tier ?? "NGAN_HAN") as TierType;
  const cfg = TIER_CONFIG[tier] ?? TIER_CONFIG.NGAN_HAN;
  const defaults = TIER_DEFAULTS[tier];

  // ── Derived values (mock fallback nếu API chưa có) ──
  const nav = signal.navAllocation > 0 ? signal.navAllocation : defaults.defaultNav;
  const targetPrice = signal.target ?? +(signal.entryPrice * defaults.targetMul).toFixed(2);
  const stoplossPrice = signal.stoploss ?? +(signal.entryPrice * defaults.stopMul).toFixed(2);
  const rr = ((targetPrice - signal.entryPrice) / (signal.entryPrice - stoplossPrice)).toFixed(1);
  const trigger = signal.triggerSignal || "Breakout Nền";
  const aiNote = signal.aiReasoning || DEFAULT_AI_NOTE;
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
            <span className="text-[10px]">{thoiGian}</span>
          </div>
        </div>

        {/* Badges: Tier + Status */}
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

        {/* ═══ 1. THANH TỶ TRỌNG VỐN (NAV Progress Bar) ═══ */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-medium">
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
            <p className="text-[9px] text-slate-400 uppercase mb-0.5 font-medium">Entry</p>
            <p className="text-sm font-bold text-white font-mono">{formatPrice(signal.entryPrice)}</p>
          </div>
          <div className="rounded-lg bg-slate-900/60 border border-emerald-800/40 p-2 text-center">
            <p className="text-[9px] text-emerald-400 uppercase mb-0.5 font-medium">Target</p>
            <p className="text-sm font-bold text-emerald-400 font-mono">{formatPrice(targetPrice)}</p>
          </div>
          <div className="rounded-lg bg-slate-900/60 border border-red-800/40 p-2 text-center">
            <p className="text-[9px] text-red-400 uppercase mb-0.5 font-medium">Stoploss</p>
            <p className="text-sm font-bold text-red-400 font-mono">{formatPrice(stoplossPrice)}</p>
          </div>
        </div>

        {/* ── Quant metrics: R/R + Seasonality + Trigger ── */}
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[10px] mb-3">
          <span className="flex items-center gap-1">
            <Target className="w-3 h-3 text-blue-400" />
            <span className="text-blue-400 font-bold">R/R 1:{rr}</span>
          </span>
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
        <div className="flex items-start gap-1.5 mb-3">
          <Zap className="w-3.5 h-3.5 text-yellow-500 mt-0.5 flex-shrink-0" />
          <div>
            <span className="text-[9px] text-yellow-500/70 uppercase font-bold tracking-wider">Trigger</span>
            <p className="text-xs text-neutral-300 leading-snug line-clamp-2">{trigger}</p>
          </div>
        </div>
      </div>

      {/* ═══ 3. AI BROKER INSIGHT BOX ═══ */}
      <div className="bg-slate-900/50 rounded-xl mx-3 mb-3 p-3 border-l-2 border-emerald-500">
        <div className="flex items-start gap-2">
          <Bot className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">AI Broker Insight</span>
            <p className="text-sm text-gray-300 italic leading-relaxed mt-1 line-clamp-4">
              {aiNote.replace(/\*\*/g, "").replace(/📊|🎯|📐|💡|📅|⚠️/g, "").trim().split("\n").filter(l => l.trim()).slice(0, 3).join(" · ")}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

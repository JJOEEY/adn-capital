"use client";

import Link from "next/link";
import { Zap, Clock, Target, TrendingUp, Bot, BarChart3 } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { Signal } from "@/types";

type TierType = "LEADER" | "TRUNG_HAN" | "NGAN_HAN" | "TAM_NGAM";

interface SignalCardProps {
  signal: Signal;
  index: number;
  buyHref?: string;
  showBuyAction?: boolean;
}

/* Design token colours per spec */
const TIER_CONFIG: Record<TierType, {
  icon: string;
  label: string;
  navBarColor: string;   /* hex / CSS colour for the NAV progress bar fill */
}> = {
  LEADER:   { icon: "👑", label: "LEADER",    navBarColor: "#2E4D3D" },
  TRUNG_HAN:{ icon: "🛡️", label: "TRUNG HẠN", navBarColor: "#f59e0b" },
  NGAN_HAN: { icon: "⚡", label: "NGẮN HẠN",  navBarColor: "#16a34a" },
  TAM_NGAM: { icon: "🎯", label: "TẦM NGẮM",  navBarColor: "#7D8471" },
};

export function SignalCard({ signal, buyHref, showBuyAction = false }: SignalCardProps) {
  const tier = (signal.tier ?? "NGAN_HAN") as TierType;
  const cfg = TIER_CONFIG[tier] ?? TIER_CONFIG.NGAN_HAN;

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

  const daysInSignal = signal.daysInSignal ?? 0;
  const createdDate = new Date(signal.createdAt);
  const dateStr = createdDate.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  const isExpired = signal.status === "RADAR" && daysInSignal >= 7;
  const isLiveSignal = signal.status === "ACTIVE" || signal.status === "HOLD_TO_DIE";
  const isStoplossBreached =
    isLiveSignal &&
    signal.currentPrice != null &&
    stoplossPrice != null &&
    signal.currentPrice <= stoplossPrice;

  /* PnL colour helper */
  const pnlColor = (val: number) => (val >= 0 ? "#16a34a" : "var(--danger)");
  const pnlBg   = (val: number) => (val >= 0 ? "rgba(22,163,74,0.08)" : "rgba(192,57,43,0.08)");
  const pnlBorder= (val: number) => (val >= 0 ? "rgba(22,163,74,0.20)" : "rgba(192,57,43,0.20)");

  return (
    <div
      className="glow-card rounded-[14px] border transition-all duration-300 cursor-pointer p-0 overflow-hidden"
      style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
    >
      <div className="p-4 pb-0">
        {/* ═══ HEADER ═══ */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-lg leading-none">{cfg.icon}</span>
            <span
              className="text-xl font-black font-mono tracking-wide"
              style={{ color: "var(--text-primary)" }}
            >
              {signal.ticker}
            </span>
          </div>
          <div className="flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
            <Clock className="w-3 h-3" />
            <span className="text-[12px]">
              Ngày {dateStr} — {daysInSignal} ngày
            </span>
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {/* Tier badge */}
          <span
            className="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
            style={{
              background: `${cfg.navBarColor}18`,
              color: cfg.navBarColor,
              border: `1px solid ${cfg.navBarColor}40`,
            }}
          >
            {cfg.label}
          </span>

          {isExpired && (
            <span
              className="text-[12px] font-bold px-1.5 py-0.5 rounded"
              style={{
                background: "var(--bg-hover)",
                color: "var(--text-muted)",
                border: "1px solid var(--border)",
              }}
            >
              Hết hiệu lực
            </span>
          )}

          {(signal.status === "ACTIVE" || signal.status === "HOLD_TO_DIE") && (
            <>
              <span
                className="text-[12px] font-bold px-1.5 py-0.5 rounded"
                style={{
                  background: signal.status === "HOLD_TO_DIE" ? "rgba(245,158,11,0.10)" : "rgba(22,163,74,0.10)",
                  color: signal.status === "HOLD_TO_DIE" ? "#f59e0b" : "#16a34a",
                  border: signal.status === "HOLD_TO_DIE" ? "1px solid rgba(245,158,11,0.25)" : "1px solid rgba(22,163,74,0.25)",
                }}
              >
                {signal.status === "HOLD_TO_DIE" ? "HOLD TO DIE" : "ĐANG GIỮ"}
              </span>
              {signal.currentPnl != null && (
                <span
                  className="text-[12px] font-bold px-1.5 py-0.5 rounded"
                  style={{
                    background: pnlBg(signal.currentPnl),
                    color: pnlColor(signal.currentPnl),
                    border: `1px solid ${pnlBorder(signal.currentPnl)}`,
                  }}
                >
                  {signal.currentPnl >= 0 ? "+" : ""}{signal.currentPnl.toFixed(1)}%
                </span>
              )}
              {isStoplossBreached && (
                <span
                  className="text-[12px] font-bold px-1.5 py-0.5 rounded"
                  style={{
                    background: "rgba(192,57,43,0.10)",
                    color: "var(--danger)",
                    border: "1px solid rgba(192,57,43,0.30)",
                  }}
                >
                  VI PHẠM SL
                </span>
              )}
            </>
          )}

          {signal.status === "CLOSED" && (
            <span
              className="text-[12px] font-bold px-1.5 py-0.5 rounded"
              style={{
                background: pnlBg(signal.pnl ?? 0),
                color: pnlColor(signal.pnl ?? 0),
                border: `1px solid ${pnlBorder(signal.pnl ?? 0)}`,
              }}
            >
              {(signal.pnl ?? 0) >= 0 ? "+" : ""}{signal.pnl?.toFixed(1)}%
            </span>
          )}
        </div>

        {/* NAV Progress bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span
              className="text-[12px] uppercase tracking-wider font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Tỷ trọng đề xuất
            </span>
            <span
              className="text-xs font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              {nav}% NAV
            </span>
          </div>
          <div
            className="w-full h-2 rounded-full overflow-hidden"
            style={{ background: "var(--bg-hover)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${Math.min(nav, 100)}%`, background: cfg.navBarColor }}
            />
          </div>
        </div>

        {/* Entry / Target / Stoploss */}
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          <div
            className="rounded-lg p-2 text-center"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
          >
            <p className="text-[11px] uppercase mb-0.5 font-medium" style={{ color: "var(--text-secondary)" }}>
              Entry
            </p>
            <p className="text-sm font-bold font-mono" style={{ color: "var(--text-primary)" }}>
              {formatPrice(signal.entryPrice)}
            </p>
          </div>
          <div
            className="rounded-lg p-2 text-center"
            style={{ background: "rgba(22,163,74,0.05)", border: "1px solid rgba(22,163,74,0.20)" }}
          >
            <p className="text-[11px] uppercase mb-0.5 font-medium" style={{ color: "#16a34a" }}>
              Target
            </p>
            <p className="text-sm font-bold font-mono" style={{ color: "#16a34a" }}>
              {targetPrice != null ? formatPrice(targetPrice) : "—"}
            </p>
          </div>
          <div
            className="rounded-lg p-2 text-center"
            style={{ background: "rgba(192,57,43,0.05)", border: "1px solid rgba(192,57,43,0.20)" }}
          >
            <p className="text-[11px] uppercase mb-0.5 font-medium" style={{ color: "var(--danger)" }}>
              Stoploss
            </p>
            <p className="text-sm font-bold font-mono" style={{ color: "var(--danger)" }}>
              {stoplossPrice != null ? formatPrice(stoplossPrice) : "—"}
            </p>
          </div>
        </div>

        {/* Current price (ACTIVE) */}
        {(signal.status === "ACTIVE" || signal.status === "HOLD_TO_DIE") && signal.currentPrice != null && (
          <div
            className="flex items-center justify-between rounded-lg p-2 mb-3"
            style={{
              background: pnlBg(signal.currentPnl ?? 0),
              border: `1px solid ${pnlBorder(signal.currentPnl ?? 0)}`,
            }}
          >
            <span className="text-[11px] uppercase font-medium" style={{ color: "var(--text-secondary)" }}>
              Giá hiện tại
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold font-mono" style={{ color: "var(--text-primary)" }}>
                {formatPrice(signal.currentPrice)}
              </span>
              <span className="text-xs font-bold" style={{ color: pnlColor(signal.currentPnl ?? 0) }}>
                {(signal.currentPnl ?? 0) >= 0 ? "+" : ""}{(signal.currentPnl ?? 0).toFixed(1)}%
              </span>
            </div>
          </div>
        )}
        {isStoplossBreached && (
          <div
            className="rounded-lg p-2 mb-3 text-[12px] font-medium"
            style={{
              background: "rgba(192,57,43,0.08)",
              border: "1px solid rgba(192,57,43,0.25)",
              color: "var(--danger)",
            }}
          >
            Giá hiện tại đã chạm hoặc thấp hơn stoploss. Hệ thống sẽ chuyển mã này sang trạng thái đã đóng khi dữ liệu được đồng bộ.
          </div>
        )}

        {/* Closed price */}
        {signal.status === "CLOSED" && signal.closePrice != null && (
          <div
            className="flex items-center justify-between rounded-lg p-2 mb-3"
            style={{
              background: pnlBg(signal.pnl ?? 0),
              border: `1px solid ${pnlBorder(signal.pnl ?? 0)}`,
            }}
          >
            <span className="text-[11px] uppercase font-medium" style={{ color: "var(--text-secondary)" }}>
              Giá đóng
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold font-mono" style={{ color: "var(--text-primary)" }}>
                {formatPrice(signal.closePrice)}
              </span>
              <span className="text-xs font-bold" style={{ color: pnlColor(signal.pnl ?? 0) }}>
                {(signal.pnl ?? 0) >= 0 ? "+" : ""}{(signal.pnl ?? 0).toFixed(1)}%
              </span>
            </div>
          </div>
        )}

        {/* R/R + WR + Sharpe */}
        <div
          className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[12px] mb-3"
          style={{ color: "var(--text-secondary)" }}
        >
          {rr != null && (
            <span className="flex items-center gap-1">
              <Target className="w-3 h-3" style={{ color: "var(--primary)" }} />
              <span className="font-bold" style={{ color: "var(--primary)" }}>R/R 1:{rr}</span>
            </span>
          )}
          {winRate > 0 && (
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3" style={{ color: "#16a34a" }} />
              <span className="font-medium" style={{ color: "#16a34a" }}>WR {winRate}%</span>
            </span>
          )}
          {sharpe !== 0 && (
            <span className="flex items-center gap-1">
              <BarChart3 className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
              <span className="font-medium">Sharpe {sharpe}</span>
            </span>
          )}
        </div>

        {/* Trigger */}
        {trigger && (
          <div className="flex items-start gap-1.5 mb-3">
            <Zap className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: "#f59e0b" }} />
            <div>
              <span
                className="text-[11px] font-bold uppercase tracking-wider"
                style={{ color: "rgba(245,158,11,0.70)" }}
              >
                Trigger
              </span>
              <p className="text-xs leading-snug line-clamp-2" style={{ color: "var(--text-secondary)" }}>
                {trigger}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Closed reason */}
      {signal.status === "CLOSED" && signal.closedReason && (
        <div
          className="mx-3 mb-2 px-3 py-2 rounded-lg"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <p className="text-[12px] leading-snug" style={{ color: "var(--text-secondary)" }}>
            <span className="font-bold" style={{ color: "var(--text-primary)" }}>Lý do:</span>{" "}
            {signal.closedReason}
          </p>
        </div>
      )}

      {/* NexPilot Insight */}
      {aiNote && (
        <div
          className="rounded-xl mx-3 mb-3 p-3"
          style={{
            background: "var(--bg-hover)",
            borderLeft: "2px solid var(--primary)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="flex items-start gap-2">
            <Bot className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "var(--primary)" }} />
            <div className="min-w-0">
              <span
                className="text-[11px] font-bold uppercase tracking-wider"
                style={{ color: "var(--primary)" }}
              >
                NexPilot Insight
              </span>
              <p className="text-sm italic leading-relaxed mt-1 line-clamp-4" style={{ color: "var(--text-secondary)" }}>
                {aiNote.replace(/\*\*/g, "").replace(/📊|🎯|📐|💡|📅|⚠️/g, "").trim().split("\n").filter(l => l.trim()).slice(0, 3).join(" · ")}
              </p>
            </div>
          </div>
        </div>
      )}

      {showBuyAction && buyHref ? (
        <div className="mx-3 mb-3">
          <Link href={buyHref}>
            <button
              className="w-full rounded-xl px-3 py-2 text-xs font-black transition-all hover:opacity-90"
              style={{ background: "var(--primary)", color: "var(--on-primary)" }}
            >
              Đặt lệnh mua
            </button>
          </Link>
        </div>
      ) : null}
    </div>
  );
}

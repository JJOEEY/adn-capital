"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Crosshair, Briefcase, CheckCircle, Crown, Lock, Bot, History, Clock, Target, TrendingUp, Zap } from "lucide-react";
import { SignalCard } from "@/components/signals/SignalCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Signal } from "@/types";
import Link from "next/link";
import { isWithinVnTradingSession } from "@/lib/time";
import { useTopic } from "@/hooks/useTopic";
import { customerLabel } from "@/lib/customer-labels";
import { PRODUCT_DESCRIPTIONS, PRODUCT_NAMES } from "@/lib/brand/productNames";
import { formatPrice } from "@/lib/utils";

type Tab = "RADAR" | "ACTIVE" | "CLOSED";
type TierFilter = "all" | "LEADER" | "TRUNG_HAN" | "NGAN_HAN" | "TAM_NGAM";
type ReportedSignalSummary = {
  tradingDate: string;
  total: number;
  tickers: string[];
  groups: Array<{
    signalType: string;
    label: string;
    total: number;
    rows: Array<{
      ticker: string;
      signalType: string;
      entryPrice: number | null;
      reportedAt: string | null;
    }>;
  }>;
};
type SignalMapTopicValue = {
  signals: Signal[];
  reportedToday?: ReportedSignalSummary;
  paperAccount?: PaperAccount;
};

type PaperPosition = {
  id: string;
  signalId?: string | null;
  ticker: string;
  exchange: string;
  signalType: string;
  tier: "LEADER" | "TRUNG_HAN" | "NGAN_HAN" | "DAU_CO" | "TAM_NGAM";
  status: "ACTIVE" | "HOLD_TO_DIE" | "PENDING_EXIT" | string;
  entryPrice: number;
  currentPrice?: number | null;
  quantity: number;
  costBasis: number;
  marketValue: number;
  navPct: number;
  currentPnl?: number | null;
  currentPnlValue?: number | null;
  target?: number | null;
  stoploss?: number | null;
  openedAt: string;
  sellableAt: string;
  pendingExitReason?: string | null;
  pendingExitTriggeredAt?: string | null;
  pendingExitPrice?: number | null;
  triggerSignal?: string | null;
  aiReasoning?: string | null;
  reason?: string | null;
  rrRatio?: string | null;
  winRate?: number | null;
  sharpeRatio?: number | null;
  locked?: boolean;
};

type PaperAccount = {
  initialNav: number;
  cash: number;
  invested: number;
  totalNav: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  totalPnlPct: number;
  positions: PaperPosition[];
  latestSnapshot?: { snapshotDate: string; slot: string; createdAt: string } | null;
  pendingExits: Array<{ ticker: string; reason: string | null; price: number | null; sellableAt: string }>;
};

const TABS: { value: Tab; label: string; icon: typeof Crosshair }[] = [
  { value: "RADAR",  label: "Tầm ngắm",     icon: Crosshair  },
  { value: "ACTIVE", label: "Đang nắm giữ", icon: Briefcase  },
  { value: "CLOSED", label: "Đã đóng",      icon: CheckCircle },
];

const TIER_FILTERS: { value: TierFilter; label: string }[] = [
  { value: "all",      label: "Tất cả"     },
  { value: "LEADER",   label: "👑 Siêu cổ phiếu"  },
  { value: "TRUNG_HAN",label: "🛡️ Trung hạn"},
  { value: "NGAN_HAN", label: "⚡ Ngắn hạn" },
  { value: "TAM_NGAM", label: "🎯 Tiếp cận" },
];

function FreshnessBadge({ freshness }: { freshness: string | null }) {
  if (!freshness) return null;
  const state = freshness.toLowerCase();
  const isFresh = state === "fresh";
  const isStale = state === "stale";
  const label = isFresh ? "Fresh" : isStale ? "Stale" : state.toUpperCase();
  const style = isFresh
    ? { color: "#16a34a", borderColor: "rgba(22,163,74,0.25)", background: "rgba(22,163,74,0.10)" }
    : isStale
      ? { color: "#f59e0b", borderColor: "rgba(245,158,11,0.25)", background: "rgba(245,158,11,0.10)" }
      : { color: "var(--danger)", borderColor: "rgba(192,57,43,0.25)", background: "rgba(192,57,43,0.10)" };
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={style}>
      {label}
    </span>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function PaperSummary({ account }: { account: PaperAccount }) {
  const pnlColor = account.totalPnlPct >= 0 ? "#16a34a" : "var(--danger)";
  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
      {[
        { label: "NAV", value: formatPrice(account.totalNav), color: "var(--text-primary)" },
        { label: "Tiền mặt", value: formatPrice(account.cash), color: "var(--text-primary)" },
        { label: "Đang đầu tư", value: formatPrice(account.invested), color: "var(--text-primary)" },
        { label: "PnL", value: `${account.totalPnlPct >= 0 ? "+" : ""}${account.totalPnlPct.toFixed(2)}%`, color: pnlColor },
      ].map((item) => (
        <div
          key={item.label}
          className="rounded-[14px] border p-3"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>{item.label}</p>
          <p className="text-lg font-semibold" style={{ color: item.color }}>{item.value}</p>
        </div>
      ))}
    </section>
  );
}

function formatTierLabel(tier: PaperPosition["tier"]) {
  return customerLabel(tier).toLocaleUpperCase("vi-VN");
}

function LegacyPaperPositionCard({ position }: { position: PaperPosition }) {
  const pnl = position.currentPnl ?? 0;
  const pnlColor = pnl >= 0 ? "#16a34a" : "var(--danger)";
  const statusLabel = customerLabel(position.status).toLocaleUpperCase("vi-VN");
  return (
    <div className="rounded-[14px] border p-4 space-y-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>{position.ticker}</span>
            <span className="rounded-full border px-2 py-0.5 text-[11px] font-bold" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>{position.exchange}</span>
          </div>
          <p className="text-[12px] mt-1" style={{ color: "var(--text-secondary)" }}>{formatTierLabel(position.tier)} · {statusLabel}</p>
        </div>
        <span className="text-sm font-semibold" style={{ color: pnlColor }}>{pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}%</span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[12px]">
        {[
          ["Giá vốn", formatPrice(position.entryPrice)],
          ["Giá hiện tại", position.currentPrice ? formatPrice(position.currentPrice) : "-"],
          ["Số lượng", position.quantity.toLocaleString("vi-VN")],
          ["Giá trị", formatPrice(position.marketValue)],
          ["NAV", `${position.navPct.toFixed(2)}%`],
          ["Ngày mua", formatDate(position.openedAt)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border p-2" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <p style={{ color: "var(--text-secondary)" }}>{label}</p>
            <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{value}</p>
          </div>
        ))}
      </div>

      {position.pendingExitReason && (
        <div className="rounded-lg border p-2 text-[12px]" style={{ borderColor: "rgba(245,158,11,0.35)", background: "rgba(245,158,11,0.08)", color: "#f59e0b" }}>
          Pending exit: {position.pendingExitReason}
          {position.pendingExitPrice ? ` · Giá kích hoạt ${formatPrice(position.pendingExitPrice)}` : ""}
        </div>
      )}
    </div>
  );
}

const PAPER_TIER_CONFIG: Record<string, { icon: string; label: string; navBarColor: string }> = {
  LEADER: { icon: "👑", label: "SIÊU CỔ PHIẾU", navBarColor: "#2E4D3D" },
  TRUNG_HAN: { icon: "🛡️", label: "TRUNG HẠN", navBarColor: "#f59e0b" },
  NGAN_HAN: { icon: "⚡", label: "NGẮN HẠN", navBarColor: "#16a34a" },
  DAU_CO: { icon: "⚡", label: "LƯỚT SÓNG", navBarColor: "#16a34a" },
  TAM_NGAM: { icon: "🎯", label: "TẦM NGẮM", navBarColor: "#7D8471" },
};

function daysSince(value: string) {
  const started = new Date(value).getTime();
  if (!Number.isFinite(started)) return 0;
  return Math.max(0, Math.floor((Date.now() - started) / 86_400_000));
}

function targetBoxForPosition(position: PaperPosition) {
  if (position.pendingExitPrice) {
    return {
      label: "GIÁ KÍCH HOẠT",
      value: formatPrice(position.pendingExitPrice),
      color: "#f59e0b",
      background: "rgba(245,158,11,0.05)",
      border: "rgba(245,158,11,0.20)",
    };
  }
  if ((position.tier === "NGAN_HAN" || position.tier === "DAU_CO") && position.target != null) {
    return {
      label: "TARGET",
      value: formatPrice(position.target),
      color: "#16a34a",
      background: "rgba(22,163,74,0.05)",
      border: "rgba(22,163,74,0.20)",
    };
  }
  return {
    label: "STOPLOSS",
    value: position.stoploss != null ? formatPrice(position.stoploss) : "—",
    color: "var(--danger)",
    background: "rgba(192,57,43,0.05)",
    border: "rgba(192,57,43,0.20)",
  };
}

function cleanInsightText(value?: string | null) {
  if (!value) return null;
  const cleaned = value
    .replace(/\*\*/g, "")
    .replace(/📊|🎯|📐|💡|📅|⚠️|🤖|🔥/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join("\n");
  return cleaned || null;
}

function strategyLabelForTier(tier: PaperPosition["tier"]) {
  if (tier === "LEADER") return "Siêu cổ phiếu";
  if (tier === "TRUNG_HAN") return "Tăng trưởng";
  if (tier === "DAU_CO") return "Lướt sóng";
  return "Ngắn hạn";
}

function PaperPositionInsight({ position }: { position: PaperPosition }) {
  const cfg = PAPER_TIER_CONFIG[position.tier] ?? PAPER_TIER_CONFIG.NGAN_HAN;
  const aiNote = cleanInsightText(position.aiReasoning);
  const trigger = cleanInsightText(position.triggerSignal ?? position.reason);
  if (!aiNote && !trigger) return null;

  const rr = position.rrRatio ?? null;
  const nav = `${position.navPct.toFixed(1)}%`;

  return (
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
        <div className="min-w-0 space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--primary)" }}>
            ADN Radar Insight
          </span>
          <div className="text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
              {position.ticker} - {cfg.label} - {strategyLabelForTier(position.tier)}
            </p>
            <p>
              Entry: {formatPrice(position.entryPrice)} | Target: {position.target != null ? formatPrice(position.target) : "-"} | SL: {position.stoploss != null ? formatPrice(position.stoploss) : "-"}{rr ? ` | R/R ${rr}` : ""} | NAV: {nav}
            </p>
            {trigger && (
              <p className="whitespace-pre-line">
                <span className="font-semibold" style={{ color: "#f59e0b" }}>Trigger:</span> {trigger}
              </p>
            )}
            {aiNote && (
              <p className="whitespace-pre-line">
                <span className="font-semibold" style={{ color: "var(--primary)" }}>AI nhận định:</span> {aiNote}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PaperPositionCard({
  position,
  canManage = false,
  onAction,
  busy = false,
}: {
  position: PaperPosition;
  canManage?: boolean;
  onAction?: (body: Record<string, unknown>) => void;
  busy?: boolean;
}) {
  const [showAdjust, setShowAdjust] = useState(false);
  const [navInput, setNavInput] = useState(String(Math.round(position.navPct)));
  const [slInput, setSlInput] = useState(position.stoploss != null ? String(position.stoploss) : "");
  const [tpInput, setTpInput] = useState(position.target != null ? String(position.target) : "");
  const cfg = PAPER_TIER_CONFIG[position.tier] ?? PAPER_TIER_CONFIG.NGAN_HAN;
  const pnl = position.currentPnl ?? 0;
  const pnlColor = pnl >= 0 ? "#16a34a" : "var(--danger)";
  const pnlBg = pnl >= 0 ? "rgba(22,163,74,0.08)" : "rgba(192,57,43,0.08)";
  const pnlBorder = pnl >= 0 ? "rgba(22,163,74,0.20)" : "rgba(192,57,43,0.20)";
  const statusLabel = customerLabel(position.status).toLocaleUpperCase("vi-VN");
  const thirdBox = targetBoxForPosition(position);
  const dateStr = formatDate(position.openedAt);
  const holdingDays = daysSince(position.openedAt);
  const currentPrice = position.currentPrice ?? position.entryPrice;

  return (
    <div
      className="glow-card rounded-[14px] border transition-all duration-300 p-0 overflow-hidden"
      style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
    >
      <div className="p-4 pb-0">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-lg leading-none">{cfg.icon}</span>
            <span className="text-xl font-black font-mono tracking-wide" style={{ color: "var(--text-primary)" }}>
              {position.ticker}
            </span>
          </div>
          <div className="flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
            <Clock className="w-3 h-3" />
            <span className="text-[12px]">Ngày {dateStr} — {holdingDays} ngày</span>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span
            className="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
            style={{ background: `${cfg.navBarColor}18`, color: cfg.navBarColor, border: `1px solid ${cfg.navBarColor}40` }}
          >
            {cfg.label}
          </span>
          <span
            className="text-[12px] font-bold px-1.5 py-0.5 rounded"
            style={{
              background: position.status === "HOLD_TO_DIE" ? "rgba(245,158,11,0.10)" : "rgba(22,163,74,0.10)",
              color: position.status === "HOLD_TO_DIE" ? "#f59e0b" : "#16a34a",
              border: position.status === "HOLD_TO_DIE" ? "1px solid rgba(245,158,11,0.25)" : "1px solid rgba(22,163,74,0.25)",
            }}
          >
            {statusLabel}
          </span>
          <span className="text-[13px] font-black px-2 py-0.5 rounded" style={{ background: pnlBg, color: pnlColor, border: `1px solid ${pnlBorder}` }}>
            PnL {pnl >= 0 ? "+" : ""}{pnl.toFixed(1)}%
          </span>
          <span className="rounded-md border px-1.5 py-0.5 text-[11px] font-bold" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
            {position.exchange}
          </span>
          {position.locked && (
            <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-bold" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" }}>
              <Lock className="w-3 h-3" /> Khóa giữ
            </span>
          )}
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[12px] uppercase tracking-wider font-medium" style={{ color: "var(--text-secondary)" }}>
              Tỷ trọng đang nắm giữ
            </span>
            <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
              {position.navPct.toFixed(1)}% NAV
            </span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-hover)" }}>
            <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${Math.min(position.navPct, 100)}%`, background: cfg.navBarColor }} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5 mb-3">
          <div className="rounded-lg p-2 text-center" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            <p className="text-[11px] uppercase mb-0.5 font-medium" style={{ color: "var(--text-secondary)" }}>Giá vốn</p>
            <p className="text-sm font-bold font-mono" style={{ color: "var(--text-primary)" }}>{formatPrice(position.entryPrice)}</p>
          </div>
          <div className="rounded-lg p-2 text-center" style={{ background: pnlBg, border: `1px solid ${pnlBorder}` }}>
            <p className="text-[11px] uppercase mb-0.5 font-medium" style={{ color: pnlColor }}>Hiện tại</p>
            <p className="text-sm font-bold font-mono" style={{ color: pnlColor }}>{formatPrice(currentPrice)}</p>
          </div>
          <div className="rounded-lg p-2 text-center" style={{ background: thirdBox.background, border: `1px solid ${thirdBox.border}` }}>
            <p className="text-[11px] uppercase mb-0.5 font-medium" style={{ color: thirdBox.color }}>{thirdBox.label}</p>
            <p className="text-sm font-bold font-mono" style={{ color: thirdBox.color }}>{thirdBox.value}</p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[12px] mb-3" style={{ color: "var(--text-secondary)" }}>
          <span className="flex items-center gap-1">
            <Target className="w-3 h-3" style={{ color: "var(--primary)" }} />
            <span className="font-bold" style={{ color: "var(--primary)" }}>{position.quantity.toLocaleString("vi-VN")} CP</span>
          </span>
          <span className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3" style={{ color: pnlColor }} />
            <span className="font-bold" style={{ color: pnlColor }}>Tăng trưởng {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}%</span>
          </span>
          <span className="font-medium">Giá trị {formatPrice(position.marketValue)}</span>
        </div>

        {position.pendingExitReason && (
          <div className="flex items-start gap-1.5 mb-3">
            <Zap className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: "#f59e0b" }} />
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "rgba(245,158,11,0.70)" }}>
                Chờ bán
              </span>
              <p className="text-xs leading-snug line-clamp-2" style={{ color: "var(--text-secondary)" }}>
                {position.pendingExitReason}
              </p>
            </div>
          </div>
        )}
      </div>

      <PaperPositionInsight position={position} />

      {canManage && onAction && (
        <div className="mx-3 mb-3 space-y-2">
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => onAction({ action: "lock", positionId: position.id, locked: !position.locked })}
              className="rounded-lg border px-2 py-2 text-[11px] font-bold transition-all hover:opacity-90 disabled:opacity-50"
              style={{ borderColor: "var(--border)", background: position.locked ? "rgba(245,158,11,0.12)" : "var(--surface-2)", color: position.locked ? "#f59e0b" : "var(--text-primary)" }}
            >
              {position.locked ? "🔓 Mở khóa" : "🔒 Khóa giữ"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setShowAdjust((v) => !v)}
              className="rounded-lg border px-2 py-2 text-[11px] font-bold transition-all hover:opacity-90 disabled:opacity-50"
              style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}
            >
              ✏️ Tỉ trọng
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm(`Bán tay ${position.ticker} ngay theo giá hiện tại?`)) {
                  onAction({ action: "sell", positionId: position.id });
                }
              }}
              className="rounded-lg border px-2 py-2 text-[11px] font-bold transition-all hover:opacity-90 disabled:opacity-50"
              style={{ borderColor: "rgba(192,57,43,0.30)", background: "rgba(192,57,43,0.08)", color: "var(--danger)" }}
            >
              💰 Bán tay
            </button>
          </div>
          {showAdjust && (
            <div className="rounded-lg border p-2.5 space-y-2" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
              <div className="grid grid-cols-3 gap-2">
                <label className="block text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  Tỉ trọng %
                  <input value={navInput} onChange={(e) => setNavInput(e.target.value)} inputMode="numeric" className="mt-0.5 w-full rounded border px-1.5 py-1 text-xs font-mono" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-primary)" }} />
                </label>
                <label className="block text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  Stoploss
                  <input value={slInput} onChange={(e) => setSlInput(e.target.value)} inputMode="decimal" placeholder="-" className="mt-0.5 w-full rounded border px-1.5 py-1 text-xs font-mono" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-primary)" }} />
                </label>
                <label className="block text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  Take-profit
                  <input value={tpInput} onChange={(e) => setTpInput(e.target.value)} inputMode="decimal" placeholder="-" className="mt-0.5 w-full rounded border px-1.5 py-1 text-xs font-mono" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-primary)" }} />
                </label>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const nav = Number(navInput);
                  onAction({
                    action: "adjust",
                    positionId: position.id,
                    navPct: Number.isFinite(nav) && nav > 0 ? nav : undefined,
                    stoploss: slInput.trim() === "" ? null : Number(slInput),
                    target: tpInput.trim() === "" ? null : Number(tpInput),
                  });
                  setShowAdjust(false);
                }}
                className="w-full rounded-lg px-2 py-1.5 text-[11px] font-black text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: "var(--primary)" }}
              >
                Lưu (nhồi/giảm tỉ trọng + đặt SL/TP)
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mx-3 mb-3">
        <Link href={`/stock/${position.ticker}`}>
          <button
            type="button"
            className="w-full rounded-xl border px-3 py-2 text-xs font-black transition-all hover:opacity-90"
            style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}
          >
            Xem kế hoạch
          </button>
        </Link>
      </div>
    </div>
  );
}

export function SignalMapClient({
  isPremium = false,
  showExecutionActions = false,
}: {
  isPremium?: boolean;
  showExecutionActions?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("RADAR");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [isScanning, setIsScanning] = useState(false);
  const [paperBusy, setPaperBusy] = useState<string | null>(null);
  const [buyTicker, setBuyTicker] = useState("");
  const [buyNav, setBuyNav] = useState("15");
  const [buyTier, setBuyTier] = useState("NGAN_HAN");
  const [isTradingSession, setIsTradingSession] = useState(false);
  const [watchlistTicker, setWatchlistTicker] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(18);

  useEffect(() => {
    setVisibleCount(18);
  }, [tab, tierFilter]);

  useEffect(() => {
    const updateTradingSession = () => setIsTradingSession(isWithinVnTradingSession());
    updateTradingSession();
    const timer = window.setInterval(updateTradingSession, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const refreshInterval =
    tab === "ACTIVE"
      ? isTradingSession
        ? 120_000   // was 30s — /api/signals now returns instantly; bridge updates in background
        : 15 * 60_000
      : isTradingSession
        ? 5 * 60_000
        : 15 * 60_000;

  const signalMapTopic = useTopic<SignalMapTopicValue>("signal:map:latest", {
    refreshInterval,
    revalidateOnFocus: false,
    dedupingInterval: 10_000,
  });
  const reportedTopic = useTopic<ReportedSignalSummary>("signal:reported:today", {
    enabled: !signalMapTopic.data?.reportedToday,
    refreshInterval: 60_000,
    revalidateOnFocus: false,
    dedupingInterval: 10_000,
  });

  const allSignals = signalMapTopic.data?.signals ?? [];
  const paperAccount = signalMapTopic.data?.paperAccount ?? null;
  const paperPositions = paperAccount?.positions ?? [];
  const reportedSummary = signalMapTopic.data?.reportedToday ?? reportedTopic.data;
  const reportedRows = reportedSummary?.groups.flatMap((group) => group.rows) ?? [];
  const reportedPreview = reportedRows.slice(0, 24);
  const isRadarVisible = (s: Signal) => {
    const status = s.status ?? "RADAR";
    return status === "RADAR" || (s.reportedToday === true && (status === "ACTIVE" || status === "HOLD_TO_DIE"));
  };
  const tabSignals = allSignals.filter((s) => {
    const status = s.status ?? "RADAR";
    if (tab === "ACTIVE") return status === "ACTIVE" || status === "HOLD_TO_DIE";
    if (tab === "RADAR") return isRadarVisible(s);
    return status === tab;
  });
  const filtered = tierFilter === "all"
    ? tabSignals
    : tabSignals.filter((s) => (s.tier ?? "NGAN_HAN") === tierFilter);
  const filteredPaperPositions = tierFilter === "all"
    ? paperPositions
    : paperPositions.filter((position) => (position.tier ?? "NGAN_HAN") === tierFilter);

  const activePnlSignals = allSignals.filter(
    (s) =>
      (s.status === "ACTIVE" || s.status === "HOLD_TO_DIE") &&
      typeof s.currentPnl === "number" &&
      Number.isFinite(s.currentPnl),
  );
  const closedPnlSignals = allSignals.filter(
    (s) => s.status === "CLOSED" && typeof s.pnl === "number" && Number.isFinite(s.pnl),
  );
  const activeNavWeight = activePnlSignals.reduce((sum, s) => sum + Math.max(s.navAllocation ?? 0, 0), 0);
  const activeWeightedPnl = activePnlSignals.length > 0
    ? activeNavWeight > 0
      ? activePnlSignals.reduce(
          (sum, s) => sum + (s.currentPnl ?? 0) * Math.max(s.navAllocation ?? 0, 0),
          0,
        ) / activeNavWeight
      : activePnlSignals.reduce((sum, s) => sum + (s.currentPnl ?? 0), 0) / activePnlSignals.length
    : 0;
  const closedTotalPnl = closedPnlSignals.reduce((sum, s) => sum + (s.pnl ?? 0), 0);
  const displayedPnlSignals = paperPositions.length > 0 ? [] : activePnlSignals.length > 0 ? activePnlSignals : closedPnlSignals;

  const stats = {
    radar:  allSignals.filter(isRadarVisible).length,
    active: paperPositions.length,
    closed: allSignals.filter((s) => s.status === "CLOSED").length,
    totalPnl: paperAccount ? paperAccount.totalPnlPct : activePnlSignals.length > 0 ? activeWeightedPnl : closedTotalPnl,
    winCount: paperPositions.length > 0
      ? paperPositions.filter((position) => (position.currentPnl ?? 0) > 0).length
      : displayedPnlSignals.filter((s) => ((s.status === "CLOSED" ? s.pnl : s.currentPnl) ?? 0) > 0).length,
    loseCount: paperPositions.length > 0
      ? paperPositions.filter((position) => (position.currentPnl ?? 0) <= 0).length
      : displayedPnlSignals.filter((s) => ((s.status === "CLOSED" ? s.pnl : s.currentPnl) ?? 0) <= 0).length,
  };

  const tierCounts = {
    LEADER:   (tab === "ACTIVE" ? paperPositions : tabSignals).filter((s) => (s.tier ?? "NGAN_HAN") === "LEADER").length,
    TRUNG_HAN:(tab === "ACTIVE" ? paperPositions : tabSignals).filter((s) => (s.tier ?? "NGAN_HAN") === "TRUNG_HAN").length,
    NGAN_HAN: (tab === "ACTIVE" ? paperPositions : tabSignals).filter((s) => (s.tier ?? "NGAN_HAN") === "NGAN_HAN").length,
    TAM_NGAM: (tab === "ACTIVE" ? paperPositions : tabSignals).filter((s) => s.tier === "TAM_NGAM").length,
  };

  const tabCount = (t: Tab) => t === "RADAR" ? stats.radar : t === "ACTIVE" ? stats.active : stats.closed;

  const pnlColor = stats.totalPnl >= 0 ? "#16a34a" : "var(--danger)";
  const pnlBg    = stats.totalPnl >= 0 ? "rgba(22,163,74,0.05)" : "rgba(192,57,43,0.05)";
  const pnlBorder= stats.totalPnl >= 0 ? "rgba(22,163,74,0.20)" : "rgba(192,57,43,0.20)";
  const isRefreshing = signalMapTopic.isValidating || isScanning;

  async function handleRefresh() {
    setIsScanning(true);
    try {
      const res = await fetch("/api/scan-now", { method: "POST" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
    } catch (error) {
      console.error("[SignalMap] Refresh scan failed:", error);
    } finally {
      await signalMapTopic.refresh(true);
      setIsScanning(false);
    }
  }

  async function callPaperAction(body: Record<string, unknown>) {
    const key = typeof body.positionId === "string" ? body.positionId : "buy";
    setPaperBusy(key);
    try {
      const res = await fetch("/api/signals/paper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.ok === false) {
        window.alert(`Không thực hiện được: ${data?.reason ?? data?.error ?? `HTTP ${res.status}`}`);
      } else if (body.action === "buy") {
        setBuyTicker("");
      }
    } catch {
      window.alert("Lỗi kết nối khi can thiệp tài khoản.");
    } finally {
      await signalMapTopic.refresh(true);
      setPaperBusy(null);
    }
  }

  async function handleWatchlist(signal: Signal) {
    setWatchlistTicker(signal.ticker);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: signal.ticker, source: "radar", sourceSignalId: signal.id }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || "Không thêm được Watchlist");
      }
    } catch (error) {
      console.error("[SignalMap] Watchlist add failed:", error);
    } finally {
      setWatchlistTicker(null);
    }
  }

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-5 max-w-7xl mx-auto">
      {/* ═══ Header ═══ */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div
            className="p-2 rounded-xl flex-shrink-0"
            style={{
              background: "var(--primary-light)",
              border: "1px solid var(--border)",
            }}
          >
            <Bot className="w-5 h-5" style={{ color: "var(--primary)" }} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black" style={{ color: "var(--text-primary)" }}>
              {PRODUCT_NAMES.brokerWorkflow}
            </h1>
            <p className="text-xs sm:text-sm truncate" style={{ color: "var(--text-secondary)" }}>
              {PRODUCT_DESCRIPTIONS.brokerWorkflow}
            </p>
            <div className="mt-1">
              <FreshnessBadge freshness={signalMapTopic.freshness} />
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleRefresh} loading={isRefreshing}>
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          Làm mới
        </Button>
      </div>

      {/* Reported signals */}
      {reportedSummary && reportedSummary.total > 0 && (
        <section
          className="rounded-xl border p-3"
          style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
          aria-label="Tín hiệu đã báo hôm nay"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <History className="h-4 w-4 flex-shrink-0" style={{ color: "var(--primary)" }} />
              <p className="truncate text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                Đã báo hôm nay
              </p>
            </div>
            <p className="flex-shrink-0 text-xs" style={{ color: "var(--text-secondary)" }}>
              {reportedSummary.tradingDate} - {reportedSummary.total} mã
            </p>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {reportedPreview.map((row) => (
              <span
                key={`${row.ticker}-${row.signalType}-${row.reportedAt ?? "na"}`}
                className="rounded-md border px-2 py-1 text-xs font-semibold"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--surface)",
                  color: "var(--text-primary)",
                }}
              >
                {row.ticker}
                {row.entryPrice != null && Number.isFinite(row.entryPrice)
                  ? ` ${row.entryPrice.toLocaleString("vi-VN", { maximumFractionDigits: 0 })}`
                  : ""}
              </span>
            ))}
            {reportedSummary.total > reportedPreview.length && (
              <span
                className="rounded-md border px-2 py-1 text-xs font-semibold"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--surface)",
                  color: "var(--text-secondary)",
                }}
              >
                +{reportedSummary.total - reportedPreview.length}
              </span>
            )}
          </div>
        </section>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: "Tầm ngắm",   val: stats.radar,   color: "var(--primary)" },
          { label: "Đang giữ",   val: stats.active,  color: "#16a34a"         },
          { label: "Đã đóng",    val: stats.closed,  color: "var(--text-primary)" },
        ].map((item) => (
          <div
            key={item.label}
            className="glow-card rounded-[14px] border transition-all duration-200 p-3 text-center"
            style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
          >
            <p className="text-2xl font-black" style={{ color: item.color }}>{item.val}</p>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {item.label}
            </p>
          </div>
        ))}
        <div
          className="glow-card rounded-[14px] border transition-all duration-200 p-3 text-center"
          style={{ background: pnlBg, border: `1px solid ${pnlBorder}` }}
        >
          <p className="text-2xl font-black" style={{ color: pnlColor }}>
            {stats.totalPnl >= 0 ? "+" : ""}{stats.totalPnl.toFixed(1)}%
          </p>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
            PnL tổng ({stats.winCount}W / {stats.loseCount}L)
          </p>
        </div>
      </div>

      {/* ═══ Tab bar ═══ */}
      <div className="flex gap-2">
        {TABS.map(({ value, label, icon: Icon }) => {
          const isActive = tab === value;
          const isLocked = value === "CLOSED" && !isPremium;
          return (
            <button
              key={value}
              onClick={() => { if (!isLocked) setTab(value); }}
              className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg transition-all"
              style={
                isLocked
                  ? { border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-muted)", opacity: 0.6, cursor: "not-allowed" }
                  : isActive
                    ? { border: "1px solid var(--border-strong)", background: "var(--primary-light)", color: "var(--primary)" }
                    : { border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-secondary)" }
              }
            >
              {isLocked ? <Lock className="w-3 h-3" /> : <Icon className="w-3.5 h-3.5" />}
              {label}
              <span className="text-[12px] opacity-60">({tabCount(value)})</span>
              {isLocked && (
                <span
                  className="text-[12px] font-bold px-1 rounded"
                  style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" }}
                >
                  VIP
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ═══ Tier filter ═══ */}
      <div className="flex gap-2 flex-wrap">
        {TIER_FILTERS.map((item) => {
          const isActive = tierFilter === item.value;
          return (
            <button
              key={item.value}
              onClick={() => setTierFilter(item.value)}
              className="text-xs px-3 py-1.5 rounded-lg transition-all"
              style={
                isActive
                  ? { background: "var(--primary-light)", color: "var(--primary)", border: "1px solid var(--border-strong)" }
                  : { background: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }
              }
            >
              {item.label}
              {item.value !== "all" && (
                <span className="ml-1.5 opacity-60">
                  ({tierCounts[item.value as keyof typeof tierCounts] ?? 0})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ═══ Signal grid ═══ */}
      {signalMapTopic.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-52 rounded-2xl animate-pulse" style={{ background: "var(--surface)" }} />
          ))}
        </div>
      ) : tab === "ACTIVE" ? (
        paperAccount && filteredPaperPositions.length > 0 ? (
          <div className="space-y-3">
            <PaperSummary account={paperAccount} />
            {paperAccount.latestSnapshot && (
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Snapshot gần nhất: {paperAccount.latestSnapshot.snapshotDate} {paperAccount.latestSnapshot.slot}
              </p>
            )}
            {showExecutionActions && (
              <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                <p className="text-[12px] font-bold mb-2" style={{ color: "var(--text-primary)" }}>🛒 Mua tay — nạp mã hệ thống bỏ sót</p>
                <div className="flex flex-wrap items-end gap-2">
                  <input
                    value={buyTicker}
                    onChange={(e) => setBuyTicker(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                    placeholder="Mã (VD: CTS)"
                    className="w-28 rounded border px-2 py-1.5 text-sm font-mono uppercase"
                    style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-primary)" }}
                  />
                  <select
                    value={buyTier}
                    onChange={(e) => setBuyTier(e.target.value)}
                    className="rounded border px-2 py-1.5 text-xs"
                    style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-primary)" }}
                  >
                    <option value="LEADER">👑 Siêu cổ phiếu</option>
                    <option value="TRUNG_HAN">🛡️ Trung hạn</option>
                    <option value="NGAN_HAN">⚡ Ngắn hạn</option>
                  </select>
                  <input
                    value={buyNav}
                    onChange={(e) => setBuyNav(e.target.value)}
                    inputMode="numeric"
                    placeholder="Tỉ trọng %"
                    className="w-24 rounded border px-2 py-1.5 text-sm font-mono"
                    style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-primary)" }}
                  />
                  <button
                    type="button"
                    disabled={paperBusy === "buy" || !buyTicker.trim()}
                    onClick={() => callPaperAction({ action: "buy", ticker: buyTicker.trim(), navPct: Number(buyNav) || 10, tier: buyTier })}
                    className="rounded-lg px-4 py-1.5 text-sm font-black text-white transition-all hover:opacity-90 disabled:opacity-50"
                    style={{ background: "#16a34a" }}
                  >
                    {paperBusy === "buy" ? "Đang mua…" : "Mua tay"}
                  </button>
                </div>
                <p className="text-[11px] mt-1.5" style={{ color: "var(--text-muted)" }}>
                  Mua tay mặc định được KHÓA GIỮ (hệ thống không tự bán). Bấm &quot;Mở khóa&quot; nếu muốn giao cho hệ thống quản lý.
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredPaperPositions.map((position) => (
                <PaperPositionCard
                  key={position.id}
                  position={position}
                  canManage={showExecutionActions}
                  onAction={callPaperAction}
                  busy={paperBusy === position.id}
                />
              ))}
            </div>
          </div>
        ) : (
          <Card className="p-12 text-center">
            <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-30" style={{ color: "var(--text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Chưa có vị thế hợp lệ trong tài khoản mẫu
            </p>
          </Card>
        )
      ) : tab === "CLOSED" && !isPremium ? (
        <Card className="p-12 text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.20)" }}
          >
            <Crown className="w-8 h-8" style={{ color: "#f59e0b" }} />
          </div>
          <h3 className="text-lg font-black mb-2" style={{ color: "var(--text-primary)" }}>
            Dành riêng cho VIP
          </h3>
          <p className="text-sm mb-4 max-w-sm mx-auto" style={{ color: "var(--text-secondary)" }}>
            Nâng cấp lên gói VIP để xem toàn bộ lịch sử tín hiệu đã đóng và hiệu suất PnL.
          </p>
          <Link href="/pricing">
            <button
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer"
              style={{ background: "#f59e0b", color: "#1C2B22" }}
            >
              <Crown className="w-4 h-4" />
              Nâng cấp VIP
            </button>
          </Link>
        </Card>
      ) : filtered.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.slice(0, visibleCount).map((signal, index) => (
              <SignalCard
                key={signal.id}
                signal={signal}
                index={index}
                onWatchlist={handleWatchlist}
                watchlistLoading={watchlistTicker === signal.ticker}
              />
            ))}
          </div>
          {filtered.length > visibleCount && (
            <button
              type="button"
              onClick={() => setVisibleCount((c) => c + 18)}
              className="mt-4 w-full rounded-xl border py-3 text-sm font-bold transition-colors"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--primary)" }}
            >
              Xem thêm ({filtered.length - visibleCount} tín hiệu)
            </button>
          )}
        </>
      ) : (
        <Card className="p-12 text-center">
          <Crosshair className="w-10 h-10 mx-auto mb-3 opacity-30" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {tab === "RADAR"  && "Chưa có tín hiệu nào trong tầm ngắm"}
            {tab === "CLOSED" && "Chưa có vị thế nào đã đóng"}
          </p>
        </Card>
      )}

      {/* ═══ Footer ═══ */}
      <div
        className="rounded-xl p-4 text-center"
        style={{ border: "1px solid var(--border)", background: "var(--surface-2)" }}
      >
        <p className="text-xs sm:text-sm" style={{ color: "var(--text-secondary)" }}>
          🤖 Tất cả các khuyến nghị đều mang tính chất tham khảo, khách hàng vui lòng tự chịu trách nhiệm trong quyết định đầu tư của mình.
        </p>
      </div>
    </div>
  );
}

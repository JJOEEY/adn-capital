"use client";

import { MainLayout } from "@/components/layout/MainLayout";
import { LockOverlay } from "@/components/ui/LockOverlay";
import { useSubscription } from "@/hooks/useSubscription";
import { useTopic } from "@/hooks/useTopic";
import { PieChart, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";

type PortfolioPosition = {
  ticker: string;
  entryPrice: number | null;
  currentPrice: number | null;
  pnlPercent: number | null;
  target: number | null;
  stoploss: number | null;
  navAllocation: number | null;
  type: string | null;
  tier: string | null;
};

type PortfolioTopicData = {
  connected: boolean;
  reason?: string;
  summary?: {
    activeCount: number;
    navAllocatedPct: number;
  };
  positions: PortfolioPosition[];
};

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

function signalColor(percent: number) {
  if (percent >= 7) return { label: "XANH", bg: "rgba(22,163,74,0.12)", color: "#16a34a" };
  if (percent >= 1) return { label: "TÍM", bg: "rgba(168,85,247,0.12)", color: "#a855f7" };
  if (percent >= -3) return { label: "LƠ", bg: "rgba(56,189,248,0.12)", color: "#38bdf8" };
  return { label: "ĐỎ", bg: "rgba(239,68,68,0.12)", color: "#ef4444" };
}

function fmtPrice(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "--";
  return value.toLocaleString("vi-VN");
}

export default function PortfolioPage() {
  const { isVip } = useSubscription();
  const portfolioTopic = useTopic<PortfolioTopicData>("signal:portfolio:current-user", {
    refreshInterval: 45_000,
    revalidateOnFocus: false,
    dedupingInterval: 10_000,
  });

  const data = portfolioTopic.data;
  const holdings = data?.positions ?? [];
  const isConnected = Boolean(data?.connected);

  return (
    <MainLayout>
      <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <PieChart className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
            <h1 className="text-xl font-black" style={{ color: "var(--text-primary)" }}>Danh mục đầu tư</h1>
            <FreshnessBadge freshness={portfolioTopic.freshness} />
          </div>
          <button
            onClick={() => void portfolioTopic.refresh(true)}
            className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--surface)" }}
          >
            Làm mới
          </button>
        </div>

        <LockOverlay isLocked={!isVip} message="Nâng cấp VIP để mở NexVault">
          {!isConnected ? (
            <div
              className="rounded-2xl border p-4 text-sm"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              <div className="mb-2 flex items-center gap-2" style={{ color: "var(--warning, #f59e0b)" }}>
                <AlertTriangle className="h-4 w-4" />
                <span className="font-semibold">Chưa kết nối DNSE hoặc chưa có dữ liệu danh mục trực tiếp.</span>
              </div>
              <p>Hệ thống đang hiển thị danh mục theo tín hiệu ACTIVE hiện tại để theo dõi nhanh.</p>
            </div>
          ) : null}

          {portfolioTopic.isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-44 animate-pulse rounded-2xl" style={{ background: "var(--surface)" }} />
              ))}
            </div>
          ) : holdings.length === 0 ? (
            <div
              className="rounded-2xl border p-10 text-center text-sm"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-muted)" }}
            >
              Chưa có vị thế mở trong danh mục.
            </div>
          ) : (
            <>
              <div
                className="rounded-2xl border p-3 text-sm"
                style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                Đang giữ: <span style={{ color: "var(--text-primary)" }}>{data?.summary?.activeCount ?? holdings.length}</span> mã ·
                NAV phân bổ: <span style={{ color: "var(--text-primary)" }}> {Number(data?.summary?.navAllocatedPct ?? 0).toFixed(2)}%</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {holdings.map((item) => {
                  const pnlPercent = Number(item.pnlPercent ?? 0);
                  const signal = signalColor(pnlPercent);
                  const isUp = pnlPercent >= 0;
                  return (
                    <div
                      key={`${item.ticker}-${item.entryPrice ?? 0}`}
                      className="rounded-2xl border p-4"
                      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-lg font-black" style={{ color: "var(--text-primary)" }}>{item.ticker}</p>
                        <span className="rounded-full px-2 py-1 text-[11px] font-black" style={{ background: signal.bg, color: signal.color }}>
                          AI {signal.label}
                        </span>
                      </div>

                      <div className="mb-3 flex gap-2 text-[11px]">
                        {item.tier ? (
                          <span
                            className="rounded-full border px-2 py-0.5"
                            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                          >
                            {item.tier}
                          </span>
                        ) : null}
                        {item.type ? (
                          <span
                            className="rounded-full border px-2 py-0.5"
                            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                          >
                            {item.type}
                          </span>
                        ) : null}
                        <span
                          className="rounded-full border px-2 py-0.5"
                          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                        >
                          NAV {Number(item.navAllocation ?? 0).toFixed(2)}%
                        </span>
                      </div>

                      <div className="space-y-1.5 text-sm">
                        <p style={{ color: "var(--text-secondary)" }}>
                          Entry: <span style={{ color: "var(--text-primary)" }}>{fmtPrice(item.entryPrice)}</span>
                        </p>
                        <p style={{ color: "var(--text-secondary)" }}>
                          Giá hiện tại: <span style={{ color: "var(--text-primary)" }}>{fmtPrice(item.currentPrice)}</span>
                        </p>
                        <p style={{ color: "var(--text-secondary)" }}>
                          Target/SL:
                          <span style={{ color: "var(--text-primary)" }}> {fmtPrice(item.target)} / {fmtPrice(item.stoploss)}</span>
                        </p>
                      </div>

                      <div className="mt-3 flex items-center gap-2 text-sm font-bold" style={{ color: isUp ? "#16a34a" : "#ef4444" }}>
                        {isUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                        {pnlPercent >= 0 ? "+" : ""}{pnlPercent.toFixed(2)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </LockOverlay>
      </div>
    </MainLayout>
  );
}

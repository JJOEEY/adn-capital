"use client";

import useSWR from "swr";
import { MainLayout } from "@/components/layout/MainLayout";
import { LockOverlay } from "@/components/ui/LockOverlay";
import { useSubscription } from "@/hooks/useSubscription";
import { PieChart, TrendingUp, TrendingDown } from "lucide-react";

interface Holding {
  ticker: string;
  qty: number;
  avgPrice: number;
  marketPrice: number;
  marketValue: number;
  totalCost: number;
}

interface PnlPayload {
  currentHoldings: Holding[];
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function signalColor(percent: number) {
  if (percent >= 7) return { label: "XANH", bg: "rgba(22,163,74,0.12)", color: "#16a34a" };
  if (percent >= 1) return { label: "TIM", bg: "rgba(168,85,247,0.12)", color: "#a855f7" };
  if (percent >= -3) return { label: "LO", bg: "rgba(56,189,248,0.12)", color: "#38bdf8" };
  return { label: "DO", bg: "rgba(239,68,68,0.12)", color: "#ef4444" };
}

export default function PortfolioPage() {
  const { isVip } = useSubscription();
  const { data, isLoading } = useSWR<PnlPayload>("/api/journal/pnl", fetcher, { revalidateOnFocus: false });
  const holdings = data?.currentHoldings ?? [];

  return (
    <MainLayout>
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <PieChart className="w-5 h-5" style={{ color: "var(--text-secondary)" }} />
          <h1 className="text-xl font-black" style={{ color: "var(--text-primary)" }}>Danh muc dau tu</h1>
        </div>

        <LockOverlay isLocked={!isVip} message="Nang cap VIP de mo Danh muc AI Broker">
          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-40 rounded-2xl animate-pulse" style={{ background: "var(--surface)" }} />
              ))}
            </div>
          ) : holdings.length === 0 ? (
            <div className="rounded-2xl border p-10 text-center text-sm" style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-muted)" }}>
              Chua co vi the mo trong danh muc.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {holdings.map((item) => {
                const pnlPercent = item.avgPrice > 0 ? ((item.marketPrice - item.avgPrice) / item.avgPrice) * 100 : 0;
                const signal = signalColor(pnlPercent);
                const isUp = pnlPercent >= 0;
                return (
                  <div
                    key={item.ticker}
                    className="rounded-2xl border p-4"
                    style={{ background: "var(--surface)", borderColor: "var(--border)" }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-lg font-black" style={{ color: "var(--text-primary)" }}>{item.ticker}</p>
                      <span className="text-[11px] font-black px-2 py-1 rounded-full" style={{ background: signal.bg, color: signal.color }}>
                        AI {signal.label}
                      </span>
                    </div>
                    <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
                      Khoi luong: {item.qty.toLocaleString("vi-VN")}
                    </p>
                    <div className="space-y-1.5 text-sm">
                      <p style={{ color: "var(--text-secondary)" }}>Gia von: <span style={{ color: "var(--text-primary)" }}>{item.avgPrice.toLocaleString("vi-VN")}</span></p>
                      <p style={{ color: "var(--text-secondary)" }}>Gia thi truong: <span style={{ color: "var(--text-primary)" }}>{item.marketPrice.toLocaleString("vi-VN")}</span></p>
                      <p style={{ color: "var(--text-secondary)" }}>Gia tri: <span style={{ color: "var(--text-primary)" }}>{item.marketValue.toLocaleString("vi-VN")}</span></p>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-sm font-bold" style={{ color: isUp ? "#16a34a" : "#ef4444" }}>
                      {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      {pnlPercent >= 0 ? "+" : ""}{pnlPercent.toFixed(2)}%
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </LockOverlay>
      </div>
    </MainLayout>
  );
}


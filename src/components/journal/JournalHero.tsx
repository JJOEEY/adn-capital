"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { motion } from "framer-motion";
import { Wallet, TrendingUp, TrendingDown, Trophy } from "lucide-react";
import { useLivePnL } from "@/hooks/useLivePnL";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface PnlSummary {
  initialNAV: number;
  realizedPnL: number;
  unrealizedPnL: number;
  currentNAV: number;
  currentHoldings?: {
    ticker: string;
    qty: number;
    avgPrice: number;
    totalCost: number;
    marketPrice: number;
    marketValue: number;
  }[];
  stats?: { winRate: number; winTrades: number; lossTrades: number };
}

const GREEN = "#16a34a";

// VND gọn: 1,25 tỷ / 320 tr / 850.000
function fmtVnd(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2).replace(/[.,]?0+$/, "")} tỷ`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(abs >= 1e8 ? 0 : 1).replace(/[.,]?0+$/, "")} tr`;
  return `${sign}${Math.round(abs).toLocaleString("vi-VN")}`;
}

function fmtSignedVnd(n: number): string {
  return `${n >= 0 ? "+" : "-"}${fmtVnd(Math.abs(n))}`;
}

export function JournalHero() {
  const { data, isLoading } = useSWR<PnlSummary>("/api/journal/pnl", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  const liveInput = useMemo(
    () =>
      data
        ? { initialNAV: data.initialNAV ?? 0, realizedPnL: data.realizedPnL ?? 0, holdings: data.currentHoldings ?? [] }
        : null,
    [data],
  );
  const live = useLivePnL(liveInput);

  if (isLoading || !data) {
    return <div className="h-[112px] rounded-2xl animate-pulse" style={{ background: "var(--surface)" }} />;
  }

  const { initialNAV = 0, realizedPnL = 0 } = data;
  // Ưu tiên số LIVE; ngoài phiên rơi về số server (close ngày) — khớp y hệt.
  const unrealizedPnL = live.unrealizedPnL;
  const currentNAV = live.currentNAV;
  const totalPnL = realizedPnL + unrealizedPnL;
  const hasNav = initialNAV > 0;
  const totalPct = hasNav ? (totalPnL / initialNAV) * 100 : null;
  const pos = totalPnL >= 0;
  const accent = pos ? GREEN : "var(--danger)";
  const winRate = data.stats?.winRate ?? 0;
  const winTrades = data.stats?.winTrades ?? 0;
  const lossTrades = data.stats?.lossTrades ?? 0;

  const mini = [
    { label: "Đã chốt", value: fmtSignedVnd(realizedPnL), color: realizedPnL >= 0 ? GREEN : "var(--danger)", icon: realizedPnL >= 0 ? TrendingUp : TrendingDown },
    { label: "Đang mở", value: fmtSignedVnd(unrealizedPnL), color: unrealizedPnL >= 0 ? GREEN : "var(--danger)", icon: unrealizedPnL >= 0 ? TrendingUp : TrendingDown },
    { label: "Tỷ lệ thắng", value: `${winRate}%`, sub: `${winTrades}T · ${lossTrades}B`, color: "var(--text-primary)", icon: Trophy },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border overflow-hidden"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="grid grid-cols-1 md:grid-cols-[1.1fr_1.4fr]">
        {/* NAV / tổng lãi lỗ — tâm điểm */}
        <div className="p-4 sm:p-5 flex flex-col justify-center" style={{ background: "var(--primary-light)" }}>
          <div className="flex items-center gap-1.5 mb-1" style={{ color: "var(--text-muted)" }}>
            <Wallet className="w-3.5 h-3.5" />
            <span className="text-[12px] font-semibold">{hasNav ? "Tài sản ròng (NAV)" : "Tổng lãi/lỗ"}</span>
            {live.isLive && (
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider" style={{ color: GREEN }}>
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: GREEN }} />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: GREEN }} />
                </span>
                LIVE
              </span>
            )}
          </div>
          <p className="text-2xl sm:text-3xl font-black font-mono tracking-tight" style={{ color: "var(--text-primary)" }}>
            {hasNav ? fmtVnd(currentNAV) : fmtSignedVnd(totalPnL)}
            <span className="text-base font-bold ml-1" style={{ color: "var(--text-muted)" }}>₫</span>
          </p>
          <p className="text-sm font-bold mt-0.5" style={{ color: accent }}>
            {fmtSignedVnd(totalPnL)}₫
            {totalPct !== null && <span className="ml-1">({pos ? "+" : ""}{totalPct.toFixed(2)}%)</span>}
            {!hasNav && <span className="font-medium ml-1" style={{ color: "var(--text-muted)" }}>· đặt vốn ban đầu ở tab PnL để xem %</span>}
          </p>
        </div>

        {/* 3 chỉ số phụ */}
        <div className="grid grid-cols-3 divide-x" style={{ borderColor: "var(--border)" }}>
          {mini.map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.label} className="p-3 sm:p-4 flex flex-col justify-center" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center gap-1 mb-0.5" style={{ color: "var(--text-muted)" }}>
                  <Icon className="w-3 h-3" />
                  <span className="text-[11px] font-medium">{m.label}</span>
                </div>
                <p className="text-base sm:text-lg font-black font-mono leading-tight" style={{ color: m.color }}>{m.value}</p>
                {m.sub && <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{m.sub}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

"use client";

import { memo } from "react";
import useSWR from "swr";
import { ShieldCheck, AlertTriangle, XOctagon, TrendingUp } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
 *  LeaderRadar — Widget "Cầu Dao Tổng" trên Dashboard
 *  3 trạng thái: BÌNH THƯỜNG (xanh) | CẢNH BÁO (vàng) | THOÁT HÀNG (đỏ)
 * ═══════════════════════════════════════════════════════════════════════════ */

interface LeaderStock {
  ticker: string;
  sector: string;
  close: number;
  rs_rating: number;
}

interface FloorLeader {
  ticker: string;
  close: number;
  ref: number;
  pct_change: number;
}

interface SectorFlow {
  sector: string;
  avg_rs: number;
  stock_count: number;
}

interface HistoryEvent {
  date: string;
  event: string;
  detail: string;
}

interface LeaderRadarData {
  state: "BÌNH THƯỜNG" | "CẢNH BÁO" | "THOÁT HÀNG";
  floor_count: number;
  cash_ratio: number;
  message: string;
  action: string;
  leading_sector: string;
  leaders: LeaderStock[];
  floor_leaders: FloorLeader[];
  sector_flow: SectorFlow[];
  macro_score: number;
  last_floor_date: string;
  history: HistoryEvent[];
  updated_at: string;
}

const STATE_CONFIG = {
  "BÌNH THƯỜNG": {
    border: "border-emerald-500/30",
    shadow: "shadow-[0_0_30px_-8px_rgba(16,185,129,0.4)]",
    glow: "bg-emerald-500/20",
    text: "text-emerald-400",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    Icon: ShieldCheck,
    pulse: false,
  },
  "CẢNH BÁO": {
    border: "border-yellow-500/40",
    shadow: "shadow-[0_0_40px_-8px_rgba(234,179,8,0.5)]",
    glow: "bg-yellow-500/20",
    text: "text-yellow-400",
    badge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
    Icon: AlertTriangle,
    pulse: true,
  },
  "THOÁT HÀNG": {
    border: "border-red-500/50",
    shadow: "shadow-[0_0_50px_-8px_rgba(239,68,68,0.6)]",
    glow: "bg-red-500/25",
    text: "text-red-400",
    badge: "bg-red-500/10 text-red-400 border-red-500/30",
    Icon: XOctagon,
    pulse: true,
  },
} as const;

const fetcher = (url: string) =>
  fetch(url, { signal: AbortSignal.timeout(12_000) }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export const LeaderRadar = memo(function LeaderRadar() {
  const { data, isLoading } = useSWR<LeaderRadarData>(
    "/api/leader-radar",
    fetcher,
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
      refreshInterval: 60_000,
      shouldRetryOnError: false,
    },
  );

  if (isLoading || !data) return <LeaderRadarSkeleton />;

  const state = data.state ?? "BÌNH THƯỜNG";
  const cfg = STATE_CONFIG[state] ?? STATE_CONFIG["BÌNH THƯỜNG"];
  const { Icon } = cfg;

  return (
    <div
      className={`
        relative overflow-hidden rounded-2xl bg-neutral-900/90 border
        transition-all duration-500 ease-out
        ${cfg.border} ${cfg.shadow}
      `}
    >
      {/* Glow background */}
      <div
        className={`absolute -top-12 -left-12 w-48 h-48 rounded-full blur-3xl opacity-30 ${cfg.glow} ${
          cfg.pulse ? "animate-pulse" : ""
        }`}
      />
      <div
        className={`absolute -bottom-8 -right-8 w-32 h-32 rounded-full blur-2xl opacity-20 ${cfg.glow} ${
          cfg.pulse ? "animate-pulse" : ""
        }`}
      />

      <div className="relative z-10 p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${cfg.glow}`}>
              <Icon className={`w-4 h-4 ${cfg.text}`} />
            </div>
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
              Radar Leader Alert
            </span>
          </div>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.badge}`}
          >
            {state}
          </span>
        </div>

        {/* Cash Ratio Bar */}
        <div className="mb-3">
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider">
              Tỷ lệ tiền mặt
            </span>
            <span className={`text-lg font-black ${cfg.text}`}>
              {data.cash_ratio}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                data.cash_ratio >= 100
                  ? "bg-red-500"
                  : data.cash_ratio >= 50
                    ? "bg-yellow-500"
                    : "bg-emerald-500"
              }`}
              style={{ width: `${data.cash_ratio}%` }}
            />
          </div>
        </div>

        {/* Message */}
        {data.message && (
          <p className="text-xs text-neutral-300 leading-relaxed mb-3">
            {data.message}
          </p>
        )}

        {/* Leading Sector + Leaders */}
        <div className="mb-3">
          {data.leading_sector && data.leaders?.length > 0 ? (
            <>
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp className="w-3 h-3 text-emerald-400" />
                <span className="text-[10px] font-bold text-emerald-400 uppercase">
                  Ngành dẫn dắt: {data.leading_sector}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {data.leaders.map((l) => (
                  <div
                    key={l.ticker}
                    className="bg-neutral-800/60 rounded-lg p-2 text-center border border-neutral-700/50"
                  >
                    <p className="text-xs font-bold text-white">{l.ticker}</p>
                    <p className="text-[10px] text-neutral-400">
                      RS {l.rs_rating}
                    </p>
                    <p className="text-[10px] text-neutral-500">
                      {l.close.toLocaleString("vi-VN")}
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 bg-neutral-800/40 rounded-lg p-3">
              <span className="text-[10px] text-neutral-500">
                Chưa có cổ phiếu leader — Không có ngành nào đủ mạnh để dẫn dắt.
              </span>
            </div>
          )}
        </div>

        {/* Floor Leaders (nếu có) */}
        {data.floor_leaders?.length > 0 && (
          <div className="mb-3 bg-red-500/5 border border-red-500/20 rounded-lg p-2">
            <p className="text-[10px] font-bold text-red-400 uppercase mb-1">
              ⚠ Leader chạm sàn
            </p>
            {data.floor_leaders.map((f) => (
              <p key={f.ticker} className="text-[11px] text-red-300">
                {f.ticker}: {f.close.toLocaleString("vi-VN")} ({f.pct_change.toFixed(1)}%)
              </p>
            ))}
          </div>
        )}

        {/* Action */}
        {data.action && (
          <p className="text-[11px] text-neutral-400 italic">
            &ldquo;{data.action}&rdquo;
          </p>
        )}

        {/* Macro Score */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-800">
          <span className="text-[10px] text-neutral-500">
            Macro Score: {data.macro_score ?? 0}/10
          </span>
          {data.updated_at && (
            <span className="text-[10px] text-neutral-600">
              {data.updated_at}
            </span>
          )}
        </div>

        {/* Recent History */}
        {data.history.length > 0 && (
          <div className="mt-2 space-y-1">
            {data.history.slice(-2).map((h, i) => (
              <p key={i} className="text-[9px] text-neutral-600">
                [{h.date}] {h.event}: {h.detail}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

function LeaderRadarSkeleton() {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="h-4 w-32 bg-neutral-800 rounded animate-pulse" />
        <div className="h-4 w-20 bg-neutral-800 rounded-full animate-pulse" />
      </div>
      <div className="h-1.5 w-full bg-neutral-800 rounded-full animate-pulse mb-3" />
      <div className="space-y-2">
        <div className="h-3 w-full bg-neutral-800 rounded animate-pulse" />
        <div className="h-3 w-3/4 bg-neutral-800 rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-neutral-800/60 rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export { LeaderRadarSkeleton };

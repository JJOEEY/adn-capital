"use client";

import { memo, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { TrendingUp, Zap, BarChart3, Rocket, ShieldCheck, TrendingDown, Flame } from "lucide-react";

const DynamicBacktestChart = dynamic(
  () => import("@/components/dashboard/DynamicBacktestChart").then((m) => m.DynamicBacktestChart),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border p-4 sm:p-6" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="h-3 w-40 rounded animate-pulse mb-4" style={{ background: "var(--bg-hover)" }} />
        <div className="h-[360px] sm:h-[420px] rounded-xl animate-pulse" style={{ background: "var(--surface-2)" }} />
      </div>
    ),
  },
);

/* ═══════════════════════════════════════════════════════════════════════════
 *  BacktestSection — Kết quả Backtest chiến lược ADN Capital
 *  Dữ liệu thực từ public/data/latest-backtest-snapshot.json
 * ═══════════════════════════════════════════════════════════════════════════ */

interface SnapshotKPI {
  total_return: number;
  win_rate: number;
  max_drawdown: number;
  total_trades: number;
  multiplier: number;
}

interface Snapshot {
  generated_at: string;
  period: string;
  start_year: number;
  end_year: number;
  kpi: SnapshotKPI;
}

const BACKTEST_EVENTS = [
  {
    period: "Q4/2021",
    type: "protect" as const,
    event: "VN-Index đạt đỉnh 1.500 — Hệ thống phát hiện phân phối",
    result: "EMA10 cắt xuống EMA30, MACD death cross → Bán sạch danh mục + cooldown 10 phiên. Thị trường giảm -35% sau đó, ADN Capital giữ nguyên vốn.",
    saved: "+35%",
    tag: "Né đỉnh",
  },
  {
    period: "Q2/2022",
    type: "protect" as const,
    event: "Bear market — Cầu Dao Tổng kích hoạt ngay phiên đầu",
    result: "VN30 gãy MA20 + volume spike 1.5x → Leader Floor Detection chuyển 100% tiền mặt. Tránh thêm -20% sụt giảm khi VN-Index về 900.",
    saved: "+20%",
    tag: "Cầu Dao Tổng",
  },
  {
    period: "Q1/2025",
    type: "capture" as const,
    event: "SSI breakout — Sóng tăng mạnh nhất năm",
    result: "Market trên EMA50, tín hiệu ADN xác nhận + Mùa vụ thuận lợi. Lãi kép tự động tăng size → capture +45% upside chỉ trong 1 quý.",
    saved: "+45%",
    tag: "Bắt sóng lớn",
  },
];

export const BacktestSection = memo(function BacktestSection() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  useEffect(() => {
    fetch("/data/latest-backtest-snapshot.json")
      .then((r) => r.json())
      .then((d) => setSnapshot(d))
      .catch(() => {});
  }, []);

  const kpi = snapshot?.kpi;
  const baseline = {
    winRate: 60,
    totalReturn: 260,
    multiplier: 3.6,
    totalTrades: 420,
  };

  const stats = [
    {
      label: "Win Rate",
      value: kpi ? `${kpi.win_rate.toFixed(0)}%` : `${baseline.winRate}%`,
      sub: "Tỷ lệ tín hiệu chính xác",
      Icon: TrendingUp,
      color: "#16a34a",
      bg: "rgba(22,163,74,0.10)",
    },
    {
      label: "Lợi Nhuận",
      value: kpi ? `+${kpi.total_return.toFixed(0)}%` : `+${baseline.totalReturn}%`,
      sub: "Từ 2015 đến 2025",
      Icon: Zap,
      color: "#a855f7",
      bg: "rgba(168,85,247,0.10)",
    },
    {
      label: "Nhân Vốn",
      value: kpi ? `x${kpi.multiplier.toFixed(1)}` : `x${baseline.multiplier.toFixed(1)}`,
      sub: "Số lần nhân tài khoản (lãi kép)",
      Icon: Rocket,
      color: "#f59e0b",
      bg: "rgba(245,158,11,0.10)",
    },
    {
      label: "Tổng Lệnh",
      value: kpi ? `${kpi.total_trades}` : `${baseline.totalTrades}`,
      sub: "Tổng giao dịch backtest",
      Icon: BarChart3,
      color: "#f97316",
      bg: "rgba(249,115,22,0.10)",
    },
  ];
  return (
    <section className="relative py-16 overflow-hidden">
      {/* Background glow removed per ADN Design System (no blur effects) */}

      <div className="relative z-10 max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-10">
          <span className="text-[12px] font-bold uppercase tracking-[0.3em]" style={{ color: "var(--primary)" }}>
            Backtest Results
          </span>
          <h2 className="text-2xl sm:text-3xl font-black mt-2" style={{ color: "var(--text-primary)" }}>
            Hiệu suất{" "}
            <span style={{ color: "var(--primary)" }}>
              ADN CAPITAL
            </span>
          </h2>
          <p className="text-sm mt-2 max-w-lg mx-auto" style={{ color: "var(--text-secondary)" }}>
            Kết quả backtest dựa trên logic đầu tư của ADN Capital
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {stats.map((s) => (
            <div
              key={s.label}
              className="border rounded-xl p-4 text-center transition-colors"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div className="inline-flex p-2 rounded-lg mb-2" style={{ background: s.bg }}>
                <s.Icon className="w-4 h-4" style={{ color: s.color }} />
              </div>
              <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[12px] font-bold uppercase mt-1" style={{ color: "var(--text-secondary)" }}>
                {s.label}
              </p>
              <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Equity Curve Chart */}
        <div className="mb-8">
          <DynamicBacktestChart />
        </div>

        {/* Case Studies */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-4 h-4" style={{ color: "#f97316" }} />
            <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
              Case Studies điển hình
            </h3>
          </div>
          {BACKTEST_EVENTS.map((e, i) => {
            const isProtect = e.type === "protect";
            const accent = isProtect ? "cyan" : "emerald";
            const EventIcon = isProtect ? ShieldCheck : Rocket;
            return (
              <div
                key={i}
                className={`group relative rounded-2xl border p-5 transition-all duration-300`}
                style={{
                  background: "var(--surface)",
                  borderColor: isProtect ? "rgba(6,182,212,0.15)" : "rgba(46,77,61,0.15)",
                }}
              >
                {/* Gradient accent line */}
                <div
                  className={`absolute top-0 left-6 right-6 h-px bg-gradient-to-r ${
                    isProtect
                      ? "from-transparent via-cyan-500/40 to-transparent"
                      : "from-transparent via-emerald-500/40 to-transparent"
                  }`}
                />

                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Left: Icon + Period */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div
                      className="p-2.5 rounded-xl"
                      style={{ background: isProtect ? "rgba(6,182,212,0.10)" : "rgba(22,163,74,0.10)" }}
                    >
                      <EventIcon
                        className="w-5 h-5"
                        style={{ color: isProtect ? "#06b6d4" : "#16a34a" }}
                      />
                    </div>
                    <div>
                      <span
                        className="text-[12px] font-bold uppercase tracking-wider"
                        style={{ color: isProtect ? "#06b6d4" : "#16a34a" }}
                      >
                        {e.period}
                      </span>
                      <span
                        className="ml-2 text-[11px] font-bold px-2 py-0.5 rounded-full"
                        style={{
                          background: isProtect ? "rgba(6,182,212,0.10)" : "rgba(22,163,74,0.10)",
                          color: isProtect ? "#a5f3fc" : "#6ee7b7",
                        }}
                      >
                        {e.tag}
                      </span>
                    </div>
                  </div>

                  {/* Center: Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold leading-snug" style={{ color: "var(--text-primary)" }}>
                      {e.event}
                    </p>
                    <p className="text-xs leading-relaxed mt-1.5" style={{ color: "var(--text-secondary)" }}>
                      {e.result}
                    </p>
                  </div>

                  {/* Right: Saved Value */}
                  <div className="shrink-0 sm:text-right">
                    <p
                      className="text-2xl sm:text-3xl font-black"
                      style={{ color: isProtect ? "#06b6d4" : "#16a34a" }}
                    >
                      {e.saved}
                    </p>
                    <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                      {isProtect ? "Bảo vệ vốn" : "Lợi nhuận"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Disclaimer */}
        <p className="text-[11px] text-center mt-6" style={{ color: "var(--text-muted)" }}>
          * Kết quả backtest dựa trên dữ liệu lịch sử, không đảm bảo hiệu suất
          tương lai. Đầu tư luôn có rủi ro.
        </p>
        {snapshot?.generated_at && (
          <p className="text-[11px] text-center mt-1" style={{ color: "var(--text-muted)" }}>
            Dữ liệu được cập nhật tự động vào 00:00 ngày {snapshot.generated_at.split(" ")[0]}
          </p>
        )}
      </div>
    </section>
  );
});

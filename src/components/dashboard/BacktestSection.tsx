"use client";

import { memo, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { TrendingUp, Zap, BarChart3, Rocket, ShieldCheck, TrendingDown, Flame } from "lucide-react";

const DynamicBacktestChart = dynamic(
  () => import("@/components/dashboard/DynamicBacktestChart").then((m) => m.DynamicBacktestChart),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-4 sm:p-6">
        <div className="h-3 w-40 bg-neutral-800 rounded animate-pulse mb-4" />
        <div className="h-[360px] sm:h-[420px] bg-neutral-800/40 rounded-xl animate-pulse" />
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

  const stats = [
    {
      label: "Win Rate",
      value: kpi ? `${kpi.win_rate.toFixed(0)}%` : "—",
      sub: "Tỷ lệ tín hiệu chính xác",
      Icon: TrendingUp,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Lợi Nhuận",
      value: kpi ? `+${kpi.total_return.toFixed(0)}%` : "—",
      sub: "Từ 2015 đến 2025",
      Icon: Zap,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
    },
    {
      label: "Nhân Vốn",
      value: kpi ? `x${kpi.multiplier.toFixed(1)}` : "—",
      sub: "Số lần nhân tài khoản (lãi kép)",
      Icon: Rocket,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
    {
      label: "Tổng Lệnh",
      value: kpi ? `${kpi.total_trades}` : "—",
      sub: "Tổng giao dịch backtest",
      Icon: BarChart3,
      color: "text-orange-400",
      bg: "bg-orange-500/10",
    },
  ];
  return (
    <section className="relative py-16 overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-emerald-500/5 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-10">
          <span className="text-[12px] font-bold text-emerald-400 uppercase tracking-[0.3em]">
            Backtest Results
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white mt-2">
            Hiệu suất{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
              ADN CAPITAL
            </span>
          </h2>
          <p className="text-sm text-neutral-400 mt-2 max-w-lg mx-auto">
            Kết quả backtest dựa trên logic đầu tư của ADN Capital
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {stats.map((s) => (
            <div
              key={s.label}
              className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-4 text-center hover:border-neutral-700 transition-colors"
            >
              <div className={`inline-flex p-2 rounded-lg ${s.bg} mb-2`}>
                <s.Icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-[12px] font-bold text-neutral-400 uppercase mt-1">
                {s.label}
              </p>
              <p className="text-[12px] text-neutral-500 mt-0.5">{s.sub}</p>
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
            <Flame className="w-4 h-4 text-orange-400" />
            <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
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
                className={`group relative rounded-2xl border ${
                  isProtect ? "border-cyan-500/15" : "border-emerald-500/15"
                } bg-neutral-900/70 backdrop-blur-sm p-5 transition-all duration-300 hover:border-${accent}-500/30 hover:shadow-lg hover:shadow-${accent}-500/5`}
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
                      className={`p-2.5 rounded-xl ${
                        isProtect ? "bg-cyan-500/10" : "bg-emerald-500/10"
                      }`}
                    >
                      <EventIcon
                        className={`w-5 h-5 ${
                          isProtect ? "text-cyan-400" : "text-emerald-400"
                        }`}
                      />
                    </div>
                    <div>
                      <span
                        className={`text-[12px] font-bold uppercase tracking-wider ${
                          isProtect ? "text-cyan-400" : "text-emerald-400"
                        }`}
                      >
                        {e.period}
                      </span>
                      <span
                        className={`ml-2 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          isProtect
                            ? "bg-cyan-500/10 text-cyan-300"
                            : "bg-emerald-500/10 text-emerald-300"
                        }`}
                      >
                        {e.tag}
                      </span>
                    </div>
                  </div>

                  {/* Center: Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white leading-snug">
                      {e.event}
                    </p>
                    <p className="text-xs text-neutral-400 leading-relaxed mt-1.5">
                      {e.result}
                    </p>
                  </div>

                  {/* Right: Saved Value */}
                  <div className="shrink-0 sm:text-right">
                    <p
                      className={`text-2xl sm:text-3xl font-black ${
                        isProtect ? "text-cyan-400" : "text-emerald-400"
                      }`}
                    >
                      {e.saved}
                    </p>
                    <p className="text-[11px] font-medium text-neutral-500 uppercase tracking-wide">
                      {isProtect ? "Bảo vệ vốn" : "Lợi nhuận"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Disclaimer */}
        <p className="text-[11px] text-neutral-600 text-center mt-6">
          * Kết quả backtest dựa trên dữ liệu lịch sử, không đảm bảo hiệu suất
          tương lai. Đầu tư luôn có rủi ro.
        </p>
        {snapshot?.generated_at && (
          <p className="text-[11px] text-neutral-600 text-center mt-1">
            Dữ liệu được cập nhật tự động vào 00:00 ngày {snapshot.generated_at.split(" ")[0]}
          </p>
        )}
      </div>
    </section>
  );
});

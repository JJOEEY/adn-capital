"use client";

import { memo, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Flame, Rocket, ShieldCheck, TrendingDown, TrendingUp, Zap } from "lucide-react";
import { PRODUCT_NAMES } from "@/lib/brand/productNames";

const DynamicBacktestChart = dynamic(
  () => import("@/components/dashboard/DynamicBacktestChart").then((m) => m.DynamicBacktestChart),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border p-4 sm:p-6" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="mb-4 h-3 w-40 animate-pulse rounded" style={{ background: "var(--bg-hover)" }} />
        <div className="h-[360px] animate-pulse rounded-xl sm:h-[420px]" style={{ background: "var(--surface-2)" }} />
      </div>
    ),
  },
);

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
    event: "VN-Index đạt đỉnh 1.500 - hệ thống phát hiện phân phối",
    result:
      "EMA10 cắt xuống EMA30, MACD death cross -> bán sạch danh mục và chờ 10 phiên. Thị trường giảm mạnh sau đó, ADN Capital bảo toàn được phần lớn vốn.",
    saved: "+35%",
    tag: "Né đỉnh",
  },
  {
    period: "Q2/2022",
    type: "protect" as const,
    event: "Bear market - Cầu Dao Tổng kích hoạt ngay nhịp đầu",
    result:
      "VN30 gãy MA20 kèm volume spike -> chuyển phần lớn danh mục về tiền mặt. Tránh được nhịp sụt giảm sâu khi VN-Index rơi về vùng thấp.",
    saved: "+20%",
    tag: "Cầu Dao Tổng",
  },
  {
    period: "Q1/2025",
    type: "capture" as const,
    event: "SSI breakout - sóng tăng mạnh nhất năm",
    result:
      "Thị trường trên EMA50, tín hiệu ADN xác nhận và mùa vụ thuận lợi. Hệ thống tăng tỷ trọng theo kịch bản đã kiểm chứng, bắt được nhịp tăng lớn trong một quý.",
    saved: "+45%",
    tag: "Bắt sóng lớn",
  },
];

export const BacktestSection = memo(function BacktestSection() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  useEffect(() => {
    fetch("/data/latest-backtest-snapshot.json")
      .then((response) => response.json())
      .then((data) => setSnapshot(data))
      .catch(() => {});
  }, []);

  const kpi = snapshot?.kpi;
  const baseline = {
    winRate: 60,
    totalReturn: 260,
    multiplier: 3.6,
    maxDrawdown: 18,
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
      label: "Lợi nhuận",
      value: kpi ? `+${kpi.total_return.toFixed(0)}%` : `+${baseline.totalReturn}%`,
      sub: "Từ 2015 đến 2025",
      Icon: Zap,
      color: "#a855f7",
      bg: "rgba(168,85,247,0.10)",
    },
    {
      label: "Nhân vốn",
      value: kpi ? `x${kpi.multiplier.toFixed(1)}` : `x${baseline.multiplier.toFixed(1)}`,
      sub: "Số lần nhân tài khoản",
      Icon: Rocket,
      color: "#f59e0b",
      bg: "rgba(245,158,11,0.10)",
    },
    {
      label: "Max Drawdown",
      value: kpi ? `-${kpi.max_drawdown.toFixed(1)}%` : `-${baseline.maxDrawdown}%`,
      sub: "Mức sụt giảm lớn nhất",
      Icon: TrendingDown,
      color: "#f97316",
      bg: "rgba(249,115,22,0.10)",
    },
  ];

  return (
    <section className="relative overflow-hidden py-12">
      <div className="relative z-10 mx-auto max-w-6xl px-4">
        <div className="mb-10 text-center">
          <span className="text-[12px] font-bold uppercase tracking-[0.3em]" style={{ color: "var(--primary)" }}>
            {PRODUCT_NAMES.backtest}
          </span>
          <h2 className="mt-2 text-2xl font-black sm:text-3xl" style={{ color: "var(--text-primary)" }}>
            Hiệu suất <span style={{ color: "var(--primary)" }}>ADN Capital</span>
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm" style={{ color: "var(--text-secondary)" }}>
            Kết quả kiểm chứng dựa trên bộ quy tắc đầu tư của ADN Capital.
          </p>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          {stats.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border p-4 text-center transition-colors"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div className="mb-2 inline-flex rounded-lg p-2" style={{ background: item.bg }}>
                <item.Icon className="h-4 w-4" style={{ color: item.color }} />
              </div>
              <p className="text-2xl font-black" style={{ color: item.color }}>
                {item.value}
              </p>
              <p className="mt-1 text-[12px] font-bold uppercase" style={{ color: "var(--text-secondary)" }}>
                {item.label}
              </p>
              <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
                {item.sub}
              </p>
            </div>
          ))}
        </div>

        <div className="mb-8">
          <DynamicBacktestChart />
        </div>

        <div className="space-y-4">
          <div className="mb-4 flex items-center gap-2">
            <Flame className="h-4 w-4" style={{ color: "#f97316" }} />
            <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
              Case studies điển hình
            </h3>
          </div>
          {BACKTEST_EVENTS.map((event) => {
            const isProtect = event.type === "protect";
            const EventIcon = isProtect ? ShieldCheck : Rocket;
            return (
              <div
                key={`${event.period}-${event.tag}`}
                className="group relative rounded-2xl border p-5 transition-all duration-300"
                style={{
                  background: "var(--surface)",
                  borderColor: isProtect ? "rgba(6,182,212,0.15)" : "rgba(46,77,61,0.15)",
                }}
              >
                <div
                  className={`absolute left-6 right-6 top-0 h-px bg-gradient-to-r ${
                    isProtect
                      ? "from-transparent via-cyan-500/40 to-transparent"
                      : "from-transparent via-emerald-500/40 to-transparent"
                  }`}
                />

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex shrink-0 items-center gap-3">
                    <div
                      className="rounded-xl p-2.5"
                      style={{ background: isProtect ? "rgba(6,182,212,0.10)" : "rgba(22,163,74,0.10)" }}
                    >
                      <EventIcon className="h-5 w-5" style={{ color: isProtect ? "#06b6d4" : "#16a34a" }} />
                    </div>
                    <div>
                      <span
                        className="text-[12px] font-bold uppercase tracking-wider"
                        style={{ color: isProtect ? "#06b6d4" : "#16a34a" }}
                      >
                        {event.period}
                      </span>
                      <span
                        className="ml-2 rounded-full px-2 py-0.5 text-[11px] font-bold"
                        style={{
                          background: isProtect ? "rgba(6,182,212,0.10)" : "rgba(22,163,74,0.10)",
                          color: isProtect ? "#a5f3fc" : "#6ee7b7",
                        }}
                      >
                        {event.tag}
                      </span>
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold leading-snug" style={{ color: "var(--text-primary)" }}>
                      {event.event}
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {event.result}
                    </p>
                  </div>

                  <div className="shrink-0 sm:text-right">
                    <p className="text-2xl font-black sm:text-3xl" style={{ color: isProtect ? "#06b6d4" : "#16a34a" }}>
                      {event.saved}
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

        <p className="mt-6 text-center text-[11px]" style={{ color: "var(--text-muted)" }}>
          * Kết quả kiểm chứng dựa trên dữ liệu lịch sử, không bảo đảm hiệu suất tương lai. Đầu tư luôn có rủi ro.
        </p>
        {snapshot?.generated_at ? (
          <p className="mt-1 text-center text-[11px]" style={{ color: "var(--text-muted)" }}>
            Dữ liệu được cập nhật tự động vào {snapshot.generated_at}.
          </p>
        ) : null}
      </div>
    </section>
  );
});

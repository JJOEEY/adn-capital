"use client";

import { memo, useEffect, useState } from "react";
import {
  ResponsiveContainer,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Area,
  ComposedChart,
} from "recharts";
import { TrendingUp } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
 *  DynamicBacktestChart — So sánh ADN CAPITAL vs VN-INDEX
 *  Dữ liệu thực từ public/data/latest-backtest-snapshot.json
 * ═══════════════════════════════════════════════════════════════════════════ */

interface ChartPoint {
  date: string;
  adn: number;
  vnindex?: number;
}

interface Snapshot {
  generated_at: string;
  period: string;
  start_year: number;
  end_year: number;
  kpi: { total_return: number };
  chart_data: ChartPoint[];
  annotations?: {
    cb_on?: string;
    cb_off?: string;
    bear_label?: string;
  };
}

/* ── Custom Tooltip ─────────────────────────────────────────────────────── */
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-neutral-900/95 border border-neutral-700 rounded-xl px-4 py-3 shadow-xl backdrop-blur-sm">
      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
        {label}
      </p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: p.color }}
            />
            <span className="text-xs text-neutral-300">
              {p.dataKey === "adn" ? "ADN CAPITAL" : "VN-INDEX"}
            </span>
          </div>
          <span
            className="text-sm font-bold"
            style={{ color: p.color }}
          >
            {p.value > 100 ? "+" : ""}
            {(p.value - 100).toFixed(0)}%
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Custom Legend ──────────────────────────────────────────────────────── */
function ChartLegend() {
  return (
    <div className="flex items-center justify-center gap-6 mt-2">
      <div className="flex items-center gap-2">
        <span className="w-3 h-0.5 rounded-full bg-emerald-400" />
        <span className="text-[11px] font-bold text-emerald-400">ADN CAPITAL</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-3 h-0.5 rounded-full bg-neutral-500" />
        <span className="text-[11px] font-medium text-neutral-500">VN-INDEX</span>
      </div>
    </div>
  );
}

export const DynamicBacktestChart = memo(function DynamicBacktestChart() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  useEffect(() => {
    fetch("/data/latest-backtest-snapshot.json")
      .then((r) => r.json())
      .then((d) => setSnapshot(d))
      .catch(() => {});
  }, []);

  if (!snapshot) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-4 sm:p-6">
        <div className="h-3 w-40 bg-neutral-800 rounded animate-pulse mb-4" />
        <div className="h-[360px] sm:h-[420px] bg-neutral-800/40 rounded-xl animate-pulse" />
      </div>
    );
  }

  const chartData = snapshot.chart_data;
  const adnFinal = chartData[chartData.length - 1]?.adn ?? 100;
  const vniFinal = chartData[chartData.length - 1]?.vnindex;
  const adnReturn = `+${(adnFinal - 100).toFixed(0)}%`;
  const vniReturn = vniFinal ? `+${(vniFinal - 100).toFixed(0)}%` : null;

  // Tìm range Y hợp lý
  const allValues = chartData.flatMap((p) => {
    const vals = [p.adn];
    if (p.vnindex != null) vals.push(p.vnindex);
    return vals;
  });
  const minY = Math.floor(Math.min(...allValues) / 10) * 10 - 10;
  const maxY = Math.ceil(Math.max(...allValues) / 10) * 10 + 20;

  const periodLabel = `${snapshot.start_year} – ${snapshot.end_year}`;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/80 p-4 sm:p-6">
      {/* Glow */}
      <div className="absolute -top-16 -right-16 w-56 h-56 bg-emerald-500/5 rounded-full blur-3xl" />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">
              So sánh hiệu suất tích lũy
            </h3>
            <p className="text-[10px] text-neutral-500">
              {periodLabel} · Vốn ban đầu = 100%
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
            {adnReturn}
          </span>
          {vniReturn && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700 font-bold">
              {vniReturn}
            </span>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="h-[360px] sm:h-[420px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
          >
            <defs>
              <linearGradient id="adnGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34d399" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#262626"
              vertical={false}
            />

            <XAxis
              dataKey="date"
              tick={{ fill: "#525252", fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: "#262626" }}
              interval="preserveStartEnd"
            />

            <YAxis
              tick={{ fill: "#525252", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v > 100 ? "+" : ""}${v - 100}%`}
              domain={[minY, maxY]}
            />

            <Tooltip content={<ChartTooltip />} />

            {/* VN-INDEX line — rendered first (below) */}
            <Line
              type="monotone"
              dataKey="vnindex"
              stroke="#525252"
              strokeWidth={2}
              dot={false}
              name="VN-INDEX"
              connectNulls
            />

            {/* ADN CAPITAL area + line — rendered on top */}
            <Area
              type="monotone"
              dataKey="adn"
              stroke="transparent"
              fill="url(#adnGradient)"
            />
            <Line
              type="monotone"
              dataKey="adn"
              stroke="#34d399"
              strokeWidth={2.5}
              dot={false}
              name="ADN CAPITAL"
              activeDot={{
                r: 4,
                fill: "#34d399",
                stroke: "#064e3b",
                strokeWidth: 2,
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <ChartLegend />

      {/* Footnote */}
      <p className="text-[9px] text-neutral-600 text-center mt-3">
        * Dữ liệu backtest thực tế. Hiệu suất quá khứ không đảm bảo lợi nhuận tương lai.
        {snapshot.generated_at && ` Cập nhật: ${snapshot.generated_at}.`}
      </p>
    </div>
  );
});

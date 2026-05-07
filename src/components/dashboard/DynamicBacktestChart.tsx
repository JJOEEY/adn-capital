"use client";

import { memo, useEffect, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";

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
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-4 py-3 shadow-xl"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <p className="mb-2 text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      {payload.map((point) => (
        <div key={point.dataKey} className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: point.color }} />
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {point.dataKey === "adn" ? "ADN Capital" : "VN-INDEX"}
            </span>
          </div>
          <span className="text-sm font-bold" style={{ color: point.color }}>
            {point.value > 100 ? "+" : ""}
            {(point.value - 100).toFixed(0)}%
          </span>
        </div>
      ))}
    </div>
  );
}

function ChartLegend() {
  return (
    <div className="mt-2 flex items-center justify-center gap-6">
      <div className="flex items-center gap-2">
        <span className="h-0.5 w-3 rounded-full" style={{ background: "#16a34a" }} />
        <span className="text-[11px] font-bold" style={{ color: "#16a34a" }}>
          ADN Capital
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="h-0.5 w-3 rounded-full" style={{ background: "var(--text-muted)" }} />
        <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
          VN-INDEX
        </span>
      </div>
    </div>
  );
}

export const DynamicBacktestChart = memo(function DynamicBacktestChart() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  useEffect(() => {
    fetch("/data/latest-backtest-snapshot.json")
      .then((response) => response.json())
      .then((data) => setSnapshot(data))
      .catch(() => {});
  }, []);

  const chartData = snapshot?.chart_data ?? [];
  const bounds = useMemo(() => {
    if (!chartData.length) return { minY: 0, maxY: 200 };
    const values = chartData.flatMap((point) =>
      point.vnindex == null ? [point.adn] : [point.adn, point.vnindex],
    );
    return {
      minY: Math.floor(Math.min(...values) / 10) * 10 - 10,
      maxY: Math.ceil(Math.max(...values) / 10) * 10 + 20,
    };
  }, [chartData]);

  if (!snapshot) {
    return (
      <div
        className="rounded-2xl border p-4 sm:p-6"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="mb-4 h-3 w-40 animate-pulse rounded" style={{ background: "var(--bg-hover)" }} />
        <div className="h-[360px] animate-pulse rounded-xl sm:h-[420px]" style={{ background: "var(--surface-2)" }} />
      </div>
    );
  }

  const adnFinal = chartData[chartData.length - 1]?.adn ?? 100;
  const vniFinal = chartData[chartData.length - 1]?.vnindex;
  const adnReturn = `+${(adnFinal - 100).toFixed(0)}%`;
  const vniReturn = vniFinal ? `+${(vniFinal - 100).toFixed(0)}%` : null;
  const periodLabel = `${snapshot.start_year} - ${snapshot.end_year}`;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-4 sm:p-6"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="rounded-lg border p-1.5" style={{ background: "var(--primary-light)", borderColor: "var(--border)" }}>
            <TrendingUp className="h-4 w-4" style={{ color: "var(--primary)" }} />
          </div>
          <div>
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              So sánh hiệu suất tích lũy
            </h3>
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
              {periodLabel} · Vốn ban đầu = 100%
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="rounded-full border px-2 py-0.5 text-[12px] font-bold"
            style={{ background: "var(--primary-light)", color: "var(--primary)", borderColor: "var(--border)" }}
          >
            {adnReturn}
          </span>
          {vniReturn ? (
            <span
              className="rounded-full border px-2 py-0.5 text-[12px] font-bold"
              style={{ background: "var(--surface-2)", color: "var(--text-muted)", borderColor: "var(--border)" }}
            >
              {vniReturn}
            </span>
          ) : null}
        </div>
      </div>

      <div className="h-[360px] sm:h-[420px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="adnGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34d399" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: "var(--text-muted)", fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: "var(--text-muted)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value: number) => `${value > 100 ? "+" : ""}${value - 100}%`}
              domain={[bounds.minY, bounds.maxY]}
            />
            <Tooltip content={<ChartTooltip />} />
            <Line type="monotone" dataKey="vnindex" stroke="#525252" strokeWidth={2} dot={false} name="VN-INDEX" connectNulls />
            <Area type="monotone" dataKey="adn" stroke="transparent" fill="url(#adnGradient)" />
            <Line
              type="monotone"
              dataKey="adn"
              stroke="#34d399"
              strokeWidth={2.5}
              dot={false}
              name="ADN Capital"
              activeDot={{ r: 4, fill: "#34d399", stroke: "#064e3b", strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <ChartLegend />

      <p className="mt-3 text-center text-[11px]" style={{ color: "var(--text-muted)" }}>
        * Dữ liệu backtest lịch sử. Hiệu suất quá khứ không bảo đảm lợi nhuận tương lai.
        {snapshot.generated_at ? ` Cập nhật: ${snapshot.generated_at}.` : ""}
      </p>
    </div>
  );
});

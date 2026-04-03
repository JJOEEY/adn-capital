"use client";

import { memo, useMemo, useState, useCallback } from "react";
import useSWR from "swr";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import { RefreshCw, Calendar, Info } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
 *  RPILightChart — White-theme RPI indicator for formula-test page
 *  Uses real-time data from /api/rpi (FiinQuant backend)
 * ═══════════════════════════════════════════════════════════════════════════ */

interface RPIData {
  rpi: number;
  rpi_ma7: number;
  classification: string;
  color: "red" | "yellow" | "green";
  components: Record<string, { score: number; weight: number }>;
  thresholds: {
    risk_reversal_down: number;
    neutral_min: number;
    neutral_max: number;
    opportunity_reversal_up: number;
  };
  history: { date: string; rpi: number; ma7: number | null }[];
  updated_at: string;
}

interface ChartPoint {
  date: string;
  dateFormatted: string;
  rpi: number;
  ma7: number | null;
}

const fetcher = (url: string) =>
  fetch(url, { signal: AbortSignal.timeout(30_000) }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

/* ── Helper: Phân loại RPI ─────────────────────────────────────────────── */
function classifyRPI(v: number): {
  label: string;
  labelColor: string;
} {
  if (v >= 4.0) return { label: "RỦI RO CAO", labelColor: "#EF4444" };
  if (v >= 2.5) return { label: "TRUNG TÍNH", labelColor: "#EAB308" };
  if (v >= 1.0) return { label: "CƠ HỘI TĂNG", labelColor: "#22C55E" };
  return { label: "CƠ HỘI MẠNH", labelColor: "#16A34A" };
}

/* ── Gauge SVG (Semicircle 0–5, gradient) ──────────────────────────────── */
function GaugeSVG({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(5, value));
  // Semicircle: angles from π (left) to 0 (right)
  const cx = 150,
    cy = 140,
    r = 110;
  const strokeW = 22;

  // 6 color segments matching the spec
  const segments = [
    { from: 0, to: 1, color: "#16A34A" },
    { from: 1, to: 2, color: "#4ADE80" },
    { from: 2, to: 2.5, color: "#A3E635" },
    { from: 2.5, to: 3, color: "#EAB308" },
    { from: 3, to: 4, color: "#F97316" },
    { from: 4, to: 5, color: "#EF4444" },
  ];

  function arcPath(startVal: number, endVal: number) {
    // Map 0→5 to π→0 (left to right semicircle)
    const startAngle = Math.PI - (startVal / 5) * Math.PI;
    const endAngle = Math.PI - (endVal / 5) * Math.PI;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy - r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy - r * Math.sin(endAngle);
    const largeArc = Math.abs(startAngle - endAngle) > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 0 ${x2} ${y2}`;
  }

  // Needle
  const needleAngle = Math.PI - (clamped / 5) * Math.PI;
  const needleLen = r - 30;
  const nx = cx + needleLen * Math.cos(needleAngle);
  const ny = cy - needleLen * Math.sin(needleAngle);

  // Tick marks 0–5
  const ticks = [0, 1, 2, 3, 4, 5];

  return (
    <svg viewBox="0 0 300 170" className="w-full max-w-[320px] mx-auto">
      {/* Arc segments */}
      {segments.map((seg, i) => (
        <path
          key={i}
          d={arcPath(seg.from, seg.to)}
          fill="none"
          stroke={seg.color}
          strokeWidth={strokeW}
          strokeLinecap="butt"
        />
      ))}

      {/* Tick labels */}
      {ticks.map((t) => {
        const a = Math.PI - (t / 5) * Math.PI;
        const lx = cx + (r + 20) * Math.cos(a);
        const ly = cy - (r + 20) * Math.sin(a);
        return (
          <text
            key={t}
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#6B7280"
            fontSize="13"
            fontWeight="700"
            fontFamily="Inter, system-ui, sans-serif"
          >
            {t}
          </text>
        );
      })}

      {/* Needle */}
      <line
        x1={cx}
        y1={cy}
        x2={nx}
        y2={ny}
        stroke="#000000"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r="7" fill="#000000" />
      <circle cx={cx} cy={cy} r="3" fill="#FFFFFF" />
    </svg>
  );
}

/* ── Custom tooltip for Recharts ───────────────────────────────────────── */
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const rpiVal = payload.find((p) => p.dataKey === "rpi");
  const ma7Val = payload.find((p) => p.dataKey === "ma7");

  return (
    <div className="bg-[#1F2937] text-white px-4 py-3 rounded-lg shadow-xl border border-gray-600 text-sm">
      <p className="font-bold mb-1.5">{label}</p>
      {rpiVal && (
        <div className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 bg-black border border-gray-400 rounded-sm" />
          <span>RPI: <b>{rpiVal.value.toFixed(2)}</b></span>
        </div>
      )}
      {ma7Val && ma7Val.value != null && (
        <div className="flex items-center gap-2 mt-0.5">
          <span className="inline-block w-2.5 h-2.5 bg-[#F59E0B] rounded-sm" />
          <span>Trung Bình (MA7): <b>{ma7Val.value.toFixed(2)}</b></span>
        </div>
      )}
    </div>
  );
}

/* ── Custom dot for RPI line ───────────────────────────────────────────── */
function RPIDot(props: { cx?: number; cy?: number; index?: number }) {
  const { cx, cy } = props;
  if (cx == null || cy == null) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill="#000000"
      stroke="#000000"
      strokeWidth={1}
    />
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 *  MAIN COMPONENT
 * ══════════════════════════════════════════════════════════════════════════ */
export const RPILightChart = memo(function RPILightChart() {
  const { data, isLoading, error, mutate } = useSWR<RPIData>("/api/rpi", fetcher, {
    keepPreviousData: true,
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
    refreshInterval: 300_000,
    shouldRetryOnError: false,
  });

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await mutate();
    setRefreshing(false);
  }, [mutate]);

  // Process chart data
  const chartData: ChartPoint[] = useMemo(() => {
    if (!data?.history) return [];
    return data.history.map((h) => {
      // Input date format: DD/MM/YYYY → reformat to DD.MM.YYYY
      const parts = h.date.includes("/") ? h.date.split("/") : h.date.split(".");
      const formatted =
        parts.length === 3 ? `${parts[0]}.${parts[1]}.${parts[2]}` : h.date;
      return {
        date: h.date,
        dateFormatted: formatted,
        rpi: h.rpi,
        ma7: h.ma7,
      };
    });
  }, [data]);

  const currentRPI = data?.rpi ?? 0;
  const currentMA7 = data?.rpi_ma7 ?? 0;
  const classification = classifyRPI(currentRPI);

  // Date range
  const dateRange = useMemo(() => {
    if (chartData.length < 2) return "";
    return `${chartData[0].dateFormatted} – ${chartData[chartData.length - 1].dateFormatted}`;
  }, [chartData]);

  // Updated date
  const updatedDate = useMemo(() => {
    if (!data?.updated_at) return "";
    try {
      const d = new Date(data.updated_at);
      return d.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return data.updated_at;
    }
  }, [data]);

  /* Loading skeleton */
  if (isLoading && !data) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 animate-pulse">
        <div className="h-8 w-64 bg-gray-200 rounded mb-4" />
        <div className="grid md:grid-cols-2 gap-8">
          <div className="h-48 bg-gray-100 rounded-xl" />
          <div className="h-48 bg-gray-100 rounded-xl" />
        </div>
        <div className="h-64 bg-gray-100 rounded-xl mt-6" />
      </div>
    );
  }

  /* Error state */
  if (error && !data) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
        <div className="text-red-500 text-lg font-bold mb-2">
          Không tải được dữ liệu RPI
        </div>
        <p className="text-gray-500 text-sm mb-4">
          Kiểm tra FiinQuant Bridge đang chạy
        </p>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
        >
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* ═══ HEADER ═══ */}
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight">
              CHỈ BÁO ĐIỂM ĐẢO CHIỀU{" "}
              <span className="text-gray-500 font-normal text-base">
                (Reverse Point Index – RPI)
              </span>
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Đo lường rủi ro và cơ hội xuất hiện điểm đảo chiều trên VN30 Index
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-all disabled:opacity-50"
            title="Làm mới dữ liệu"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* ═══ GAUGE + CLASSIFICATION ═══ */}
      <div className="px-6 py-6">
        <div className="grid md:grid-cols-[1fr_1fr] gap-6 items-center">
          {/* Left: Gauge */}
          <div className="flex flex-col items-center">
            <GaugeSVG value={currentRPI} />
            <div className="text-center -mt-2">
              <p className="text-4xl font-black text-gray-900 tabular-nums">
                {currentRPI.toFixed(2)}{" "}
                <span className="text-lg font-bold text-gray-500">ĐIỂM</span>
              </p>
              <p
                className="text-xl font-black mt-1"
                style={{ color: classification.labelColor }}
              >
                {classification.label}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Cập nhật: {updatedDate}
              </p>
              <p className="text-[11px] text-gray-400 italic mt-0.5">
                (*) Dữ liệu cập nhật từ VN30 Index
              </p>
            </div>
          </div>

          {/* Right: Classification badges + info */}
          <div className="space-y-5">
            {/* 3 threshold badges */}
            <div className="space-y-3">
              {[
                {
                  text: "Rủi ro đảo chiều giảm (trên 4)",
                  value: "4.0",
                  bg: "#EF4444",
                },
                {
                  text: "Trung tính",
                  value: "2.5",
                  bg: "#EAB308",
                },
                {
                  text: "Cơ hội đảo chiều tăng (dưới 1)",
                  value: "1.0",
                  bg: "#22C55E",
                },
              ].map((item) => (
                <div
                  key={item.value}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm text-gray-700">{item.text}</span>
                  <span
                    className="inline-flex items-center justify-center w-9 h-9 rounded-full text-white text-sm font-bold shadow-sm"
                    style={{ backgroundColor: item.bg }}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
            </div>

            {/* MA7 value */}
            <div className="pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Trung bình MA7:</span>
                <span className="font-bold text-gray-900 tabular-nums">
                  {currentMA7.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Info button */}
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors">
              <Info className="w-4 h-4" />
              Tìm hiểu thêm
            </button>
          </div>
        </div>
      </div>

      {/* ═══ CHART SECTION ═══ */}
      <div className="px-6 pb-6">
        <div className="border-t border-gray-100 pt-6">
          {/* Chart header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div>
              <h3 className="text-lg font-black text-gray-900">
                DỮ LIỆU LỊCH SỬ
              </h3>
              <div className="flex items-center gap-4 mt-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 bg-black rounded-sm" />
                  <span className="text-xs text-gray-600">RPI</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 bg-[#F59E0B] rounded-sm" />
                  <span className="text-xs text-gray-600">Trung Bình MA7</span>
                </div>
              </div>
            </div>
            {dateRange && (
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Calendar className="w-3.5 h-3.5" />
                {dateRange}
              </div>
            )}
          </div>

          {/* Recharts chart */}
          {chartData.length > 1 ? (
            <div className="h-[340px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 60 }}
                >
                  <defs>
                    <linearGradient id="ma7Fill" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="#F59E0B"
                        stopOpacity={0.15}
                      />
                      <stop
                        offset="95%"
                        stopColor="#F59E0B"
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>

                  {/* Background zones */}
                  <ReferenceArea
                    y1={4.0}
                    y2={5.0}
                    fill="rgba(239, 68, 68, 0.06)"
                    strokeOpacity={0}
                  />
                  <ReferenceArea
                    y1={1.0}
                    y2={4.0}
                    fill="rgba(245, 158, 11, 0.04)"
                    strokeOpacity={0}
                  />
                  <ReferenceArea
                    y1={0}
                    y2={1.0}
                    fill="rgba(34, 197, 94, 0.06)"
                    strokeOpacity={0}
                  />

                  <CartesianGrid
                    stroke="#E5E7EB"
                    strokeDasharray="3 3"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="dateFormatted"
                    tick={{ fontSize: 10, fill: "#6B7280" }}
                    angle={-50}
                    textAnchor="end"
                    height={60}
                    interval={0}
                    tickLine={{ stroke: "#D1D5DB" }}
                    axisLine={{ stroke: "#D1D5DB" }}
                  />

                  <YAxis
                    domain={[0, 5]}
                    ticks={[0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0]}
                    tick={{ fontSize: 11, fill: "#6B7280" }}
                    tickFormatter={(v: number) => v.toFixed(1)}
                    axisLine={{ stroke: "#D1D5DB" }}
                    tickLine={{ stroke: "#D1D5DB" }}
                    width={35}
                  />

                  {/* Threshold reference lines */}
                  <ReferenceLine
                    y={4.0}
                    stroke="#EF4444"
                    strokeDasharray="6 3"
                    strokeOpacity={0.5}
                  />
                  <ReferenceLine
                    y={1.0}
                    stroke="#22C55E"
                    strokeDasharray="6 3"
                    strokeOpacity={0.5}
                  />

                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ stroke: "#D1D5DB", strokeDasharray: "4 4" }}
                  />

                  {/* MA7 area + line */}
                  <Area
                    type="monotone"
                    dataKey="ma7"
                    fill="url(#ma7Fill)"
                    stroke="#F59E0B"
                    strokeWidth={2.5}
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                  />

                  {/* RPI line with dots */}
                  <Line
                    type="monotone"
                    dataKey="rpi"
                    stroke="#000000"
                    strokeWidth={2}
                    dot={<RPIDot />}
                    activeDot={{ r: 6, fill: "#000", stroke: "#000" }}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              Không đủ dữ liệu lịch sử
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

/* ── Skeleton loader ───────────────────────────────────────────────────── */
export function RPILightSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-8 animate-pulse">
      <div className="h-6 w-72 bg-gray-200 rounded mb-6" />
      <div className="grid md:grid-cols-2 gap-8">
        <div className="h-52 bg-gray-100 rounded-xl" />
        <div className="space-y-4">
          <div className="h-10 bg-gray-100 rounded-lg" />
          <div className="h-10 bg-gray-100 rounded-lg" />
          <div className="h-10 bg-gray-100 rounded-lg" />
        </div>
      </div>
      <div className="h-64 bg-gray-100 rounded-xl mt-6" />
    </div>
  );
}

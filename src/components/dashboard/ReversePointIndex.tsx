"use client";

import { memo, useMemo } from "react";
import useSWR from "swr";

/* ═══════════════════════════════════════════════════════════════════════════
 *  ReversePointIndex — Chỉ báo Điểm Đảo Chiều (RPI) cho VN30
 *  Thay thế cho LeaderRadar card trên Dashboard
 * ═══════════════════════════════════════════════════════════════════════════ */

interface RPIData {
  rpi: number;
  rpi_ma7: number;
  classification: string;
  color: "red" | "yellow" | "green";
  components: {
    rsi: { score: number; weight: number; raw_rsi: number | null };
    bollinger: { score: number; weight: number };
    macd: { score: number; weight: number };
    stochastic: { score: number; weight: number };
    volume_divergence: { score: number; weight: number };
  };
  thresholds: {
    risk_reversal_down: number;
    neutral_min: number;
    neutral_max: number;
    opportunity_reversal_up: number;
  };
  history: { date: string; rpi: number; ma7: number | null }[];
  updated_at: string;
}

const fetcher = (url: string) =>
  fetch(url, { signal: AbortSignal.timeout(15_000) }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

/* ── Speedometer Gauge SVG ─────────────────────────────────────────────── */
function GaugeSVG({ value }: { value: number }) {
  // value 0-5, map to angle -135 to 135 (270 degree arc)
  const clampedValue = Math.max(0, Math.min(5, value));
  const angle = -135 + (clampedValue / 5) * 270;

  // Arc segments: 6 zones (0→1, 1→2, 2→3, 3→4, 4→5)
  const segments = [
    { from: 0, to: 1, color: "#22c55e" },   // green
    { from: 1, to: 2, color: "#86efac" },   // light green
    { from: 2, to: 3, color: "#fbbf24" },   // yellow/amber
    { from: 3, to: 4, color: "#f97316" },   // orange
    { from: 4, to: 5, color: "#ef4444" },   // red
  ];

  const cx = 100, cy = 100, r = 75;

  function arcPath(startVal: number, endVal: number) {
    const startAngle = ((-135 + (startVal / 5) * 270) * Math.PI) / 180;
    const endAngle = ((-135 + (endVal / 5) * 270) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  }

  // Needle
  const needleAngle = (angle * Math.PI) / 180;
  const needleLen = 58;
  const nx = cx + needleLen * Math.cos(needleAngle);
  const ny = cy + needleLen * Math.sin(needleAngle);

  // Tick labels (0-5)
  const ticks = [0, 1, 2, 3, 4, 5];

  return (
    <svg viewBox="0 0 200 130" className="w-full max-w-[220px]">
      {/* Arc segments */}
      {segments.map((seg, i) => (
        <path
          key={i}
          d={arcPath(seg.from, seg.to)}
          fill="none"
          stroke={seg.color}
          strokeWidth="14"
          strokeLinecap="butt"
          opacity={0.85}
        />
      ))}

      {/* Tick labels */}
      {ticks.map((t) => {
        const a = ((-135 + (t / 5) * 270) * Math.PI) / 180;
        const lx = cx + (r + 16) * Math.cos(a);
        const ly = cy + (r + 16) * Math.sin(a);
        return (
          <text
            key={t}
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-neutral-400"
            fontSize="10"
            fontWeight="600"
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
        stroke="#e2e8f0"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r="5" fill="#334155" stroke="#e2e8f0" strokeWidth="2" />
    </svg>
  );
}

/* ── Mini Line Chart ───────────────────────────────────────────────────── */
function RPIChart({ history }: { history: RPIData["history"] }) {
  const width = 600;
  const height = 200;
  const padding = { top: 15, right: 15, bottom: 55, left: 30 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  if (history.length < 2) return null;

  const yMin = 0;
  const yMax = 5;

  const xScale = (i: number) => padding.left + (i / (history.length - 1)) * chartW;
  const yScale = (v: number) => padding.top + chartH - ((v - yMin) / (yMax - yMin)) * chartH;

  // RPI line
  const rpiPoints = history.map((d, i) => `${xScale(i)},${yScale(d.rpi)}`).join(" ");
  // MA7 line (skip nulls at start)
  const ma7Points = history
    .map((d, i) => (d.ma7 != null ? `${xScale(i)},${yScale(d.ma7)}` : null))
    .filter(Boolean)
    .join(" ");

  // Yellow band (1.0 - 4.0 = neutral zone)
  const y4 = yScale(4.0);
  const y1 = yScale(1.0);

  // Grid lines
  const gridY = [0, 1.0, 2.0, 3.0, 4.0, 5.0];

  // Date labels (show ~8-10 labels, shorter format dd/mm)
  const step = Math.max(1, Math.floor(history.length / 9));
  const dateLabels = history.filter((_, i) => i % step === 0 || i === history.length - 1);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {/* Neutral zone band */}
      <rect
        x={padding.left}
        y={y4}
        width={chartW}
        height={y1 - y4}
        fill="#fbbf24"
        opacity={0.08}
      />

      {/* Grid lines */}
      {gridY.map((v) => (
        <g key={v}>
          <line
            x1={padding.left}
            y1={yScale(v)}
            x2={padding.left + chartW}
            y2={yScale(v)}
            stroke="#374151"
            strokeWidth="0.5"
            strokeDasharray={v === 1.0 || v === 4.0 ? "4,3" : "2,4"}
            opacity={v === 1.0 || v === 4.0 ? 0.6 : 0.3}
          />
          <text
            x={padding.left - 6}
            y={yScale(v)}
            textAnchor="end"
            dominantBaseline="central"
            className="fill-neutral-500"
            fontSize="9"
          >
            {v.toFixed(1)}
          </text>
        </g>
      ))}

      {/* MA7 line */}
      {ma7Points && (
        <polyline
          points={ma7Points}
          fill="none"
          stroke="#fbbf24"
          strokeWidth="2"
          opacity={0.9}
        />
      )}

      {/* RPI line */}
      <polyline
        points={rpiPoints}
        fill="none"
        stroke="#1f2937"
        strokeWidth="2.5"
      />

      {/* RPI dots */}
      {history.map((d, i) => (
        <circle
          key={i}
          cx={xScale(i)}
          cy={yScale(d.rpi)}
          r="3"
          fill="#1f2937"
          stroke="#e5e7eb"
          strokeWidth="1"
        />
      ))}

      {/* Date labels */}
      {dateLabels.map((d) => {
        const idx = history.indexOf(d);
        return (
          <text
            key={idx}
            x={xScale(idx)}
            y={height - 8}
            textAnchor="end"
            className="fill-neutral-500"
            fontSize="9"
            transform={`rotate(-45, ${xScale(idx)}, ${height - 8})`}
          >
            {d.date.replace(/\/\d{4}$/, "")}
          </text>
        );
      })}
    </svg>
  );
}

/* ── Component Badge ───────────────────────────────────────────────────── */
function ComponentBadge({ label, score, weight }: { label: string; score: number; weight: number }) {
  const barWidth = (score / 5) * 100;
  const bgColor =
    score > 3.5 ? "bg-red-500" : score > 2.5 ? "bg-amber-500" : score > 1.5 ? "bg-yellow-500" : "bg-emerald-500";

  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="text-neutral-400 w-[90px] shrink-0 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${bgColor}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <span className="text-neutral-300 font-mono w-8 text-right">{score.toFixed(1)}</span>
      <span className="text-neutral-600 w-8 text-right">{(weight * 100).toFixed(0)}%</span>
    </div>
  );
}

/* ── Main RPI Component ────────────────────────────────────────────────── */
export const ReversePointIndex = memo(function ReversePointIndex() {
  const { data, isLoading } = useSWR<RPIData>("/api/rpi", fetcher, {
    keepPreviousData: true,
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
    refreshInterval: 300_000, // 5 phút
    shouldRetryOnError: false,
  });

  const classificationConfig = useMemo(() => {
    if (!data) return null;
    if (data.color === "red")
      return {
        border: "border-red-500/40",
        shadow: "shadow-[0_0_30px_-8px_rgba(239,68,68,0.4)]",
        glow: "bg-red-500/20",
        text: "text-red-400",
        badge: "bg-red-500/10 text-red-400 border-red-500/30",
      };
    if (data.color === "green")
      return {
        border: "border-emerald-500/30",
        shadow: "shadow-[0_0_30px_-8px_rgba(16,185,129,0.4)]",
        glow: "bg-emerald-500/20",
        text: "text-emerald-400",
        badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
      };
    return {
      border: "border-amber-500/30",
      shadow: "shadow-[0_0_30px_-8px_rgba(245,158,11,0.3)]",
      glow: "bg-amber-500/15",
      text: "text-amber-400",
      badge: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    };
  }, [data]);

  if (isLoading || !data || !classificationConfig) return <RPISkeleton />;

  const cfg = classificationConfig;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-neutral-900/90 border transition-all duration-500 ${cfg.border} ${cfg.shadow}`}
    >
      {/* Glow background */}
      <div className={`absolute -top-12 -left-12 w-48 h-48 rounded-full blur-3xl opacity-25 ${cfg.glow}`} />

      <div className="relative z-10 p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
              Chỉ báo Điểm Đảo Chiều (RPI)
            </span>
            <span className="text-[9px] text-neutral-600 bg-neutral-800 px-1.5 py-0.5 rounded">VN30</span>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.badge}`}>
            {data.classification}
          </span>
        </div>

        <p className="text-[10px] text-neutral-500 mb-3">
          Đo lường rủi ro và cơ hội xuất hiện điểm đảo chiều theo diễn biến thị trường
        </p>

        {/* Main content: Gauge + Thresholds */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-4">
          {/* Gauge */}
          <div className="flex flex-col items-center shrink-0">
            <GaugeSVG value={data.rpi} />
            <div className="text-center -mt-1">
              <span className={`text-xl font-black ${cfg.text}`}>{data.rpi.toFixed(2)}</span>
              <span className="text-[10px] text-neutral-400 ml-1">ĐIỂM</span>
            </div>
            <p className={`text-xs font-bold uppercase ${cfg.text} mt-0.5`}>{data.classification}</p>
            <p className="text-[10px] text-neutral-500 mt-0.5">
              Cập nhật: {data.updated_at}
            </p>
          </div>

          {/* Threshold badges */}
          <div className="flex-1 space-y-2 w-full">
            <div className="flex items-center justify-between bg-neutral-800/50 rounded-lg px-3 py-2">
              <span className="text-[11px] text-neutral-300">Rủi ro đảo chiều giảm (trên 4)</span>
              <span className="text-sm font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                4.0
              </span>
            </div>
            <div className="flex items-center justify-between bg-neutral-800/50 rounded-lg px-3 py-2">
              <span className="text-[11px] text-neutral-300">Trung tính</span>
              <span className="text-sm font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                2.5
              </span>
            </div>
            <div className="flex items-center justify-between bg-neutral-800/50 rounded-lg px-3 py-2">
              <span className="text-[11px] text-neutral-300">Cơ hội đảo chiều tăng (dưới 1)</span>
              <span className="text-sm font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                1.0
              </span>
            </div>
          </div>
        </div>

        {/* Historical chart */}
        {data.history.length > 2 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                Dữ liệu lịch sử
              </p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-0.5 bg-neutral-600 rounded-full" />
                  <span className="text-[9px] text-neutral-500">RPI</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-0.5 bg-amber-500 rounded-full" />
                  <span className="text-[9px] text-neutral-500">Trung Bình MA7</span>
                </div>
                <span className="text-[9px] text-neutral-600">
                  {data.history[0]?.date} - {data.history[data.history.length - 1]?.date}
                </span>
              </div>
            </div>
            <div className="bg-neutral-800/30 rounded-lg p-2">
              <RPIChart history={data.history} />
            </div>
          </div>
        )}

        {/* Footer with MA7 */}
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-neutral-800">
          <span className="text-[10px] text-neutral-500">
            RPI MA7: <span className={`font-bold ${cfg.text}`}>{data.rpi_ma7.toFixed(2)}</span>
          </span>
          {data.components.rsi.raw_rsi != null && (
            <span className="text-[10px] text-neutral-500">
              RSI(14): <span className="text-neutral-300 font-mono">{data.components.rsi.raw_rsi.toFixed(1)}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

/* ── Skeleton ──────────────────────────────────────────────────────────── */
function RPISkeleton() {
  return (
    <div className="rounded-2xl bg-neutral-900/90 border border-neutral-700/30 p-5 animate-pulse">
      <div className="h-4 bg-neutral-800 rounded w-48 mb-3" />
      <div className="flex gap-4">
        <div className="w-[220px] h-[130px] bg-neutral-800 rounded-lg" />
        <div className="flex-1 space-y-3">
          <div className="h-10 bg-neutral-800 rounded-lg" />
          <div className="h-10 bg-neutral-800 rounded-lg" />
          <div className="h-10 bg-neutral-800 rounded-lg" />
        </div>
      </div>
      <div className="h-[180px] bg-neutral-800 rounded-lg mt-4" />
    </div>
  );
}

export { RPISkeleton };

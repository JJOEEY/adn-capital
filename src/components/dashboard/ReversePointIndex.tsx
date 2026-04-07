"use client";

import { memo, useMemo } from "react";
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
import { calculateRPI, getLatestRPI, type OHLCVData } from "@/lib/rpi/calculator";

/* ═══════════════════════════════════════════════════════════════════════════
 *  ReversePointIndex — Chỉ báo Cạn Kiệt Xu Hướng (TEI) cho VN30
 *  Dashboard widget — matches /tei page visual style
 * ═══════════════════════════════════════════════════════════════════════════ */

const fetcher = (url: string) =>
  fetch(url, { signal: AbortSignal.timeout(60_000) }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

/* ── Classify TEI ──────────────────────────────────────────────────────── */
function classifyTEI(v: number) {
  if (v >= 4.0) return { label: "CẠN KIỆT XU HƯỚNG TĂNG", color: "#EF4444" };
  if (v <= 1.0) return { label: "CẠN KIỆT XU HƯỚNG GIẢM", color: "#22C55E" };
  return { label: "TRUNG TÍNH", color: "#EAB308" };
}

function getColorConfig(color: string) {
  if (color === "#EF4444")
    return {
      border: "border-red-500/40",
      shadow: "shadow-[0_0_30px_-8px_rgba(239,68,68,0.4)]",
      glow: "bg-red-500/20",
      text: "text-red-400",
      badge: "bg-red-500/10 text-red-400 border-red-500/30",
    };
  if (color === "#22C55E")
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
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  GAUGE SVG — 60-segment smooth gradient (same as /tei page)
 * ═══════════════════════════════════════════════════════════════════════════ */
const TEI_COLORS: [number, [number, number, number]][] = [
  [0.0, [22, 163, 74]],
  [0.2, [74, 222, 128]],
  [0.35, [163, 230, 53]],
  [0.5, [234, 179, 8]],
  [0.7, [249, 115, 22]],
  [0.85, [239, 68, 68]],
  [1.0, [220, 38, 38]],
];

function interpolateColor(t: number, stops: [number, [number, number, number]][]): string {
  const clamped = Math.max(0, Math.min(1, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (clamped >= t0 && clamped <= t1) {
      const f = (clamped - t0) / (t1 - t0);
      const r = Math.round(c0[0] + (c1[0] - c0[0]) * f);
      const g = Math.round(c0[1] + (c1[1] - c0[1]) * f);
      const b = Math.round(c0[2] + (c1[2] - c0[2]) * f);
      return `rgb(${r},${g},${b})`;
    }
  }
  const last = stops[stops.length - 1][1];
  return `rgb(${last[0]},${last[1]},${last[2]})`;
}

const GAUGE_SEGMENTS = 60;

function GaugeSVG({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(5, value));
  const cx = 150, cy = 140, r = 110;
  const strokeW = 22;

  const arcs = useMemo(() => {
    const result: { d: string; color: string }[] = [];
    for (let i = 0; i < GAUGE_SEGMENTS; i++) {
      const startFrac = i / GAUGE_SEGMENTS;
      const endFrac = (i + 1) / GAUGE_SEGMENTS;
      const startAngle = Math.PI - startFrac * Math.PI;
      const endAngle = Math.PI - endFrac * Math.PI;
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy - r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy - r * Math.sin(endAngle);
      const midFrac = (startFrac + endFrac) / 2;
      result.push({
        d: `M ${x1} ${y1} A ${r} ${r} 0 0 0 ${x2} ${y2}`,
        color: interpolateColor(midFrac, TEI_COLORS),
      });
    }
    return result;
  }, []);

  const needleAngle = Math.PI - (clamped / 5) * Math.PI;
  const needleLen = r - 30;
  const nx = cx + needleLen * Math.cos(needleAngle);
  const ny = cy - needleLen * Math.sin(needleAngle);

  const ticks = [0, 1, 2, 3, 4, 5];

  return (
    <svg viewBox="0 0 300 170" className="w-full max-w-[260px] mx-auto">
      {arcs.map((seg, i) => (
        <path key={i} d={seg.d} fill="none" stroke={seg.color} strokeWidth={strokeW}
          strokeLinecap={i === 0 || i === GAUGE_SEGMENTS - 1 ? "round" : "butt"} />
      ))}
      {ticks.map((t) => {
        const a = Math.PI - (t / 5) * Math.PI;
        const lx = cx + (r + 20) * Math.cos(a);
        const ly = cy - (r + 20) * Math.sin(a);
        return (
          <text key={t} x={lx} y={ly} textAnchor="middle" dominantBaseline="central"
            fill="#9CA3AF" fontSize="13" fontWeight="700" fontFamily="Inter, system-ui, sans-serif">
            {t}
          </text>
        );
      })}
      <line x1={cx} y1={cy} x2={nx} y2={ny}
        stroke="#fff" strokeWidth="3" strokeLinecap="round"
        style={{ filter: "drop-shadow(0 0 6px rgba(255,255,255,0.4))" }}
      />
      <circle cx={cx} cy={cy} r="7" fill="#fff" />
      <circle cx={cx} cy={cy} r="3" fill="#0a0a0a" />
    </svg>
  );
}

/* ── Custom Tooltip (same as /tei page) ────────────────────────────────── */
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number; color: string; name: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-neutral-800 text-white px-4 py-3 rounded-lg shadow-xl border border-neutral-600 text-sm">
      <p className="font-bold mb-1.5 text-yellow-300">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mt-0.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
          <span>{p.name}: <b>{p.value?.toFixed(2)}</b></span>
        </div>
      ))}
    </div>
  );
}

/* ── TEI Dot (same as /tei page) ───────────────────────────────────────── */
function TEIDot(props: { cx?: number; cy?: number }) {
  const { cx, cy } = props;
  if (cx == null || cy == null) return null;
  return <circle cx={cx} cy={cy} r={3} fill="#fff" stroke="#fff" strokeWidth={1} />;
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  MAIN COMPONENT — Dashboard TEI Widget
 * ═══════════════════════════════════════════════════════════════════════════ */
export const ReversePointIndex = memo(function ReversePointIndex() {
  const { data: rawData, isLoading } = useSWR(
    "/api/historical/VN30",
    fetcher,
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
      refreshInterval: 300_000,
      shouldRetryOnError: true,
      errorRetryCount: 3,
    },
  );

  const ohlcvData: OHLCVData[] = useMemo(() => {
    if (!rawData?.data?.length) return [];
    return rawData.data.map((d: any) => ({
      date: d.timestamp.split(" ")[0],
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: d.volume,
    }));
  }, [rawData]);

  const rpiResults = useMemo(() => {
    if (ohlcvData.length < 30) return [];
    return calculateRPI(ohlcvData);
  }, [ohlcvData]);

  const latest = useMemo(() => getLatestRPI(rpiResults), [rpiResults]);

  const chartData = useMemo(() => {
    const valid = rpiResults.filter((r) => r.rpi !== null);
    const sliced = valid.slice(-60);
    return sliced.map((r) => {
      const clean = r.date.split(" ")[0];
      const [y, m, d] = clean.split("-");
      return { displayDate: `${d}.${m}`, rpi: r.rpi!, ma7: r.ma7 };
    });
  }, [rpiResults]);

  const teiValue = latest?.rpi ?? 0;
  const teiMA7 = latest?.ma7 ?? 0;
  const classification = classifyTEI(teiValue);
  const cfg = getColorConfig(classification.color);

  const updatedDate = useMemo(() => {
    if (!latest) return "";
    const clean = latest.date.split(" ")[0];
    const [y, m, d] = clean.split("-");
    return `${d}/${m}/${y}`;
  }, [latest]);

  if (isLoading || !rawData) return <RPISkeleton />;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-neutral-900/90 border transition-all duration-500 ${cfg.border} ${cfg.shadow}`}
    >
      <div className={`absolute -top-12 -left-12 w-48 h-48 rounded-full blur-3xl opacity-25 ${cfg.glow}`} />

      <div className="relative z-10 p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-bold text-neutral-400 uppercase tracking-wider">
              Chỉ báo Cạn Kiệt Xu Hướng (TEI)
            </span>
            <span className="text-[11px] text-neutral-600 bg-neutral-800 px-1.5 py-0.5 rounded">VN30</span>
          </div>
          <span className={`text-[12px] font-bold px-2 py-0.5 rounded-full border ${cfg.badge}`}>
            {classification.label}
          </span>
        </div>

        <p className="text-[12px] text-neutral-500 mb-3">
          Đo lường mức độ cạn kiệt xu hướng theo diễn biến thị trường
        </p>

        {/* Gauge + Thresholds */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-4">
          {/* Gauge */}
          <div className="flex flex-col items-center shrink-0">
            <GaugeSVG value={teiValue} />
            <div className="text-center -mt-2">
              <p className="text-2xl font-black text-white tabular-nums">
                {teiValue.toFixed(2)}{" "}
                <span className="text-sm font-bold text-neutral-500">ĐIỂM</span>
              </p>
              <p className="text-sm font-black mt-0.5" style={{ color: classification.color }}>
                {classification.label}
              </p>
              <p className="text-[12px] text-neutral-500 mt-0.5">Cập nhật: {updatedDate}</p>
            </div>
          </div>

          {/* Thresholds */}
          <div className="flex-1 w-full">
            <div className="border border-neutral-800 rounded-xl p-3 bg-neutral-900/50">
              {[
                { text: "Cạn kiệt xu hướng tăng (trên 4)", value: "4.0", bg: "#EF4444" },
                { text: "Trung tính", value: "2.5", bg: "#EAB308" },
                { text: "Cạn kiệt xu hướng giảm (dưới 1)", value: "1.0", bg: "#22C55E" },
              ].map((item, i) => (
                <div key={item.value}
                  className={`flex items-center justify-between py-2.5 ${i < 2 ? "border-b border-neutral-800" : ""}`}>
                  <span className="text-[11px] text-neutral-300 font-medium">{item.text}</span>
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full text-white text-xs font-bold shadow-sm"
                    style={{ backgroundColor: item.bg }}>
                    {item.value}
                  </span>
                </div>
              ))}

              {/* MA7 */}
              <div className="pt-2 border-t border-neutral-800 mt-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-neutral-500">Trung bình MA7:</span>
                  <span className="font-bold text-white tabular-nums">{teiMA7.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Historical Recharts chart */}
        {chartData.length > 2 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-bold text-neutral-400 uppercase tracking-wider">Dữ liệu lịch sử</p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 bg-white rounded-sm" />
                  <span className="text-[11px] text-neutral-500">TEI</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 bg-[#F59E0B] rounded-sm" />
                  <span className="text-[11px] text-neutral-500">Trung Bình MA7</span>
                </div>
              </div>
            </div>
            <div className="bg-neutral-800/30 rounded-lg p-1">
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -5, bottom: 50 }}>
                    <defs>
                      <linearGradient id="dashTeiMa7Fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>

                    <ReferenceArea y1={4.0} y2={5.0} fill="rgba(239, 68, 68, 0.08)" strokeOpacity={0} />
                    <ReferenceArea y1={1.0} y2={4.0} fill="rgba(245, 158, 11, 0.04)" strokeOpacity={0} />
                    <ReferenceArea y1={0} y2={1.0} fill="rgba(34, 197, 94, 0.08)" strokeOpacity={0} />

                    <CartesianGrid stroke="#262626" strokeDasharray="3 3" vertical={false} />

                    <XAxis
                      dataKey="displayDate"
                      tick={{ fontSize: 9, fill: "#6B7280" }}
                      angle={-45}
                      textAnchor="end"
                      height={50}
                      interval={0}
                      tickLine={{ stroke: "#404040" }}
                      axisLine={{ stroke: "#404040" }}
                    />

                    <YAxis
                      domain={[0, 5]}
                      ticks={[0, 1.0, 2.0, 3.0, 4.0, 5.0]}
                      tick={{ fontSize: 10, fill: "#6B7280" }}
                      tickFormatter={(v: number) => v.toFixed(1)}
                      axisLine={{ stroke: "#404040" }}
                      tickLine={{ stroke: "#404040" }}
                      width={30}
                    />

                    <ReferenceLine y={4.0} stroke="#EF4444" strokeDasharray="6 3" strokeOpacity={0.4} />
                    <ReferenceLine y={1.0} stroke="#22C55E" strokeDasharray="6 3" strokeOpacity={0.4} />

                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#525252", strokeDasharray: "4 4" }} />

                    <Area
                      type="monotone"
                      dataKey="ma7"
                      name="Trung Bình (MA7)"
                      fill="url(#dashTeiMa7Fill)"
                      stroke="#F59E0B"
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                      isAnimationActive={false}
                    />

                    <Line
                      type="monotone"
                      dataKey="rpi"
                      name="TEI"
                      stroke="#ffffff"
                      strokeWidth={2}
                      dot={<TEIDot />}
                      activeDot={{ r: 5, fill: "#fff", stroke: "#fff" }}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-neutral-800">
          <span className="text-[12px] text-neutral-500">
            TEI MA7: <span className={`font-bold ${cfg.text}`}>{teiMA7.toFixed(2)}</span>
          </span>
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
        <div className="w-[260px] h-[170px] bg-neutral-800 rounded-lg" />
        <div className="flex-1 space-y-3">
          <div className="h-10 bg-neutral-800 rounded-lg" />
          <div className="h-10 bg-neutral-800 rounded-lg" />
          <div className="h-10 bg-neutral-800 rounded-lg" />
        </div>
      </div>
      <div className="h-[220px] bg-neutral-800 rounded-lg mt-4" />
    </div>
  );
}

export { RPISkeleton };

"use client";

import { memo, useMemo, useEffect } from "react";
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
import { useTopic } from "@/hooks/useTopic";

/* ═══════════════════════════════════════════════════════════════════════════
 *  ART — Analytical Reversal Tracker (Bộ theo dõi đảo chiều xu hướng)
 *  Formerly known as TEI. Dashboard widget for VN30.
 *  Formula: RSI(7)×5% + Stochastic %K(5)×70% + ROC(5)×25%  → 0–5
 *
 *  Zones:
 *   < 1.0  → 🟢 Hoảng loạn cực độ   (Cực kỳ an toàn để mua)
 *   1–2    → 🟢 Hoảng loạn - An toàn
 *   2–3.5  → 🟡 Trung tính
 *   3.5–4.8→ 🔴 Hưng phấn - Nguy hiểm
 *   > 4.8  → 🔴 Hưng phấn cực độ
 * ═══════════════════════════════════════════════════════════════════════════ */

const CHART_THEME = {
  line: "var(--text-primary)",
  dot: "var(--text-primary)",
  gaugeCenter: "var(--bg-page)",
};

/* ── Classify ART — chỉ đổi text label, giữ nguyên màu sắc gauge ─────────────── */
function classifyART(v: number) {
  if (v < 1.0)  return { label: "HOẢNG LOẠN CỰC ĐỘ - AN TOÀN", sublabel: "Cơ hội mua tốt nhất", color: "#22C55E" };
  if (v < 2.5)  return { label: "AN TOÀN",                   sublabel: "Cơ hội mua tốt",     color: "#22C55E" };
  if (v < 4.0)  return { label: "TRUNG TÍNH",               sublabel: "Theo dõi thêm",      color: "#EAB308" };
  if (v < 4.8) return { label: "RỦI RO",                    sublabel: "Cẩn trọng rủi ro",    color: "#EF4444" };
  return         { label: "HƯNG PHẤN CỰC ĐỘ - NGUY HIỂM", sublabel: "Nguy hiểm cao nhất",  color: "#EF4444" };
}

const ART_ZONE_ROWS = [
  { text: "Hưng phấn cực độ (> 4.8)", value: "4.8+", bg: "#EF4444" },
  { text: "Hưng phấn - Nguy hiểm (4-4.8)", value: "4.0", bg: "#F97316" },
  { text: "Trung tính (2.5-4)", value: "2.5", bg: "#EAB308" },
  { text: "Hoảng loạn - An toàn (1-2.5)", value: "1.5", bg: "#22C55E" },
  { text: "Hoảng loạn cực độ (< 1)", value: "<1", bg: "#16A34A" },
];

function getColorConfig(color: string) {
  if (color === "#16A34A" || color === "#22C55E")
    return {
      border: "rgba(34,197,94,0.40)",
      shadow: "shadow-[0_0_30px_-8px_rgba(16,185,129,0.4)]",
      glow: "rgba(34,197,94,0.20)",
      text: "#22c55e",
      badge: { background: "rgba(34,197,94,0.10)", color: "#22c55e", borderColor: "rgba(34,197,94,0.30)" },
    };
  if (color === "#EAB308")
    return {
      border: "rgba(234,179,8,0.30)",
      shadow: "shadow-[0_0_30px_-8px_rgba(245,158,11,0.3)]",
      glow: "rgba(234,179,8,0.15)",
      text: "#eab308",
      badge: { background: "rgba(234,179,8,0.10)", color: "#eab308", borderColor: "rgba(234,179,8,0.30)" },
    };
  return {
    border: "rgba(239,68,68,0.40)",
    shadow: "shadow-[0_0_30px_-8px_rgba(239,68,68,0.4)]",
    glow: "rgba(239,68,68,0.20)",
    text: "var(--danger)",
    badge: { background: "rgba(192,57,43,0.10)", color: "var(--danger)", borderColor: "rgba(192,57,43,0.30)" },
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  ART GAUGE SVG — 60-segment smooth gradient (Green→Yellow→Red)
 * ═══════════════════════════════════════════════════════════════════════════ */
const ART_COLORS: [number, [number, number, number]][] = [
  [0.0, [22, 163, 74]],    // deep green (Hoảng loạn cực độ)
  [0.2, [74, 222, 128]],   // light green
  [0.35, [163, 230, 53]],  // yellow-green
  [0.5, [234, 179, 8]],    // yellow (Trung tính)
  [0.7, [249, 115, 22]],   // orange
  [0.85, [239, 68, 68]],   // red (Hưng phấn)
  [1.0, [220, 38, 38]],    // deep red (Hưng phấn cực độ)
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
        color: interpolateColor(midFrac, ART_COLORS),
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
            fill="var(--text-muted)" fontSize="13" fontWeight="700" fontFamily="Inter, system-ui, sans-serif">
            {t}
          </text>
        );
      })}
      <line x1={cx} y1={cy} x2={nx} y2={ny}
        stroke={CHART_THEME.line} strokeWidth="3" strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r="7" fill={CHART_THEME.dot} />
      <circle cx={cx} cy={cy} r="3" fill={CHART_THEME.gaugeCenter} />
    </svg>
  );
}

/* ── Custom Tooltip ────────────────────────────────────────────────────── */
function CustomTooltip({
  active, payload, label,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number; color: string; name: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-4 py-3 rounded-lg shadow-xl border text-sm" style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
      <p className="font-bold mb-1.5" style={{ color: "var(--text-secondary)" }}>{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mt-0.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
          <span>{p.name}: <b>{p.value?.toFixed(2)}</b></span>
        </div>
      ))}
    </div>
  );
}

function ARTDot(props: { cx?: number; cy?: number }) {
  const { cx, cy } = props;
  if (cx == null || cy == null) return null;
  return <circle cx={cx} cy={cy} r={3} fill={CHART_THEME.dot} stroke={CHART_THEME.dot} strokeWidth={1} />;
}

function FreshnessBadge({ freshness }: { freshness: string | null }) {
  if (!freshness) return null;
  const state = freshness.toLowerCase();
  const isFresh = state === "fresh";
  const isStale = state === "stale";
  const label = isFresh ? "Fresh" : isStale ? "Stale" : state.toUpperCase();
  const style = isFresh
    ? { color: "#16a34a", borderColor: "rgba(22,163,74,0.25)", background: "rgba(22,163,74,0.10)" }
    : isStale
      ? { color: "#f59e0b", borderColor: "rgba(245,158,11,0.25)", background: "rgba(245,158,11,0.10)" }
      : { color: "var(--danger)", borderColor: "rgba(192,57,43,0.25)", background: "rgba(192,57,43,0.10)" };
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={style}>
      {label}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  MAIN COMPONENT — Dashboard ART Widget
 *  Fix skeleton: Card render ngay với giá trị 0, chart load sau (lazy)
 * ═══════════════════════════════════════════════════════════════════════════ */
export const ReversePointIndex = memo(function ReversePointIndex() {
  const historicalTopic = useTopic<{ data?: Array<Record<string, unknown>> }>("vn:historical:VN30:1d", {
    refreshInterval: 0,
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
    staleWhileRevalidate: true,
  });
  const rawData = historicalTopic.data;
  const isLoading = historicalTopic.isLoading;

  // Smart Scheduler: 9:30, 14:00, 15:00 T2-T6
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const day = now.getDay();
      const hour = now.getHours();
      const min = now.getMinutes();
      if (day >= 1 && day <= 5) {
        const is930 = hour === 9 && min === 30;
        const is1400 = hour === 14 && min === 0;
        const is1500 = hour === 15 && min === 0;
        if (is930 || is1400 || is1500) void historicalTopic.refresh(true);
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [historicalTopic.refresh]);

  const ohlcvData: OHLCVData[] = useMemo(() => {
    if (!rawData?.data?.length) return [];
    return rawData.data.map((d: any) => ({
      date: (d.timestamp ?? d.date ?? "").split(" ")[0],
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
    return valid.slice(-60).map((r) => {
      const clean = r.date.split(" ")[0];
      const [y, m, d] = clean.split("-");
      return { displayDate: `${d}.${m}`, rpi: r.rpi!, ma7: r.ma7 };
    });
  }, [rpiResults]);

  // Render ngay kể cả khi isLoading — không block UI
  const artValue = latest?.rpi ?? 0;
  const artMA7 = latest?.ma7 ?? 0;
  const classification = classifyART(artValue);
  const cfg = getColorConfig(classification.color);

  const updatedDate = useMemo(() => {
    if (!latest) return "";
    const clean = latest.date.split(" ")[0];
    const [y, m, d] = clean.split("-");
    return `${d}/${m}/${y}`;
  }, [latest]);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border transition-all duration-500 ${cfg.shadow}`}
      style={{ background: "var(--surface)", borderColor: cfg.border }}
    >
      <div className="absolute -top-12 -left-12 w-48 h-48 rounded-full opacity-25" style={{ background: cfg.glow }} />

      <div className="relative z-10 p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex flex-col gap-0.5">
            <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
              ADN ART
            </span>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Bộ theo dõi đảo chiều xu hướng · VN30</span>
          </div>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border" style={cfg.badge}>
            {classification.label}
          </span>
        </div>
        <div className="mb-2">
          <FreshnessBadge freshness={historicalTopic.freshness} />
        </div>

        {/* Gauge + Thresholds */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-4 mt-3">
          {/* Gauge — luôn render (với value=0 nếu đang load) */}
          <div className="flex flex-col items-center shrink-0">
            <GaugeSVG value={artValue} />
            <div className="text-center -mt-2">
              {isLoading && !latest ? (
                <div className="flex flex-col items-center gap-1">
                  <div className="h-8 w-24 rounded animate-pulse" style={{ background: "var(--surface-2)" }} />
                  <div className="h-4 w-32 rounded animate-pulse" style={{ background: "var(--surface-2)" }} />
                </div>
              ) : (
                <>
                  <p className="text-2xl font-black tabular-nums" style={{ color: "var(--text-primary)" }}>
                    {artValue.toFixed(2)}{" "}
                    <span className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>ĐIỂM</span>
                  </p>
                  <p className="text-sm font-black mt-0.5" style={{ color: classification.color }}>
                    {classification.label}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: classification.color, opacity: 0.7 }}>
                    {classification.sublabel}
                  </p>
                  {updatedDate && (
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>Cập nhật: {updatedDate}</p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Phân vùng ADN ART */}
          <div className="flex-1 w-full">
            <div className="border rounded-xl p-3" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
              {ART_ZONE_ROWS.map((item, i) => (
                <div key={item.value}
                  className={`flex items-center justify-between py-2 ${i < 4 ? "border-b" : ""}`}
                  style={{ borderColor: "var(--border)" }}>
                  <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>{item.text}</span>
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full text-[10px] font-bold shadow-sm shrink-0"
                    style={{ backgroundColor: item.bg, color: "#ffffff" }}>
                    {item.value}
                  </span>
                </div>
              ))}

              {/* MA7 */}
              <div className="pt-2 border-t mt-1" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center justify-between text-[11px]">
                  <span style={{ color: "var(--text-muted)" }}>Trung bình MA7:</span>
                  <span className="font-bold tabular-nums" style={{ color: cfg.text }}>{artMA7.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Historical Chart — chỉ render khi đã có data, không block card */}
        {chartData.length > 2 ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Dữ liệu lịch sử</p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "var(--text-primary)" }} />
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>ADN ART</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 bg-[#F59E0B] rounded-sm" />
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>MA7</span>
                </div>
              </div>
            </div>
            <div className="rounded-lg p-1" style={{ background: "rgba(0,0,0,0.1)" }}>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -5, bottom: 50 }}>
                    <defs>
                      <linearGradient id="artMa7Fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>

                    <ReferenceArea y1={4.8} y2={5.0} fill="rgba(220, 38, 38, 0.12)" strokeOpacity={0} />
                    <ReferenceArea y1={3.5} y2={4.8} fill="rgba(239, 68, 68, 0.08)" strokeOpacity={0} />
                    <ReferenceArea y1={2.0} y2={3.5} fill="rgba(245, 158, 11, 0.04)" strokeOpacity={0} />
                    <ReferenceArea y1={1.0} y2={2.0} fill="rgba(34, 197, 94, 0.08)" strokeOpacity={0} />
                    <ReferenceArea y1={0} y2={1.0} fill="rgba(22, 163, 74, 0.12)" strokeOpacity={0} />

                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="displayDate" tick={{ fontSize: 9, fill: "var(--text-muted)" }}
                      angle={-45} textAnchor="end" height={50} interval={0}
                      tickLine={{ stroke: "var(--border)" }} axisLine={{ stroke: "var(--border)" }} />
                    <YAxis domain={[0, 5]} ticks={[0, 1.0, 2.0, 3.0, 4.0, 5.0]}
                      tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickFormatter={(v: number) => v.toFixed(1)}
                      axisLine={{ stroke: "var(--border)" }} tickLine={{ stroke: "var(--border)" }} width={30} />

                    <ReferenceLine y={4.8} stroke="#DC2626" strokeDasharray="4 4" strokeOpacity={0.5} />
                    <ReferenceLine y={3.5} stroke="#EF4444" strokeDasharray="6 3" strokeOpacity={0.4} />
                    <ReferenceLine y={2.0} stroke="#EAB308" strokeDasharray="6 3" strokeOpacity={0.3} />
                    <ReferenceLine y={1.0} stroke="#22C55E" strokeDasharray="6 3" strokeOpacity={0.4} />

                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }} />
                    <Area type="monotone" dataKey="ma7" name="Trung Bình (MA7)"
                      fill="url(#artMa7Fill)" stroke="#F59E0B" strokeWidth={2}
                      dot={false} connectNulls={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="rpi" name="ADN ART"
                      stroke="var(--text-primary)" strokeWidth={2}
                      dot={<ARTDot />} activeDot={{ r: 5, fill: CHART_THEME.dot, stroke: CHART_THEME.dot }}
                      isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : isLoading ? (
          <div className="h-[220px] rounded-lg animate-pulse mt-2 flex items-center justify-center" style={{ background: "var(--surface-2)" }}>
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Đang tải dữ liệu lịch sử...</span>
          </div>
        ) : null}

        {/* Footer */}
        <div className="flex items-center mt-3 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
          <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
            ADN ART MA7: <span className="font-bold" style={{ color: cfg.text }}>{artMA7.toFixed(2)}</span>
          </span>
        </div>
      </div>
    </div>
  );
});

/* ── Skeleton (chỉ dùng khi chưa mount) ───────────────────────────────── */
function RPISkeleton() {
  return (
    <div className="rounded-2xl bg-[var(--surface)] border p-5 animate-pulse" style={{ borderColor: "var(--border)" }}>
      <div className="h-4 rounded w-52 mb-1" style={{ background: "var(--surface-2)" }} />
      <div className="h-3 rounded w-36 mb-4" style={{ background: "var(--surface-2)", opacity: 0.6 }} />
      <div className="flex gap-4">
        <div className="w-[260px] h-[170px] rounded-lg" style={{ background: "var(--surface-2)" }} />
        <div className="flex-1 space-y-3">
          <div className="h-8 rounded-lg" style={{ background: "var(--surface-2)" }} />
          <div className="h-8 rounded-lg" style={{ background: "var(--surface-2)" }} />
          <div className="h-8 rounded-lg" style={{ background: "var(--surface-2)" }} />
          <div className="h-8 rounded-lg" style={{ background: "var(--surface-2)" }} />
        </div>
      </div>
      <div className="h-[220px] rounded-lg mt-4" style={{ background: "var(--surface-2)" }} />
    </div>
  );
}

export { RPISkeleton };

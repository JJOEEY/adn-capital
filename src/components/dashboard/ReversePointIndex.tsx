"use client";

import { memo, useMemo } from "react";
import useSWR from "swr";
import { calculateRPI, getLatestRPI, type OHLCVData } from "@/lib/rpi/calculator";

/* ═══════════════════════════════════════════════════════════════════════════
 *  ReversePointIndex — Chỉ báo Cạn Kiệt Xu Hướng (TEI) cho VN30
 *  Dashboard compact widget — uses frontend calculation (new formula)
 * ═══════════════════════════════════════════════════════════════════════════ */

const fetcher = (url: string) =>
  fetch(url, { signal: AbortSignal.timeout(60_000) }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

/* ── Classify TEI ──────────────────────────────────────────────────────── */
function classifyTEI(v: number) {
  if (v >= 4.0) return { label: "CẠN KIỆT XU HƯỚNG TĂNG", color: "red" as const };
  if (v <= 1.0) return { label: "CẠN KIỆT XU HƯỚNG GIẢM", color: "green" as const };
  return { label: "TRUNG TÍNH", color: "yellow" as const };
}

function getColorConfig(color: "red" | "yellow" | "green") {
  if (color === "red")
    return {
      border: "border-red-500/40",
      shadow: "shadow-[0_0_30px_-8px_rgba(239,68,68,0.4)]",
      glow: "bg-red-500/20",
      text: "text-red-400",
      badge: "bg-red-500/10 text-red-400 border-red-500/30",
    };
  if (color === "green")
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

/* ── Speedometer Gauge SVG ─────────────────────────────────────────────── */
function GaugeSVG({ value }: { value: number }) {
  const clampedValue = Math.max(0, Math.min(5, value));
  const angle = -135 + (clampedValue / 5) * 270;

  const segments = [
    { from: 0, to: 1, color: "#22c55e" },
    { from: 1, to: 2, color: "#86efac" },
    { from: 2, to: 3, color: "#fbbf24" },
    { from: 3, to: 4, color: "#f97316" },
    { from: 4, to: 5, color: "#ef4444" },
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

  const needleAngle = (angle * Math.PI) / 180;
  const needleLen = 58;
  const nx = cx + needleLen * Math.cos(needleAngle);
  const ny = cy + needleLen * Math.sin(needleAngle);

  const ticks = [0, 1, 2, 3, 4, 5];

  return (
    <svg viewBox="0 0 200 130" className="w-full max-w-[220px]">
      {segments.map((seg, i) => (
        <path key={i} d={arcPath(seg.from, seg.to)} fill="none" stroke={seg.color}
          strokeWidth="14" strokeLinecap="butt" opacity={0.85} />
      ))}
      {ticks.map((t) => {
        const a = ((-135 + (t / 5) * 270) * Math.PI) / 180;
        const lx = cx + (r + 16) * Math.cos(a);
        const ly = cy + (r + 16) * Math.sin(a);
        return (
          <text key={t} x={lx} y={ly} textAnchor="middle" dominantBaseline="central"
            className="fill-neutral-400" fontSize="10" fontWeight="600">{t}</text>
        );
      })}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#e2e8f0" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="5" fill="#334155" stroke="#e2e8f0" strokeWidth="2" />
    </svg>
  );
}

/* ── Mini Line Chart (SVG-based) ───────────────────────────────────────── */
function TEIChart({ history }: { history: { date: string; rpi: number; ma7: number | null }[] }) {
  const width = 600;
  const height = 200;
  const padding = { top: 15, right: 15, bottom: 55, left: 30 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  if (history.length < 2) return null;

  const xScale = (i: number) => padding.left + (i / (history.length - 1)) * chartW;
  const yScale = (v: number) => padding.top + chartH - ((v - 0) / (5 - 0)) * chartH;

  const rpiPoints = history.map((d, i) => `${xScale(i)},${yScale(d.rpi)}`).join(" ");
  const ma7Points = history
    .map((d, i) => (d.ma7 != null ? `${xScale(i)},${yScale(d.ma7)}` : null))
    .filter(Boolean)
    .join(" ");

  const y4 = yScale(4.0);
  const y1 = yScale(1.0);
  const gridY = [0, 1.0, 2.0, 3.0, 4.0, 5.0];
  const step = Math.max(1, Math.floor(history.length / 9));
  const dateLabels = history.filter((_, i) => i % step === 0 || i === history.length - 1);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <rect x={padding.left} y={y4} width={chartW} height={y1 - y4} fill="#fbbf24" opacity={0.08} />
      {gridY.map((v) => (
        <g key={v}>
          <line x1={padding.left} y1={yScale(v)} x2={padding.left + chartW} y2={yScale(v)}
            stroke="#374151" strokeWidth="0.5"
            strokeDasharray={v === 1.0 || v === 4.0 ? "4,3" : "2,4"}
            opacity={v === 1.0 || v === 4.0 ? 0.6 : 0.3} />
          <text x={padding.left - 6} y={yScale(v)} textAnchor="end" dominantBaseline="central"
            className="fill-neutral-500" fontSize="9">{v.toFixed(1)}</text>
        </g>
      ))}
      {ma7Points && (
        <polyline points={ma7Points} fill="none" stroke="#fbbf24" strokeWidth="2" opacity={0.9} />
      )}
      <polyline points={rpiPoints} fill="none" stroke="#e2e8f0" strokeWidth="2.5" />
      {history.map((d, i) => (
        <circle key={i} cx={xScale(i)} cy={yScale(d.rpi)} r="3" fill="#e2e8f0" stroke="#e2e8f0" strokeWidth="1" />
      ))}
      {dateLabels.map((d) => {
        const idx = history.indexOf(d);
        return (
          <text key={idx} x={xScale(idx)} y={height - 8} textAnchor="end" className="fill-neutral-500"
            fontSize="9" transform={`rotate(-45, ${xScale(idx)}, ${height - 8})`}>
            {d.date.replace(/\/\d{4}$/, "")}
          </text>
        );
      })}
    </svg>
  );
}

/* ── Main TEI Component (frontend calculation) ─────────────────────────── */
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

  const history = useMemo(() => {
    const valid = rpiResults.filter((r) => r.rpi !== null);
    const sliced = valid.slice(-40);
    return sliced.map((r) => {
      const clean = r.date.split(" ")[0];
      const [y, m, d] = clean.split("-");
      return { date: `${d}/${m}`, rpi: r.rpi!, ma7: r.ma7 };
    });
  }, [rpiResults]);

  const teiValue = latest?.rpi ?? 0;
  const teiMA7 = latest?.ma7 ?? 0;
  const { label: classification, color } = classifyTEI(teiValue);
  const cfg = getColorConfig(color);

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
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
              Chỉ báo Cạn Kiệt Xu Hướng (TEI)
            </span>
            <span className="text-[9px] text-neutral-600 bg-neutral-800 px-1.5 py-0.5 rounded">VN30</span>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.badge}`}>
            {classification}
          </span>
        </div>

        <p className="text-[10px] text-neutral-500 mb-3">
          Đo lường mức độ cạn kiệt xu hướng theo diễn biến thị trường
        </p>

        {/* Main content: Gauge + Thresholds */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-4">
          <div className="flex flex-col items-center shrink-0">
            <GaugeSVG value={teiValue} />
            <div className="text-center -mt-1">
              <span className={`text-xl font-black ${cfg.text}`}>{teiValue.toFixed(2)}</span>
              <span className="text-[10px] text-neutral-400 ml-1">ĐIỂM</span>
            </div>
            <p className={`text-xs font-bold uppercase ${cfg.text} mt-0.5`}>{classification}</p>
            <p className="text-[10px] text-neutral-500 mt-0.5">Cập nhật: {updatedDate}</p>
          </div>

          <div className="flex-1 space-y-2 w-full">
            <div className="flex items-center justify-between bg-neutral-800/50 rounded-lg px-3 py-2">
              <span className="text-[11px] text-neutral-300">Cạn kiệt xu hướng tăng (trên 4)</span>
              <span className="text-sm font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">4.0</span>
            </div>
            <div className="flex items-center justify-between bg-neutral-800/50 rounded-lg px-3 py-2">
              <span className="text-[11px] text-neutral-300">Trung tính</span>
              <span className="text-sm font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">2.5</span>
            </div>
            <div className="flex items-center justify-between bg-neutral-800/50 rounded-lg px-3 py-2">
              <span className="text-[11px] text-neutral-300">Cạn kiệt xu hướng giảm (dưới 1)</span>
              <span className="text-sm font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">1.0</span>
            </div>
          </div>
        </div>

        {/* Historical chart */}
        {history.length > 2 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Dữ liệu lịch sử</p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-0.5 bg-neutral-300 rounded-full" />
                  <span className="text-[9px] text-neutral-500">TEI</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-0.5 bg-amber-500 rounded-full" />
                  <span className="text-[9px] text-neutral-500">Trung Bình MA7</span>
                </div>
              </div>
            </div>
            <div className="bg-neutral-800/30 rounded-lg p-2">
              <TEIChart history={history} />
            </div>
          </div>
        )}

        {/* Footer with MA7 */}
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-neutral-800">
          <span className="text-[10px] text-neutral-500">
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

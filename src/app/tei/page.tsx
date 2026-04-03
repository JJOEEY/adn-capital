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
import { RefreshCw, Calendar, Search, ChevronDown } from "lucide-react";
import { calculateRPI, getLatestRPI, type OHLCVData, type RPIResult } from "@/lib/rpi/calculator";
import { MainLayout } from "@/components/layout/MainLayout";

/* ═══════════════════════════════════════════════════════════════════════════
 *  TEI Page — Chỉ báo Cạn Kiệt Xu Hướng (Trend Exhaustion Index)
 *  Simplified: Gauge + Thresholds + Timeline chart with dropdown
 *  NO component details, NO formula info
 * ═══════════════════════════════════════════════════════════════════════════ */

interface HistoricalResponse {
  ticker: string;
  timeframe: string;
  from_date: string;
  to_date: string;
  count: number;
  data: {
    ticker: string;
    timestamp: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    value: number;
  }[];
}

interface ChartPoint {
  displayDate: string;
  rpi: number;
  ma7: number | null;
}

/* ── Presets ────────────────────────────────────────────────────────────── */
const PRESET_TICKERS = [
  { value: "VN30", label: "VN30 Index" },
  { value: "VNINDEX", label: "VNINDEX" },
  { value: "VNM", label: "VNM" },
  { value: "FPT", label: "FPT" },
  { value: "VCB", label: "VCB" },
  { value: "HPG", label: "HPG" },
  { value: "MWG", label: "MWG" },
  { value: "TCB", label: "TCB" },
  { value: "VHM", label: "VHM" },
  { value: "MSN", label: "MSN" },
];

/* ── Timeline options for backtest dropdown ─────────────────────────────── */
const TIMELINE_OPTIONS = [
  { value: 30, label: "1 Tháng" },
  { value: 60, label: "2 Tháng" },
  { value: 90, label: "3 Tháng" },
  { value: 120, label: "6 Tháng" },
  { value: 200, label: "1 Năm" },
  { value: 9999, label: "Tất cả" },
];

const fetcher = (url: string) =>
  fetch(url, { signal: AbortSignal.timeout(60_000) }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

/* ── Date helpers ──────────────────────────────────────────────────────── */
function formatDateDMY(dateStr: string): string {
  const clean = dateStr.split(" ")[0];
  const [y, m, d] = clean.split("-");
  return `${d}.${m}.${y}`;
}

function formatDateSlash(dateStr: string): string {
  const clean = dateStr.split(" ")[0];
  const [y, m, d] = clean.split("-");
  return `${d}/${m}/${y}`;
}

/* ── Classify TEI ──────────────────────────────────────────────────────── */
function classifyTEI(v: number) {
  if (v >= 4.0) return { label: "CẠN KIỆT XU HƯỚNG TĂNG", color: "#EF4444" };
  if (v <= 1.0) return { label: "CẠN KIỆT XU HƯỚNG GIẢM", color: "#22C55E" };
  return { label: "TRUNG TÍNH", color: "#EAB308" };
}

/* ══════════════════════════════════════════════════════════════════════════
 *  GAUGE SVG — Semicircle 0–5, smooth multi-segment gradient, needle
 * ══════════════════════════════════════════════════════════════════════════ */
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
    <svg viewBox="0 0 300 170" className="w-full max-w-[320px] mx-auto">
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

/* ══════════════════════════════════════════════════════════════════════════
 *  CUSTOM TOOLTIP
 * ══════════════════════════════════════════════════════════════════════════ */
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

/* ══════════════════════════════════════════════════════════════════════════
 *  TEI DOT
 * ══════════════════════════════════════════════════════════════════════════ */
function TEIDot(props: { cx?: number; cy?: number }) {
  const { cx, cy } = props;
  if (cx == null || cy == null) return null;
  return <circle cx={cx} cy={cy} r={4} fill="#fff" stroke="#fff" strokeWidth={1} />;
}

/* ══════════════════════════════════════════════════════════════════════════
 *  MAIN TEI PAGE COMPONENT
 * ══════════════════════════════════════════════════════════════════════════ */
export default function TEIPage() {
  const [ticker, setTicker] = useState("VN30");
  const [inputTicker, setInputTicker] = useState("");
  const [timelineSessions, setTimelineSessions] = useState(60);
  const [timelineOpen, setTimelineOpen] = useState(false);

  const apiUrl = `/api/historical/${encodeURIComponent(ticker)}`;

  const { data: rawData, isLoading, error, mutate } = useSWR(
    apiUrl,
    fetcher,
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
      refreshInterval: 300_000,
      errorRetryCount: 3,
      errorRetryInterval: 3000,
    },
  );

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await mutate();
    setRefreshing(false);
  }, [mutate]);

  const handleTickerSelect = useCallback((t: string) => {
    setTicker(t.toUpperCase().trim());
    setInputTicker("");
  }, []);

  const handleCustomTicker = useCallback(() => {
    const t = inputTicker.toUpperCase().trim();
    if (t.length >= 2 && t.length <= 10) {
      setTicker(t);
      setInputTicker("");
    }
  }, [inputTicker]);

  // Convert API response to OHLCV data
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

  // Calculate TEI on frontend
  const rpiResults = useMemo(() => {
    if (ohlcvData.length < 30) return [];
    return calculateRPI(ohlcvData);
  }, [ohlcvData]);

  const latest = useMemo(() => getLatestRPI(rpiResults), [rpiResults]);

  // Chart data with timeline filter
  const chartData: ChartPoint[] = useMemo(() => {
    const valid = rpiResults.filter((r) => r.rpi !== null);
    const sliced = timelineSessions >= 9999 ? valid : valid.slice(-timelineSessions);
    return sliced.map((r) => ({
      displayDate: formatDateDMY(r.date),
      rpi: r.rpi!,
      ma7: r.ma7,
    }));
  }, [rpiResults, timelineSessions]);

  const currentTEI = latest?.rpi ?? 0;
  const currentMA7 = latest?.ma7 ?? 0;
  const classification = classifyTEI(currentTEI);

  const dateRange = useMemo(() => {
    if (chartData.length < 2) return "";
    return `${chartData[0].displayDate} – ${chartData[chartData.length - 1].displayDate}`;
  }, [chartData]);

  const updatedDate = latest ? formatDateSlash(latest.date) : "";

  const currentTimelineLabel = TIMELINE_OPTIONS.find((o) => o.value === timelineSessions)?.label ?? "2 Tháng";

  /* ── Loading skeleton ────────────────────────────────────────────────── */
  if (isLoading && !rawData) {
    return (
      <MainLayout>
        <div className="p-3 md:p-6 max-w-5xl mx-auto">
          <TEISkeleton />
        </div>
      </MainLayout>
    );
  }

  /* ── Error state ─────────────────────────────────────────────────────── */
  if (error && !rawData) {
    return (
      <MainLayout>
        <div className="p-3 md:p-6 max-w-5xl mx-auto">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-8 text-center">
            <div className="text-red-400 text-lg font-bold mb-2">Không tải được dữ liệu OHLCV</div>
            <p className="text-neutral-500 text-sm mb-4">Mã: {ticker} — Kiểm tra FiinQuant Bridge</p>
            <button onClick={handleRefresh}
              className="px-4 py-2 border border-neutral-700 rounded-lg text-sm text-neutral-400 hover:bg-neutral-800">
              Thử lại
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-3 md:p-6 max-w-5xl mx-auto space-y-4">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 overflow-hidden">
          {/* ═══ HEADER ═══ */}
          <div className="px-6 py-5 border-b border-neutral-800">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-white tracking-tight">
                  CHỈ BÁO CẠN KIỆT XU HƯỚNG{" "}
                  <span className="text-neutral-500 font-normal text-base">(Trend Exhaustion Index – TEI)</span>
                </h2>
                <p className="text-sm text-neutral-500 mt-1">
                  Đo lường mức độ cạn kiệt xu hướng theo diễn biến thị trường
                </p>
              </div>
              <button onClick={handleRefresh} disabled={refreshing}
                className="p-2 rounded-lg border border-neutral-700 hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300 transition-all disabled:opacity-50 self-end"
                title="Làm mới dữ liệu">
                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* ═══ TICKER SELECTOR ═══ */}
          <div className="px-6 py-4 border-b border-neutral-800 bg-neutral-900/50">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex flex-wrap gap-1.5">
                {PRESET_TICKERS.map((t) => (
                  <button key={t.value} onClick={() => handleTickerSelect(t.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                      ${ticker === t.value
                        ? "bg-white text-neutral-900 shadow-sm"
                        : "bg-neutral-800 text-neutral-400 border border-neutral-700 hover:bg-neutral-700 hover:text-neutral-200"}`}>
                    {t.value}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
                  <input
                    type="text"
                    value={inputTicker}
                    onChange={(e) => setInputTicker(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && handleCustomTicker()}
                    placeholder="Nhập mã..."
                    maxLength={10}
                    className="pl-8 pr-3 py-1.5 w-28 rounded-lg border border-neutral-700 text-xs text-white bg-neutral-800
                      focus:outline-none focus:ring-2 focus:ring-neutral-600 placeholder:text-neutral-600"
                  />
                </div>
                <button onClick={handleCustomTicker}
                  className="px-3 py-1.5 rounded-lg bg-neutral-700 text-neutral-300 text-xs font-bold hover:bg-neutral-600 transition-colors">
                  Xem
                </button>
              </div>
              <span className="ml-auto text-xs text-neutral-500">
                Đang xem: <span className="font-bold text-white">{ticker}</span>
                {rawData && <span className="ml-1">({rawData.count} phiên)</span>}
              </span>
            </div>
          </div>

          {/* ═══ GAUGE + THRESHOLDS ═══ */}
          <div className="px-6 py-6">
            <div className="grid md:grid-cols-[1fr_1fr] gap-6 items-center">
              {/* Left: Gauge */}
              <div className="flex flex-col items-center">
                <GaugeSVG value={currentTEI} />
                <div className="text-center -mt-2">
                  <p className="text-4xl font-black text-white tabular-nums">
                    {currentTEI.toFixed(2)}{" "}
                    <span className="text-lg font-bold text-neutral-500">ĐIỂM</span>
                  </p>
                  <p className="text-xl font-black mt-1" style={{ color: classification.color }}>
                    {classification.label}
                  </p>
                  <p className="text-xs text-neutral-500 mt-2">Cập nhật: {updatedDate}</p>
                </div>
              </div>

              {/* Right: Thresholds + MA7 */}
              <div className="space-y-5">
                <div className="border border-neutral-800 rounded-xl p-5 bg-neutral-900/50">
                  {[
                    { text: "Cạn kiệt xu hướng tăng (trên 4)", value: "4.0", bg: "#EF4444" },
                    { text: "Trung tính", value: "2.5", bg: "#EAB308" },
                    { text: "Cạn kiệt xu hướng giảm (dưới 1)", value: "1.0", bg: "#22C55E" },
                  ].map((item, i) => (
                    <div key={item.value}
                      className={`flex items-center justify-between py-3 ${i < 2 ? "border-b border-neutral-800" : ""}`}>
                      <span className="text-sm text-neutral-300 font-medium">{item.text}</span>
                      <span className="inline-flex items-center justify-center w-9 h-9 rounded-full text-white text-sm font-bold shadow-sm"
                        style={{ backgroundColor: item.bg }}>
                        {item.value}
                      </span>
                    </div>
                  ))}

                  {/* MA7 */}
                  <div className="pt-3 border-t border-neutral-800 mt-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-500">Trung bình MA7:</span>
                      <span className="font-bold text-white tabular-nums">{currentMA7.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ CHART SECTION WITH TIMELINE DROPDOWN ═══ */}
          <div className="px-6 pb-6">
            <div className="border-t border-neutral-800 pt-6">
              {/* Chart header with timeline dropdown */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-lg font-black text-white">DỮ LIỆU LỊCH SỬ</h3>
                  <div className="flex items-center gap-4 mt-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-3 bg-white rounded-sm" />
                      <span className="text-xs text-neutral-400">TEI</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-3 bg-[#F59E0B] rounded-sm" />
                      <span className="text-xs text-neutral-400">Trung Bình MA7</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Timeline dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setTimelineOpen(!timelineOpen)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-700 bg-neutral-800 text-sm text-neutral-300 hover:bg-neutral-700 transition-colors"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      {currentTimelineLabel}
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${timelineOpen ? "rotate-180" : ""}`} />
                    </button>
                    {timelineOpen && (
                      <div className="absolute right-0 top-full mt-1 z-50 w-40 rounded-lg border border-neutral-700 bg-neutral-800 shadow-xl overflow-hidden">
                        {TIMELINE_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => {
                              setTimelineSessions(opt.value);
                              setTimelineOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors
                              ${timelineSessions === opt.value
                                ? "bg-neutral-700 text-white font-bold"
                                : "text-neutral-400 hover:bg-neutral-700/50 hover:text-neutral-200"}`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {dateRange && (
                    <span className="text-xs text-neutral-500 hidden sm:inline">{dateRange}</span>
                  )}
                </div>
              </div>

              {/* Recharts chart */}
              {chartData.length > 1 ? (
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
                      <defs>
                        <linearGradient id="teiMa7Fill" x1="0" y1="0" x2="0" y2="1">
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
                        tick={{ fontSize: 10, fill: "#6B7280" }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                        interval={0}
                        tickLine={{ stroke: "#404040" }}
                        axisLine={{ stroke: "#404040" }}
                      />

                      <YAxis
                        domain={[0, 5]}
                        ticks={[0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0]}
                        tick={{ fontSize: 11, fill: "#6B7280" }}
                        tickFormatter={(v: number) => v.toFixed(1)}
                        axisLine={{ stroke: "#404040" }}
                        tickLine={{ stroke: "#404040" }}
                        width={35}
                      />

                      <ReferenceLine y={4.0} stroke="#EF4444" strokeDasharray="6 3" strokeOpacity={0.4} />
                      <ReferenceLine y={1.0} stroke="#22C55E" strokeDasharray="6 3" strokeOpacity={0.4} />

                      <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#525252", strokeDasharray: "4 4" }} />

                      <Area
                        type="monotone"
                        dataKey="ma7"
                        name="Trung Bình (MA7)"
                        fill="url(#teiMa7Fill)"
                        stroke="#F59E0B"
                        strokeWidth={2.5}
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
                        activeDot={{ r: 6, fill: "#fff", stroke: "#fff" }}
                        isAnimationActive={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-neutral-500">
                  Không đủ dữ liệu lịch sử để vẽ biểu đồ
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 *  SKELETON
 * ══════════════════════════════════════════════════════════════════════════ */
function TEISkeleton() {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-8 animate-pulse">
      <div className="h-8 w-64 bg-neutral-800 rounded mb-4" />
      <div className="h-10 w-full bg-neutral-800/50 rounded-lg mb-6" />
      <div className="grid md:grid-cols-2 gap-8">
        <div className="h-52 bg-neutral-800/50 rounded-xl" />
        <div className="space-y-4">
          <div className="h-10 bg-neutral-800/50 rounded-lg" />
          <div className="h-10 bg-neutral-800/50 rounded-lg" />
          <div className="h-10 bg-neutral-800/50 rounded-lg" />
          <div className="h-10 bg-neutral-800/50 rounded-lg" />
        </div>
      </div>
      <div className="h-64 bg-neutral-800/50 rounded-xl mt-6" />
    </div>
  );
}

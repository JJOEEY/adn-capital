"use client";

import { useEffect, useState, useMemo, useCallback, memo, Suspense } from "react";
import useSWR from "swr";
import { RefreshCw, Bot, Zap, ShieldAlert, Flame, AlertTriangle, TrendingUp } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/Button";
import { TickerTape, TickerTapeSkeleton } from "@/components/dashboard/TickerTape";
import { VNIndexChart, VNIndexChartSkeleton } from "@/components/dashboard/VNIndexChart";
import { MarketBreadth, MarketBreadthSkeleton } from "@/components/dashboard/MarketBreadth";
import { ReversePointIndex, RPISkeleton } from "@/components/dashboard/ReversePointIndex";
import { MorningNews } from "@/components/dashboard/MorningNews";
import { EveningNews } from "@/components/dashboard/EveningNews";
import { MorningNewsSkeleton, EveningNewsSkeleton } from "@/components/dashboard/NewsSkeleton";
import { LockOverlay } from "@/components/ui/LockOverlay";
import { useSubscription } from "@/hooks/useSubscription";

interface MarketData {
  status: "GOOD" | "BAD" | "NEUTRAL";
  phase: "no_trade" | "probe" | "full_margin";
  description: string;
  indicators: Record<string, boolean>;
  verdict: string;
  action: string;
  vnindex: { value: number; change: number; changePercent: number };
  hnx: { value: number; change: number; changePercent: number };
  vn30: { value: number; change: number; changePercent: number };
  updown: { up: number; down: number; unchanged: number };
  totalVolume: string;
  aiSummary: string;
  date: string;
  globalIndices: Array<{ name: string; value: number; changePercent: number; icon: string }>;
  vnMarketBullets: string[];
  macroBullets: string[];
  riskBullets: string[];
  opportunityBullets: string[];
  chartData: Array<{ date: string; close: number }>;
}

/** Dữ liệu "Đánh giá Đáy Thị Trường" từ Python API */
interface MarketOverview {
  ticker: string;
  score: number;
  max_score: number;
  ta_score?: number;
  ta_max?: number;
  valuation_score?: number;
  valuation_max?: number;
  pe?: number | null;
  pb?: number | null;
  pe_score?: number;
  pb_score?: number;
  level: 1 | 2 | 3;
  status_badge: string;
  nav_allocation?: string;
  margin_allowed?: boolean;
  market_breadth: string;
  monthly_summary?: string;
  weekly_summary?: string;
  valuation_summary?: string;
  technical_highlights: {
    ema: string;
    vsa: string;
    divergence: string;
    monthly?: string;
    weekly?: string;
    valuation?: string;
  };
  reasons: string[];
  action_message: string;
  disclaimer: string;
  liquidity: number;
  price: number;
}

/** Format số tiền tệ đẹp: 10542.3 → "10,542" */
function fmtLiquidity(tyVnd: number): string {
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
  }).format(Math.round(tyVnd));
}

/** SWR fetcher — throw on HTTP error để SWR retry */
const swrFetcher = (url: string) =>
  fetch(url, { signal: AbortSignal.timeout(30_000) }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export default function DashboardPage() {
  const { isVip } = useSubscription();
  const isDashboardLocked = !isVip;

  /* ── Hydration guard: chỉ render data-dependent content sau khi mount ── */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /* ── SWR config chung: giữ data cũ, không gọi lại khi chuyển tab ── */
  const swrOpts = {
    keepPreviousData: true,
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
    refreshInterval: 60_000,
  };

  /* ── 3 SWR hooks song song ── */
  const {
    data,
    isLoading: loadingMarket,
    isValidating: validatingMarket,
    mutate: mutateMarket,
  } = useSWR<MarketData>("/api/market", swrFetcher, swrOpts);

  const {
    data: overview,
    isLoading: loadingOverview,
    mutate: mutateOverview,
  } = useSWR<MarketOverview>("/api/market-overview", swrFetcher, {
    ...swrOpts,
    errorRetryCount: 3,
    errorRetryInterval: 3000,
  });

  /* ── Derived state ── */
  const loading = !mounted || (!data && loadingMarket);
  const refreshing = mounted && !!data && validatingMarket;

  const handleRefresh = useCallback(() => {
    mutateMarket();
    mutateOverview();
  }, [mutateMarket, mutateOverview]);

  const tickerItems = useMemo(() => {
    if (!data) return [];
    return [
      { name: "VNINDEX", value: data.vnindex.value, change: data.vnindex.change, changePercent: data.vnindex.changePercent },
      { name: "VN30", value: data.vn30.value, change: data.vn30.change, changePercent: data.vn30.changePercent },
      { name: "HNX", value: data.hnx.value, change: data.hnx.change, changePercent: data.hnx.changePercent },
      ...data.globalIndices.filter((i) => !["VN-INDEX", "HNX"].includes(i.name)).map((i) => ({
        name: i.name,
        value: i.value,
        change: 0,
        changePercent: i.changePercent,
      })),
    ];
  }, [data]);

  // Thanh khoản: ưu tiên từ Python backend (đã fix)
  const liquidityDisplay = overview
    ? `${fmtLiquidity(overview.liquidity)} Tỷ VNĐ`
    : data?.totalVolume ?? "N/A";

  return (
    <MainLayout>
      {/* ═══ TICKER TAPE ═══ */}
      {loading || !data ? <TickerTapeSkeleton /> : <TickerTape items={tickerItems} />}

      <div className="p-3 md:p-5 space-y-4 w-full">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-baseline gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white dark:text-white text-slate-800">Dashboard</h1>
              <span className="text-[10px] font-bold text-emerald-400/50 uppercase tracking-widest hidden sm:inline">
                OVERVIEW
              </span>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              Tổng quan thị trường · {data?.date ?? "..."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 text-xs text-emerald-400/70 border border-emerald-500/20 px-3 py-1.5 rounded-lg bg-emerald-500/5">
              <Bot className="w-3 h-3" />
              ADN AI SYSTEM
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              loading={refreshing}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Làm mới
            </Button>
          </div>
        </div>

        {/* ═══ HERO: Chart + Gauge (7:3) ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-4">
          {/* Cột Trái: Chart + Breadth */}
          <div className="lg:col-span-6 flex flex-col gap-3">
            {!data ? (
              <>
                <VNIndexChartSkeleton />
                <MarketBreadthSkeleton />
              </>
            ) : (
              <>
                <VNIndexChart
                  data={data.chartData}
                  currentValue={data.vnindex.value}
                  changePercent={data.vnindex.changePercent}
                />
                <MarketBreadth
                  up={data.updown.up}
                  down={data.updown.down}
                  unchanged={data.updown.unchanged}
                  totalVolume={liquidityDisplay}
                />
              </>
            )}
          </div>

          {/* Cột Phải: Gauge + Market Status Card */}
          <div className="lg:col-span-4 flex flex-col gap-3">
            <LockOverlay isLocked={isDashboardLocked} message="Nâng cấp VIP để xem Đánh giá Vĩ mô">
              {/* Đồng hồ Gauge */}
              {!mounted || loadingOverview ? (
                <GaugeCardSkeleton />
              ) : (
                <GaugeCard overview={overview ?? null} />
              )}

              {/* Thẻ Trạng Thái 3D */}
              {mounted && !loadingOverview && <MarketStatusCard overview={overview ?? null} />}
            </LockOverlay>
          </div>
        </div>

        {/* ═══ AI SUMMARY ═══ */}
        {data?.aiSummary ? (
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 min-h-[80px]">
            <div className="flex items-center gap-2 mb-2">
              <Bot className="w-4 h-4 text-emerald-400" />
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                AI Nhận Định
              </span>
            </div>
            <p className="text-sm text-neutral-300 leading-relaxed italic whitespace-normal break-words">
              &ldquo;{data.aiSummary}&rdquo;
            </p>
          </div>
        ) : !data ? (
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 min-h-[80px] animate-pulse">
            <div className="h-3 w-24 bg-neutral-800 rounded mb-3" />
            <div className="space-y-2">
              <div className="h-3 w-full bg-neutral-800 rounded" />
              <div className="h-3 w-3/4 bg-neutral-800 rounded" />
            </div>
          </div>
        ) : null}

        {/* ═══ BOTTOM: News (left 2-col) | TEI + Leaders (right) ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: Morning + EOD stacked */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Suspense fallback={<MorningNewsSkeleton />}>
              <MorningNews />
            </Suspense>
            <Suspense fallback={<EveningNewsSkeleton />}>
              <EveningNews />
            </Suspense>
          </div>

          {/* Right: TEI + Top Leaders stacked */}
          <div className="flex flex-col gap-4">
            <LockOverlay isLocked={isDashboardLocked} message="Nâng cấp VIP để xem Chỉ báo Cạn Kiệt Xu Hướng">
              {!mounted ? <RPISkeleton /> : <ReversePointIndex />}
            </LockOverlay>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
 *  GaugeCard – SVG bán nguyệt nhẹ (0-10 điểm, không dùng Recharts)
 * ═══════════════════════════════════════════════════════════════════════════ */

function getScoreLabel(score: number, maxScore: number = 14): string {
  if (maxScore <= 10) {
    // Legacy 10-point scale
    if (score < 4) return "NGỦ ĐÔNG";
    if (score <= 7) return "THĂM DÒ";
    return "THIÊN THỜI";
  }
  // 14-point ADN Composite
  if (score < 6) return "NGỦ ĐÔNG";
  if (score < 11) return "THĂM DÒ";
  return "THIÊN THỜI";
}

function getScoreColor(score: number, maxScore: number = 14): string {
  if (maxScore <= 10) {
    if (score < 4) return "#ef4444";
    if (score <= 7) return "#f97316";
    return "#a855f7";
  }
  if (score < 6) return "#ef4444";
  if (score < 11) return "#f97316";
  return "#a855f7";
}

function GaugeSVG({ score, maxScore }: { score: number; maxScore: number }) {
  const safe = Math.max(0, Math.min(maxScore, score));
  const color = getScoreColor(safe, maxScore);
  const cx = 150, cy = 125, r = 90;
  const SEGS = 60;

  // Color stops: red(0) → orange → yellow → purple(maxScore)
  const STOPS: [number, [number, number, number]][] = [
    [0.0, [239, 68, 68]],   // #ef4444
    [0.30, [249, 115, 22]], // #f97316
    [0.60, [234, 179, 8]],  // #eab308
    [0.80, [168, 85, 247]], // #a855f7
    [1.0, [139, 92, 246]],  // #8b5cf6
  ];

  function lerpColor(t: number): string {
    const c = Math.max(0, Math.min(1, t));
    for (let i = 0; i < STOPS.length - 1; i++) {
      const [t0, c0] = STOPS[i];
      const [t1, c1] = STOPS[i + 1];
      if (c >= t0 && c <= t1) {
        const f = (c - t0) / (t1 - t0);
        return `rgb(${Math.round(c0[0] + (c1[0] - c0[0]) * f)},${Math.round(c0[1] + (c1[1] - c0[1]) * f)},${Math.round(c0[2] + (c1[2] - c0[2]) * f)})`;
      }
    }
    const last = STOPS[STOPS.length - 1][1];
    return `rgb(${last[0]},${last[1]},${last[2]})`;
  }

  // Build tiny arc segments
  const arcs: { d: string; color: string }[] = [];
  for (let i = 0; i < SEGS; i++) {
    const sf = i / SEGS;
    const ef = (i + 1) / SEGS;
    const sa = Math.PI - sf * Math.PI;
    const ea = Math.PI - ef * Math.PI;
    const x1 = cx + r * Math.cos(sa);
    const y1 = cy - r * Math.sin(sa);
    const x2 = cx + r * Math.cos(ea);
    const y2 = cy - r * Math.sin(ea);
    arcs.push({
      d: `M ${x1} ${y1} A ${r} ${r} 0 0 0 ${x2} ${y2}`,
      color: lerpColor((sf + ef) / 2),
    });
  }

  // Needle — use maxScore instead of hardcoded 10
  const needleAngle = Math.PI - (safe / maxScore) * Math.PI;
  const needleLen = r * 0.75;
  const nx = cx + needleLen * Math.cos(needleAngle);
  const ny = cy - needleLen * Math.sin(needleAngle);

  // Tick labels: 0, mid, max
  const mid = Math.round(maxScore / 2);
  const ticks = [0, mid, maxScore];

  return (
    <svg viewBox="0 0 300 155" className="w-full max-w-[280px]">
      {/* Smooth gradient arc via many tiny segments */}
      {arcs.map((seg, i) => (
        <path key={i} d={seg.d} fill="none" stroke={seg.color} strokeWidth="18"
          strokeLinecap={i === 0 || i === SEGS - 1 ? "round" : "butt"} opacity={0.85} />
      ))}
      {/* Tick labels */}
      {ticks.map((t) => {
        const a = Math.PI - (t / maxScore) * Math.PI;
        const lx = cx + (r + 16) * Math.cos(a);
        const ly = cy - (r + 16) * Math.sin(a);
        return (
          <text key={t} x={lx} y={ly} textAnchor="middle" dominantBaseline="central" fill="#6b7280" fontSize="11" fontWeight="600">
            {t}
          </text>
        );
      })}
      {/* Needle */}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={color} strokeWidth="3" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
      <circle cx={cx} cy={cy} r="6" fill={color} />
      <circle cx={cx} cy={cy} r="3" fill="#0a0a0a" />
    </svg>
  );
}

const GaugeCard = memo(function GaugeCard({ overview }: { overview: MarketOverview | null }) {
  const score = overview?.score ?? 0;
  const maxScore = overview?.max_score ?? 14;
  const liquidity = overview?.liquidity ?? 0;
  const color = getScoreColor(score, maxScore);
  const label = getScoreLabel(score, maxScore);
  const taScore = overview?.ta_score;
  const valScore = overview?.valuation_score;

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-4 sm:p-5 flex flex-col items-center transform-gpu will-change-transform hover:border-neutral-700 hover:shadow-lg hover:shadow-neutral-900/50 transition-all duration-300">
      {/* Header */}
      <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-2 self-start">
        ADN Composite Score (W/M + Định giá)
      </p>

      {/* Đồng hồ SVG */}
      {overview ? (
        <>
          <GaugeSVG score={score} maxScore={maxScore} />
          <div className="flex flex-col items-center gap-2 -mt-1">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black" style={{ color, textShadow: `0 0 16px ${color}40` }}>
                {score}
              </span>
              <span className="text-[11px] font-bold text-neutral-400">/ {maxScore}</span>
            </div>
            <div
              className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
              style={{ color, backgroundColor: `${color}15`, border: `1px solid ${color}40` }}
            >
              {label}
            </div>
            {/* Score breakdown */}
            {(taScore != null || valScore != null) && (
              <div className="flex gap-3 text-[10px] text-neutral-500 mt-1">
                {taScore != null && <span>TA: <span className="text-neutral-300 font-bold">{taScore}/10</span></span>}
                {valScore != null && <span>Định giá: <span className="text-neutral-300 font-bold">{valScore}/4</span></span>}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="h-[180px] w-full rounded-xl bg-neutral-800/50 animate-pulse" />
      )}

      {/* Thanh khoản */}
      {overview && (
        <p className="text-xs text-neutral-400 mt-3">
          Thanh khoản: <span className="font-bold text-neutral-200">{fmtLiquidity(liquidity)} Tỷ VNĐ</span>
        </p>
      )}
    </div>
  );
});

function GaugeCardSkeleton() {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 sm:p-5 flex flex-col items-center">
      <div className="h-3 w-32 bg-neutral-800 rounded animate-pulse mb-3 self-start" />
      <div className="h-[140px] w-full rounded-xl bg-neutral-800/50 animate-pulse" />
      <div className="mt-3 w-20 h-6 rounded-full bg-neutral-800 animate-pulse" />
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
 *  MarketStatusCard – Thẻ trạng thái 3D nổi khối + Backlight Glow
 *  Bọc React.memo để tránh re-render gây lag
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Cấu hình màu + icon theo Level */
const LEVEL_CONFIG = {
  1: {
    border: "border-red-900 hover:border-red-500/50",
    shadow: "hover:shadow-[0_0_40px_-10px_rgba(239,68,68,0.7)]",
    text: "text-red-500",
    bg: "bg-red-500/5",
    glow: "bg-red-500/20",
    Icon: ShieldAlert,
  },
  2: {
    border: "border-orange-900 hover:border-orange-500/50",
    shadow: "hover:shadow-[0_0_40px_-10px_rgba(245,158,11,0.7)]",
    text: "text-orange-500",
    bg: "bg-orange-500/5",
    glow: "bg-orange-500/20",
    Icon: Zap,
  },
  3: {
    border: "border-purple-900 hover:border-purple-500/50",
    shadow: "hover:shadow-[0_0_40px_-10px_rgba(168,85,247,0.7)]",
    text: "text-purple-500",
    bg: "bg-purple-500/5",
    glow: "bg-purple-500/20",
    Icon: Flame,
  },
} as const;

const MarketStatusCard = memo(function MarketStatusCard({
  overview,
}: {
  overview: MarketOverview | null;
}) {
  const level = overview?.level ?? 1;
  const score = overview?.score ?? 0;
  const maxScore = overview?.max_score ?? 14;
  const statusBadge = overview?.status_badge ?? "🔴 NGỦ ĐÔNG";
  const breadth = overview?.market_breadth ?? "Không có dữ liệu";
  const highlights = overview?.technical_highlights;
  const monthlySummary = overview?.monthly_summary ?? highlights?.monthly ?? "";
  const weeklySummary = overview?.weekly_summary ?? highlights?.weekly ?? "";
  const valuationSummary = overview?.valuation_summary ?? highlights?.valuation ?? "";
  const actionMessage = overview?.action_message ?? "Đang tải dữ liệu...";
  const disclaimer = overview?.disclaimer ?? "";
  const navAllocation = overview?.nav_allocation;
  const marginAllowed = overview?.margin_allowed;

  const cfg = LEVEL_CONFIG[level as 1 | 2 | 3] ?? LEVEL_CONFIG[1];
  const { Icon } = cfg;

  return (
    <div
      className={`
        relative overflow-hidden rounded-2xl bg-gray-900 border
        transition-all duration-300 ease-out cursor-pointer
        transform-gpu will-change-transform
        hover:-translate-y-2 hover:scale-[1.02]
        ${cfg.border} ${cfg.shadow}
      `}
    >
      {/* Backlight glow */}
      <div
        className={`absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl opacity-30 ${cfg.glow}`}
      />

      <div className="relative z-10 p-4 sm:p-5">
        {/* Header: Icon + Badge */}
        <div className="flex items-center justify-between mb-3">
          <div className={`p-2 rounded-xl ${cfg.bg}`}>
            <Icon className={`w-5 h-5 ${cfg.text}`} />
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
            {statusBadge.replace(/🟢|🟡|🔴/g, "").trim()}
          </span>
        </div>

        {/* Score */}
        <div className="flex items-baseline gap-2 mb-2">
          <span className={`text-3xl sm:text-4xl font-black ${cfg.text}`}>
            {score}
          </span>
          <span className="text-sm text-gray-500 font-bold">/ {maxScore}</span>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${cfg.text}`}>
            Level {level}
          </span>
        </div>

        {/* NAV Allocation */}
        {navAllocation && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] text-gray-500">NAV:</span>
            <span className={`text-[11px] font-bold ${cfg.text}`}>{navAllocation}</span>
            {marginAllowed && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">
                MARGIN OK
              </span>
            )}
          </div>
        )}

        {/* Market Breadth */}
        <p className="text-[11px] text-gray-500 mb-3">
          📊 {breadth}
        </p>

        {/* Action Message */}
        <p className="text-sm text-gray-400 leading-relaxed italic">
          &ldquo;{actionMessage}&rdquo;
        </p>

        {/* Disclaimer */}
        {disclaimer && (
          <p className="text-[9px] text-gray-600 mt-2">
            {disclaimer}
          </p>
        )}
      </div>
    </div>
  );
});

"use client";

import { useEffect, useState, useMemo, useCallback, memo, Suspense, Component, type ReactNode } from "react";
import Link from "next/link";
import { RefreshCw, Bot, Zap, ShieldAlert, Flame, TrendingUp, TrendingDown } from "lucide-react";
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
import { useTopic } from "@/hooks/useTopic";
import { BRAND, PRODUCT_NAMES } from "@/lib/brand/productNames";
import { classifyTickerSector } from "@/lib/market/sector-classification";
import { formatPercent, formatPrice, getRsBgStyle, getRsColor, getRsLabel } from "@/lib/utils";

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

interface EodBriefData {
  liquidity?: number | string | null;
  liquidity_detail?: string | null;
  liquidity_by_exchange?: {
    HOSE?: number | string | null;
    HNX?: number | string | null;
    UPCOM?: number | string | null;
    total?: number | string | null;
  } | null;
}

type SignalActivePayload = {
  id: string;
};

type HistoricalCandle = {
  date?: string;
  timestamp?: string;
  time?: string;
  close?: number | string;
  c?: number | string;
};

type HistoricalPayload = {
  data?: HistoricalCandle[];
  candles?: HistoricalCandle[];
  items?: HistoricalCandle[];
};

type RsRatingStock = {
  symbol?: string;
  ticker?: string;
  name?: string;
  sector?: string;
  rsRating?: number;
  rsScore?: number;
  volume?: number;
  price?: number;
  change?: number;
  changePercent?: number;
};

type RsRatingPayload = {
  stocks?: RsRatingStock[];
  data?: RsRatingStock[];
  items?: RsRatingStock[];
};

type PulseRankRow = {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  changePercent: number;
  rs: number;
  volume: number;
};

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

function parseLiquidityFromDisplay(value: string | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(/,/g, ".");
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function parseNumberishLiquidity(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value !== "string") return null;
  return parseLiquidityFromDisplay(value);
}

function parseTotalLiquidityFromDetail(detail: string | null | undefined): number | null {
  if (!detail) return null;
  const totalMatch =
    detail.match(/toàn thị trường đạt\s*([\d.,]+)/i) ??
    detail.match(/tổng\s*([\d.,]+)\s*tỷ/i) ??
    detail.match(/thanh khoản[^0-9]{0,24}([\d.,]+)/i);
  if (!totalMatch?.[1]) return null;
  return parseLiquidityFromDisplay(totalMatch[1]);
}

function parseExchangeLiquidityTotal(
  exchanges: EodBriefData["liquidity_by_exchange"],
): number | null {
  if (!exchanges) return null;
  const hose = parseNumberishLiquidity(exchanges.HOSE);
  const hnx = parseNumberishLiquidity(exchanges.HNX);
  const upcom = parseNumberishLiquidity(exchanges.UPCOM);
  if (hose != null && hnx != null && upcom != null) {
    return hose + hnx + upcom;
  }
  return parseNumberishLiquidity(exchanges.total);
}

function parseExchangeLiquidityTotalFromDetail(detail: string | null | undefined): number | null {
  if (!detail) return null;
  const hose = detail.match(/HoSE\s*([\d.,]+)/i)?.[1];
  const hnx = detail.match(/HNX\s*([\d.,]+)/i)?.[1];
  const upcom = detail.match(/UPCoM\s*([\d.,]+)/i)?.[1] ?? detail.match(/UPCOM\s*([\d.,]+)/i)?.[1];
  const values = [hose, hnx, upcom].map((value) => parseLiquidityFromDisplay(value));
  if (values.every((value): value is number => value != null && Number.isFinite(value))) {
    return values.reduce((sum, value) => sum + value, 0);
  }
  return null;
}

function cleanStatusBadge(value: string): string {
  return value
    .replace(/[🟢🟡🔴]/gu, "")
    .replace(/\u00f0\u0178\u0178\u00a2|\u00f0\u0178\u0178\u00a1|\u00f0\u0178\u201d\u00b4/g, "")
    .trim();
}

function readFiniteNumber(value: unknown): number | null {
  const numberValue = typeof value === "string" ? Number(value.replace(/,/g, "")) : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function getHistoricalRows(payload: HistoricalPayload | null | undefined): HistoricalCandle[] {
  const rows = payload?.data ?? payload?.candles ?? payload?.items ?? [];
  return Array.isArray(rows) ? rows : [];
}

function normalizeVNIndexChartData(payload: HistoricalPayload | null | undefined) {
  return getHistoricalRows(payload)
    .map((row) => {
      const close = readFiniteNumber(row.close ?? row.c);
      const rawDate = String(row.date ?? row.timestamp ?? row.time ?? "").trim();
      const date = rawDate.split("T")[0].split(" ")[0];
      return close != null && close > 0 && date ? { date, close } : null;
    })
    .filter((row): row is { date: string; close: number } => Boolean(row))
    .slice(-30);
}

function getRsRows(payload: RsRatingPayload | null | undefined): RsRatingStock[] {
  const rows = payload?.stocks ?? payload?.data ?? payload?.items ?? [];
  return Array.isArray(rows) ? rows : [];
}

/** Component-level error boundary — hiện skeleton thay vì crash toàn trang */
class SafeSection extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.error("[Dashboard SafeSection]", err?.message);
  }
  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Không thể tải phần này</p>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

function FreshnessPill({ label, freshness }: { label: string; freshness: string | null }) {
  const state = (freshness ?? "unknown").toLowerCase();
  const isFresh = state === "fresh";
  const isStale = state === "stale";
  const text = isFresh ? "Fresh" : isStale ? "Stale" : state.toUpperCase();
  const style = isFresh
    ? { color: "#16a34a", borderColor: "rgba(22,163,74,0.25)", background: "rgba(22,163,74,0.10)" }
    : isStale
      ? { color: "#f59e0b", borderColor: "rgba(245,158,11,0.25)", background: "rgba(245,158,11,0.10)" }
      : { color: "var(--danger)", borderColor: "rgba(192,57,43,0.25)", background: "rgba(192,57,43,0.10)" };
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={style}>
      <span>{label}</span>
      <span>· {text}</span>
    </span>
  );
}

export default function DashboardPage() {
  const { isVip } = useSubscription();
  const isDashboardLocked = !isVip;

  /* ── Hydration guard: chỉ render data-dependent content sau khi mount ── */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /* ── DataHub topic hooks ── */
  const marketOverviewTopic = useTopic<MarketData>("vn:index:overview", {
    refreshInterval: 60_000,
    revalidateOnFocus: false,
    dedupingInterval: 15_000,
  });
  const marketCompositeCacheTopic = useTopic<MarketOverview>("vn:index:composite", {
    refreshInterval: 60_000,
    revalidateOnFocus: false,
    dedupingInterval: 15_000,
  });
  const marketCompositeLiveTopic = useTopic<MarketOverview>("vn:index:composite:live", {
    refreshInterval: 300_000,
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });
  const eodTopic = useTopic<EodBriefData>("brief:eod:latest", {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });
  const activeSignalsTopic = useTopic<SignalActivePayload[]>("signal:market:active", {
    refreshInterval: 60_000,
    revalidateOnFocus: false,
    dedupingInterval: 15_000,
  });
  const vnIndexHistoryTopic = useTopic<HistoricalPayload>("vn:index:chart:30d", {
    refreshInterval: 300_000,
    revalidateOnFocus: false,
    dedupingInterval: 120_000,
    timeoutMs: 5_000,
  });
  const rsRatingTopic = useTopic<RsRatingPayload>("research:rs-rating:list", {
    refreshInterval: 900_000,
    revalidateOnFocus: false,
    dedupingInterval: 300_000,
    timeoutMs: 5_000,
  });

  const data = marketOverviewTopic.data;
  const marketStatus = marketCompositeCacheTopic.data;
  const overview = marketCompositeLiveTopic.data;
  const eodBrief = eodTopic.data;

  // Dùng overview nếu có (đầy đủ), fallback về marketStatus (từ cache)
  const effectiveOverview = overview ?? marketStatus ?? null;


  /* ── Derived state ── */
  const loading = !mounted || (!data && marketOverviewTopic.isLoading);
  const refreshing = mounted && !!data && (marketOverviewTopic.isValidating || vnIndexHistoryTopic.isValidating);

  const handleRefresh = useCallback(() => {
    void marketOverviewTopic.refresh(true);
    void marketCompositeCacheTopic.refresh(true);
    void marketCompositeLiveTopic.refresh(true);
    void eodTopic.refresh(true);
    void vnIndexHistoryTopic.refresh(true);
    void rsRatingTopic.refresh(true);
  }, [marketOverviewTopic, marketCompositeCacheTopic, marketCompositeLiveTopic, eodTopic, vnIndexHistoryTopic, rsRatingTopic]);

  const tickerItems = useMemo(() => {
    if (!data) return [];
    const gi = Array.isArray(data.globalIndices) ? data.globalIndices : [];
    return [
      { name: "VNINDEX", value: data.vnindex?.value ?? 0, change: data.vnindex?.change ?? 0, changePercent: data.vnindex?.changePercent ?? 0 },
      { name: "VN30", value: data.vn30?.value ?? 0, change: data.vn30?.change ?? 0, changePercent: data.vn30?.changePercent ?? 0 },
      { name: "HNX", value: data.hnx?.value ?? 0, change: data.hnx?.change ?? 0, changePercent: data.hnx?.changePercent ?? 0 },
      ...gi.filter((i) => !["VN-INDEX", "HNX"].includes(i.name)).map((i) => ({
        name: i.name,
        value: i.value,
        change: 0,
        changePercent: i.changePercent,
      })),
    ];
  }, [data]);

  const fastChartData = useMemo(
    () => normalizeVNIndexChartData(vnIndexHistoryTopic.data),
    [vnIndexHistoryTopic.data],
  );

  const dashboardChartData = fastChartData.length > 0 ? fastChartData : data?.chartData ?? [];
  const dashboardChartCurrentValue =
    dashboardChartData.length > 0
      ? dashboardChartData[dashboardChartData.length - 1].close
      : data?.vnindex?.value ?? 0;
  const dashboardChartChangePercent =
    dashboardChartData.length > 1
      ? ((dashboardChartData[dashboardChartData.length - 1].close - dashboardChartData[dashboardChartData.length - 2].close) /
          Math.max(1, dashboardChartData[dashboardChartData.length - 2].close)) *
        100
      : data?.vnindex?.changePercent ?? 0;

  const topRankRows = useMemo(() => {
    const rows = getRsRows(rsRatingTopic.data)
      .map((row) => {
        const ticker = String(row.symbol ?? row.ticker ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        const rs = readFiniteNumber(row.rsRating ?? row.rsScore) ?? 0;
        const volume = readFiniteNumber(row.volume) ?? 0;
        const price = readFiniteNumber(row.price) ?? 0;
        const changePercent = readFiniteNumber(row.changePercent) ?? 0;
        const name = String(row.name ?? ticker).trim() || ticker;
        const sector = classifyTickerSector(ticker, String(row.sector ?? ""));
        return ticker && rs > 0 ? { ticker, rs, volume, price, changePercent, name, sector } : null;
      })
      .filter((row): row is PulseRankRow => Boolean(row));
    const liquidRows = rows.filter((row) => row.volume > 0);
    return (liquidRows.length > 0 ? liquidRows : rows)
      .sort((a, b) => b.rs - a.rs || b.volume - a.volume || b.price - a.price)
      .slice(0, 6);
  }, [rsRatingTopic.data]);

  // Liquidity ưu tiên tổng HoSE + HNX + UPCOM khi đủ dữ liệu.
  const effectiveLiquidityTy = useMemo(() => {
    const eodLiquidity =
      parseExchangeLiquidityTotal(eodBrief?.liquidity_by_exchange) ??
      parseExchangeLiquidityTotalFromDetail(eodBrief?.liquidity_detail) ??
      parseNumberishLiquidity(eodBrief?.liquidity) ??
      parseTotalLiquidityFromDetail(eodBrief?.liquidity_detail);
    const parsedFromDisplay = parseLiquidityFromDisplay(data?.totalVolume);
    const candidates = [
      eodLiquidity,
      overview?.liquidity && Number.isFinite(overview.liquidity) && overview.liquidity > 0 ? overview.liquidity : null,
      parsedFromDisplay,
    ].filter((value): value is number => value != null && Number.isFinite(value) && value > 0);
    if (candidates.length === 0) return null;
    return Math.max(...candidates);
  }, [eodBrief?.liquidity, eodBrief?.liquidity_by_exchange, eodBrief?.liquidity_detail, overview?.liquidity, data?.totalVolume]);

  const liquidityDisplay = effectiveLiquidityTy != null ? `${fmtLiquidity(effectiveLiquidityTy)} Tỷ VNĐ` : data?.totalVolume ?? "N/A";

  return (
    <MainLayout>
      {/* ═══ TICKER TAPE ═══ */}
      {loading || !data ? <TickerTapeSkeleton /> : <TickerTape items={tickerItems} />}

      <div className="w-full min-w-0 overflow-x-hidden space-y-4 px-3 md:px-5 xl:px-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-baseline gap-2">
              <h1 className="text-xl sm:text-2xl font-black" style={{ color: "var(--text-primary)" }}>
                {PRODUCT_NAMES.dashboard}
              </h1>
              <span
                className="text-[12px] font-bold uppercase tracking-widest hidden sm:inline"
                style={{ color: "var(--text-muted)" }}
              >
                OVERVIEW
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
              Tổng quan thị trường · {data?.date ?? "..."}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <FreshnessPill label="Market" freshness={marketOverviewTopic.freshness} />
              <FreshnessPill label="Brief" freshness={eodTopic.freshness} />
              <FreshnessPill label="Signal" freshness={activeSignalsTopic.freshness} />
            </div>
          </div>
          <div className="flex items-center gap-2">
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

        {/* ═══ HERO: Chart + ADNCore ═══ */}
        <div className="grid w-full min-w-0 grid-cols-1 lg:grid-cols-10 gap-4">
          {/* Cột Trái: Chart + Breadth */}
          <div className="lg:col-span-6 w-full min-w-0 flex flex-col gap-3">
            <SafeSection fallback={<><VNIndexChartSkeleton /><MarketBreadthSkeleton /></>}>
              {dashboardChartData.length > 0 ? (
                <VNIndexChart
                  data={dashboardChartData}
                  currentValue={dashboardChartCurrentValue}
                  changePercent={dashboardChartChangePercent}
                />
              ) : (
                <VNIndexChartSkeleton />
              )}
              {data ? (
                <MarketBreadth
                  up={data.updown?.up ?? 0}
                  down={data.updown?.down ?? 0}
                  unchanged={data.updown?.unchanged ?? 0}
                  totalVolume={liquidityDisplay}
                />
              ) : (
                <MarketBreadthSkeleton />
              )}
            </SafeSection>
          </div>

          {/* Cột Phải: Gauge + Market Status Card */}
          <div className="lg:col-span-4 w-full min-w-0 flex flex-col gap-3">
            <LockOverlay isLocked={isDashboardLocked} message="Nâng cấp VIP để xem đánh giá thị trường">
              <SafeSection fallback={<GaugeCardSkeleton />}>
                {/* Đồng hồ Gauge */}
                {!mounted ? (
                  <GaugeCardSkeleton />
                ) : (
                  <GaugeCard 
                    overview={effectiveOverview} 
                    marketData={data ?? null}
                  />
                )}

                {/* Thẻ Trạng Thái 3D */}
                {mounted && (effectiveOverview || data) && (
                  <MarketStatusCard 
                    overview={effectiveOverview} 
                    marketData={data ?? null}
                  />
                )}
              </SafeSection>
            </LockOverlay>
          </div>
        </div>

        {/* ═══ AIDEN: Compact full-width decision under market breadth ═══ */}
        <LockOverlay isLocked={isDashboardLocked} message={`Nâng cấp VIP để mở nhận định ${BRAND.persona}`}>
          <AIBrokerDecisionCard
            summary={data?.aiSummary ?? null}
            signalLabel={effectiveOverview?.action_message ?? null}
            compact
          />
        </LockOverlay>

        {/* ═══ BOTTOM: Morning + EOD + ART/Rank ═══ */}
        <div className="grid w-full min-w-0 grid-cols-1 xl:grid-cols-3 gap-4 items-start">
          <SafeSection fallback={<MorningNewsSkeleton />}>
            <Suspense fallback={<MorningNewsSkeleton />}>
              <MorningNews />
            </Suspense>
          </SafeSection>

          <SafeSection fallback={<EveningNewsSkeleton />}>
            <Suspense fallback={<EveningNewsSkeleton />}>
              <EveningNews />
            </Suspense>
          </SafeSection>

          <div className="flex min-w-0 flex-col gap-4">
            <LockOverlay isLocked={isDashboardLocked} message={`Nâng cấp VIP để xem ${PRODUCT_NAMES.art}`}>
              <SafeSection fallback={<RPISkeleton />}>
                {!mounted ? <RPISkeleton /> : <ReversePointIndex />}
              </SafeSection>
            </LockOverlay>

            <LockOverlay isLocked={isDashboardLocked} message={`Nâng cấp VIP để xem ${PRODUCT_NAMES.rank}`}>
              <ADNRankMiniCard rows={topRankRows} />
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
  // 14-point ADNCore
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

const GaugeCard = memo(function GaugeCard({
  overview,
  marketData,
}: {
  overview: MarketOverview | null;
  marketData: MarketData | null;
}) {
  const fallbackScore = !overview && marketData ? (marketData.status === "GOOD" ? 11 : marketData.status === "BAD" ? 2 : 6) : 0;
  const score = overview?.score ?? fallbackScore;
  const maxScore = overview?.max_score ?? 14;
  const color = getScoreColor(score, maxScore);
  const label = getScoreLabel(score, maxScore);

  return (
    <div
      className="w-full min-w-0 rounded-2xl p-4 sm:p-5 flex flex-col items-center transition-all duration-300"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <p
        className="text-[12px] font-bold uppercase tracking-wider mb-2 self-start"
        style={{ color: "var(--text-muted)" }}
      >
        ADNCore - Chấm điểm thị trường
      </p>

      {overview ? (
        <>
          <GaugeSVG score={score} maxScore={maxScore} />
          <div className="flex flex-col items-center gap-2 -mt-1">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black" style={{ color, textShadow: `0 0 16px ${color}40` }}>
                {score}
              </span>
              <span className="text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>/ {maxScore}</span>
            </div>
            <div
              className="px-3 py-1 rounded-full text-[12px] font-bold uppercase tracking-wider"
              style={{ color, backgroundColor: `${color}15`, border: `1px solid ${color}40` }}
            >
              {label}
            </div>
          </div>
        </>
      ) : (
        <div
          className="h-[180px] w-full rounded-xl animate-pulse"
          style={{ background: "var(--bg-hover)" }}
        />
      )}

      {overview && (
        <p className="text-xs mt-3 text-center" style={{ color: "var(--text-secondary)" }}>
          Điểm tổng hợp trạng thái thị trường.
        </p>
      )}
    </div>
  );
});

function GaugeCardSkeleton() {
  return (
    <div
      className="w-full min-w-0 rounded-2xl p-4 sm:p-5 flex flex-col items-center"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="h-3 w-32 rounded animate-pulse mb-3 self-start" style={{ background: "var(--bg-hover)" }} />
      <div className="h-[140px] w-full rounded-xl animate-pulse" style={{ background: "var(--bg-hover)" }} />
      <div className="mt-3 w-20 h-6 rounded-full animate-pulse" style={{ background: "var(--bg-hover)" }} />
    </div>
  );
}


const AIBrokerDecisionCard = memo(function AIBrokerDecisionCard({
  summary,
  signalLabel,
  compact = false,
}: {
  summary: string | null;
  signalLabel: string | null;
  compact?: boolean;
}) {
  const decision = (signalLabel || summary || "GIU").toUpperCase();
  const isBuy = decision.includes("MUA");
  const isSell = decision.includes("BAN") || decision.includes("BÁN");

  const badgeColor = isBuy ? "#16a34a" : isSell ? "#ef4444" : "#f59e0b";
  const badgeLabel = isBuy
    ? `${PRODUCT_NAMES.brokerWorkflow}: MUA`
    : isSell
      ? `${PRODUCT_NAMES.brokerWorkflow}: BÁN`
      : `${PRODUCT_NAMES.brokerWorkflow}: GIỮ`;

  return (
    <div className={`rounded-2xl border ${compact ? "p-4" : "p-4 sm:p-5"}`} style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4" style={{ color: "#16a34a" }} />
          <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Nhận định {BRAND.persona}
          </span>
        </div>
        <span className="text-[11px] font-black px-2 py-1 rounded-full border" style={{ color: badgeColor, borderColor: `${badgeColor}55`, background: `${badgeColor}1A` }}>
          {badgeLabel}
        </span>
      </div>
      <p className={`text-sm leading-relaxed ${compact ? "line-clamp-2 sm:line-clamp-3" : ""}`} style={{ color: "var(--text-primary)" }}>
        {summary || "AIDEN đang đọc dữ liệu thị trường, ưu tiên giữ tỷ trọng an toàn."}
      </p>
    </div>
  );
});

function ADNRankMiniCard({ rows }: { rows: PulseRankRow[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 px-4 pt-4">
          <div className="rounded-xl border p-2" style={{ background: "rgba(22,163,74,0.10)", borderColor: "rgba(22,163,74,0.25)" }}>
            <TrendingUp className="h-4 w-4" style={{ color: "#16a34a" }} />
          </div>
          <div>
            <span className="block text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              ADN Rank
            </span>
            <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
              Sức mạnh tương đối & thanh khoản
            </span>
          </div>
        </div>
        <Link
          href="/rs-rating"
          className="mr-4 mt-4 rounded-full border px-2.5 py-1 text-[11px] font-bold transition hover:-translate-y-0.5"
          style={{ color: "var(--primary)", borderColor: "var(--border)", background: "var(--surface-2)" }}
        >
          Xem thêm
        </Link>
      </div>
      <div className="overflow-x-auto">
        {rows.length > 0 ? (
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="border-y text-[10px] uppercase tracking-wider" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                <th className="px-4 py-2 text-left font-bold">#</th>
                <th className="px-3 py-2 text-left font-bold">Mã CK</th>
                <th className="px-3 py-2 text-right font-bold">Giá</th>
                <th className="px-3 py-2 text-right font-bold">%</th>
                <th className="px-3 py-2 text-center font-bold">ADN Rank</th>
                <th className="px-3 py-2 text-center font-bold">Nhãn</th>
                <th className="px-4 py-2 text-left font-bold">Ngành</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const rs = Math.round(row.rs);
                const positive = row.changePercent >= 0;
                return (
                  <tr key={row.ticker} className="border-b" style={{ borderColor: "var(--border)" }}>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: "var(--text-muted)" }}>{index + 1}</td>
                    <td className="px-3 py-3">
                      <div className="font-mono text-sm font-black" style={{ color: "var(--text-primary)" }}>{row.ticker}</div>
                      <div className="max-w-[120px] truncate text-[11px]" style={{ color: "var(--text-muted)" }}>{row.name}</div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                      {row.price > 0 ? formatPrice(row.price) : "-"}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="inline-flex items-center justify-end gap-1 text-xs font-bold" style={{ color: positive ? "#16a34a" : "var(--danger)" }}>
                        {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {formatPercent(row.changePercent)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col items-center gap-1">
                        <span className="rounded-lg border px-2 py-0.5 font-mono text-xs font-black" style={getRsBgStyle(rs)}>
                          <span style={{ color: getRsColor(rs) }}>{rs}</span>
                        </span>
                        <span className="h-1 w-16 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
                          <span
                            className="block h-full rounded-full"
                            style={{ width: `${Math.max(0, Math.min(100, rs))}%`, background: getRsColor(rs) }}
                          />
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="rounded-lg border px-2 py-1 text-[10px] font-black uppercase" style={{ ...getRsBgStyle(rs), color: getRsColor(rs) }}>
                        {getRsLabel(rs)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>{row.sector}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="mx-4 mb-4 rounded-xl px-3 py-4 text-sm" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
            Đang đồng bộ bảng xếp hạng sức mạnh.
          </div>
        )}
      </div>
    </div>
  );
}
/* ═══════════════════════════════════════════════════════════════════════════
 *  MarketStatusCard – Thẻ trạng thái 3D nổi khối + Backlight Glow
 *  Bọc React.memo để tránh re-render gây lag
 * ═══════════════════════════════════════════════════════════════════════════ */

// Level color config using raw hex — no Tailwind color classes
const LEVEL_CONFIG = {
  1: {
    color: "#ef4444",
    bgRgba: "rgba(239,68,68,0.06)",
    borderRgba: "rgba(239,68,68,0.20)",
    shadowRgba: "rgba(239,68,68,0.40)",
    Icon: ShieldAlert,
  },
  2: {
    color: "#f59e0b",
    bgRgba: "rgba(245,158,11,0.06)",
    borderRgba: "rgba(245,158,11,0.20)",
    shadowRgba: "rgba(245,158,11,0.40)",
    Icon: Zap,
  },
  3: {
    color: "#a855f7",
    bgRgba: "rgba(168,85,247,0.06)",
    borderRgba: "rgba(168,85,247,0.20)",
    shadowRgba: "rgba(168,85,247,0.40)",
    Icon: Flame,
  },
} as const;

const MarketStatusCard = memo(function MarketStatusCard({
  overview,
  marketData,
}: {
  overview: MarketOverview | null;
  marketData: MarketData | null;
}) {
  const fallbackScore = !overview && marketData ? (marketData.status === "GOOD" ? 11 : marketData.status === "BAD" ? 2 : 6) : 0;
  const fallbackLevel = !overview && marketData ? (marketData.status === "GOOD" ? 3 : marketData.status === "BAD" ? 1 : 2) : 1;
  const level = (overview?.level ?? fallbackLevel) as 1 | 2 | 3;
  const score = overview?.score ?? fallbackScore;
  const maxScore = overview?.max_score ?? 14;
  const statusBadge = overview?.status_badge ?? (marketData?.status === "GOOD" ? "🟢 THIÊN THỜI" : marketData?.status === "BAD" ? "🔴 NGỦ ĐÔNG" : "🟡 THĂM DÒ");
  const breadth = overview?.market_breadth ?? (marketData ? `Tăng: ${marketData.updown?.up ?? 0} | Giảm: ${marketData.updown?.down ?? 0} | Không đổi: ${marketData.updown?.unchanged ?? 0}` : "Không có dữ liệu");
  const highlights = overview?.technical_highlights;
  const actionMessage = overview?.action_message ?? marketData?.aiSummary ?? "Đang phân tích thị trường...";
  const disclaimer = overview?.disclaimer ?? "";
  const navAllocation = overview?.nav_allocation;
  const marginAllowed = overview?.margin_allowed;

  const cfg = LEVEL_CONFIG[level as 1 | 2 | 3] ?? LEVEL_CONFIG[1];
  const { Icon } = cfg;

  return (
    <div
      className="relative w-full min-w-0 overflow-hidden rounded-2xl transition-all duration-300 ease-out cursor-pointer hover:-translate-y-1"
      style={{
        background: "var(--surface)",
        border: `1px solid ${cfg.borderRgba}`,
      }}
    >
      {/* Subtle glow overlay (no blur/backdrop-filter) */}
      <div
        className="absolute -top-10 -right-10 w-40 h-40 rounded-full pointer-events-none"
        style={{ background: cfg.bgRgba }}
      />

      <div className="relative z-10 p-4 sm:p-5">
        {/* Header: Icon + Badge */}
        <div className="flex items-center justify-between mb-3">
          <div className="p-2 rounded-xl" style={{ background: cfg.bgRgba }}>
            <Icon className="w-5 h-5" style={{ color: cfg.color }} />
          </div>
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ background: cfg.bgRgba, color: cfg.color, border: `1px solid ${cfg.borderRgba}` }}
          >
            {cleanStatusBadge(statusBadge)}
          </span>
        </div>

        {/* Score */}
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-3xl sm:text-4xl font-black" style={{ color: cfg.color }}>
            {score}
          </span>
          <span className="text-sm font-bold" style={{ color: "var(--text-secondary)" }}>/ {maxScore}</span>
          <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: cfg.color }}>
            Level {level}
          </span>
        </div>

        {/* NAV Allocation */}
        {navAllocation && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>NAV:</span>
            <span className="text-[11px] font-bold" style={{ color: cfg.color }}>{navAllocation}</span>
            {marginAllowed && (
              <span
                className="text-[12px] font-bold px-1.5 py-0.5 rounded"
                style={{ background: "rgba(168,85,247,0.15)", color: "#a855f7" }}
              >
                MARGIN OK
              </span>
            )}
          </div>
        )}

        {/* Market Breadth */}
        <p className="text-[11px] mb-3" style={{ color: "var(--text-secondary)" }}>
          Độ rộng thị trường: {breadth}
        </p>

        {/* Action Message */}
        <p className="text-sm leading-relaxed italic" style={{ color: "var(--text-primary)" }}>
          &ldquo;{actionMessage}&rdquo;
        </p>

        {/* Disclaimer */}
        {disclaimer && (
          <p className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>
            {disclaimer}
          </p>
        )}
      </div>
    </div>
  );
});

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, PointerEvent, ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Camera,
  ChevronDown,
  Crosshair,
  Equal,
  Expand,
  Eye,
  EyeOff,
  GitGraph,
  Lock,
  LockOpen,
  Minus,
  MousePointer2,
  MoveUpRight,
  RectangleHorizontal,
  Rows3,
  Ruler,
  Search,
  Settings,
  Slash,
  Trash2,
  Type,
  Undo2,
} from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import type { Coordinate } from "lightweight-charts";
import { DrawingsPrimitive } from "./drawing-primitives";
import type { DrawAnchor, DrawObject, DrawTool } from "./drawing-primitives";

export type ChartTimeframe = "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1D" | "1W" | "1M";

interface StockChartProps {
  symbol: string;
  exchange?: string;
  sourceLabel?: string;
  timeframe?: ChartTimeframe;
  onTimeframeChange?: (timeframe: ChartTimeframe) => void;
  onSymbolSubmit?: (symbol: string) => void;
  isLive?: boolean;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

type DrawingTool = "cursor" | "trend" | "ray" | "hline" | "vline" | "zone" | "fib" | "channel" | "text" | "measure";
type Drawing = DrawObject;

function isAnchoredDrawing(value: unknown): value is Drawing {
  if (!value || typeof value !== "object") return false;
  const anchors = (value as { anchors?: unknown }).anchors;
  return Array.isArray(anchors) && anchors.every((a) => a && typeof (a as DrawAnchor).time === "number" && typeof (a as DrawAnchor).price === "number");
}

type IndicatorId =
  | "volume"
  | "ema10"
  | "ema20"
  | "ema30"
  | "ema50"
  | "ema200"
  | "sma20"
  | "sma50"
  | "sma200"
  | "bb"
  | "macd"
  | "rsi"
  | "stoch"
  | "stochrsi";

type IndicatorMeta = {
  id: IndicatorId;
  label: string;
  group: "Trên giá" | "Panel dưới";
};

type LinePoint = { time: number; value: number };
type ChartSeriesRefs = {
  candle?: any;
  volume?: any;
  overlays: any[];
  macd?: { histogram: any; macd: any; signal: any };
  rsi?: { line: any; upper: any; lower: any };
  stoch?: { k: any; d: any; upper: any; lower: any };
  stochrsi?: { k: any; d: any; upper: any; lower: any };
  macdMarkers?: any;
  stochMarkers?: any;
  stochrsiMarkers?: any;
  drawingsPrimitive?: DrawingsPrimitive;
};

const CHART_HEIGHT_MOBILE = 520;
const CHART_HEIGHT_TABLET = 650;
const CHART_HEIGHT_DESKTOP = 780;
const TIMEFRAMES: ChartTimeframe[] = ["1m", "5m", "15m", "30m", "1h", "4h", "1D", "1W", "1M"];
const INTRADAY_TIMEFRAMES = new Set<ChartTimeframe>(["1m", "5m", "15m", "30m", "1h", "4h"]);
const DEFAULT_INDICATORS: IndicatorId[] = ["ema10", "ema30", "volume", "macd", "rsi", "stoch"];
const INDICATORS: IndicatorMeta[] = [
  { id: "ema10", label: "EMA10", group: "Trên giá" },
  { id: "ema20", label: "EMA20", group: "Trên giá" },
  { id: "ema30", label: "EMA30", group: "Trên giá" },
  { id: "ema50", label: "EMA50", group: "Trên giá" },
  { id: "ema200", label: "EMA200", group: "Trên giá" },
  { id: "sma20", label: "SMA20", group: "Trên giá" },
  { id: "sma50", label: "SMA50", group: "Trên giá" },
  { id: "sma200", label: "SMA200", group: "Trên giá" },
  { id: "bb", label: "Bollinger Bands", group: "Trên giá" },
  { id: "volume", label: "Khối lượng", group: "Panel dưới" },
  { id: "macd", label: "MACD", group: "Panel dưới" },
  { id: "rsi", label: "RSI(14)", group: "Panel dưới" },
  { id: "stoch", label: "Stoch", group: "Panel dưới" },
  { id: "stochrsi", label: "Stoch RSI", group: "Panel dưới" },
];

const INDICATOR_COLORS: Record<string, string> = {
  ema10: "#f97316",
  ema20: "#f59e0b",
  ema30: "#4ade80",
  ema50: "#38bdf8",
  ema200: "#a78bfa",
  sma20: "#facc15",
  sma50: "#60a5fa",
  sma200: "#c084fc",
};

type IndicatorSettings = {
  rsi: { period: number };
  macd: { fast: number; slow: number; signal: number };
  stoch: { period: number; smooth: number };
  stochrsi: { rsiPeriod: number; stochPeriod: number; smoothK: number; smoothD: number };
  bb: { period: number; mult: number };
};

const DEFAULT_SETTINGS: IndicatorSettings = {
  rsi: { period: 14 },
  macd: { fast: 12, slow: 26, signal: 9 },
  stoch: { period: 14, smooth: 3 },
  stochrsi: { rsiPeriod: 14, stochPeriod: 14, smoothK: 3, smoothD: 3 },
  bb: { period: 20, mult: 2 },
};

// Schema để tự sinh ô chỉnh input (kiểu hộp Settings của TradingView).
const SETTINGS_SCHEMA: Array<{
  id: keyof IndicatorSettings;
  label: string;
  fields: Array<{ key: string; label: string; min: number; max: number }>;
}> = [
  { id: "rsi", label: "RSI", fields: [{ key: "period", label: "Chu kỳ", min: 2, max: 100 }] },
  {
    id: "macd",
    label: "MACD",
    fields: [
      { key: "fast", label: "Nhanh", min: 1, max: 100 },
      { key: "slow", label: "Chậm", min: 2, max: 200 },
      { key: "signal", label: "Signal", min: 1, max: 100 },
    ],
  },
  {
    id: "stoch",
    label: "Stoch",
    fields: [
      { key: "period", label: "Chu kỳ", min: 2, max: 100 },
      { key: "smooth", label: "Mượt", min: 1, max: 50 },
    ],
  },
  {
    id: "stochrsi",
    label: "StochRSI",
    fields: [
      { key: "rsiPeriod", label: "RSI", min: 2, max: 100 },
      { key: "stochPeriod", label: "Stoch", min: 2, max: 100 },
      { key: "smoothK", label: "%K", min: 1, max: 50 },
      { key: "smoothD", label: "%D", min: 1, max: 50 },
    ],
  },
  {
    id: "bb",
    label: "Bollinger",
    fields: [
      { key: "period", label: "Chu kỳ", min: 2, max: 100 },
      { key: "mult", label: "Hệ số", min: 1, max: 5 },
    ],
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getChartHeight(width?: number) {
  const viewportWidth = width ?? (typeof window !== "undefined" ? window.innerWidth : 390);
  if (viewportWidth >= 1280) return CHART_HEIGHT_DESKTOP;
  if (viewportWidth >= 768) return CHART_HEIGHT_TABLET;
  return clamp(Math.round(viewportWidth * 1.22), 460, CHART_HEIGHT_MOBILE);
}

function formatTimeframe(value: ChartTimeframe) {
  if (value === "1D") return "D";
  if (value === "1W") return "W";
  if (value === "1M") return "M";
  return value;
}

function formatPrice(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "--";
  return value.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
}

function formatVolume(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "--";
  if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}tr`;
  if (value >= 1_000) return `${(value / 1_000).toLocaleString("vi-VN", { maximumFractionDigits: 0 })}k`;
  return value.toLocaleString("vi-VN");
}

function sanitizeCandles(candles?: Candle[]) {
  return (candles ?? [])
    .filter((c) =>
      Number.isFinite(c.time) &&
      Number.isFinite(c.open) &&
      Number.isFinite(c.high) &&
      Number.isFinite(c.low) &&
      Number.isFinite(c.close),
    )
    .sort((a, b) => a.time - b.time)
    .filter((c, index, all) => index === 0 || c.time !== all[index - 1].time);
}

function normalizeSymbolInput(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
}

function calcSMA(data: Array<{ time: number; close: number }>, period: number): LinePoint[] {
  const result: LinePoint[] = [];
  let sum = 0;
  for (let index = 0; index < data.length; index += 1) {
    sum += data[index].close;
    if (index >= period) sum -= data[index - period].close;
    if (index >= period - 1) result.push({ time: data[index].time, value: sum / period });
  }
  return result;
}

function calcEMA(data: Array<{ time: number; close: number }>, period: number): LinePoint[] {
  const emaData: LinePoint[] = [];
  const k = 2 / (period + 1);
  let ema = 0;
  for (let index = 0; index < data.length; index += 1) {
    if (index < period - 1) {
      ema += data[index].close / period;
      continue;
    }
    if (index === period - 1) {
      ema += data[index].close / period;
      emaData.push({ time: data[index].time, value: ema });
      continue;
    }
    ema = data[index].close * k + ema * (1 - k);
    emaData.push({ time: data[index].time, value: ema });
  }
  return emaData;
}

function calcEMAValues(values: number[], period: number) {
  const result: Array<number | null> = Array(values.length).fill(null);
  const k = 2 / (period + 1);
  let ema = 0;
  for (let index = 0; index < values.length; index += 1) {
    if (index < period - 1) {
      ema += values[index] / period;
      continue;
    }
    if (index === period - 1) {
      ema += values[index] / period;
      result[index] = ema;
      continue;
    }
    ema = values[index] * k + ema * (1 - k);
    result[index] = ema;
  }
  return result;
}

function calcBollinger(data: Array<{ time: number; close: number }>, period = 20, multiplier = 2) {
  const upper: LinePoint[] = [];
  const middle: LinePoint[] = [];
  const lower: LinePoint[] = [];
  for (let index = period - 1; index < data.length; index += 1) {
    const slice = data.slice(index - period + 1, index + 1);
    const mean = slice.reduce((sum, item) => sum + item.close, 0) / period;
    const variance = slice.reduce((sum, item) => sum + (item.close - mean) ** 2, 0) / period;
    const deviation = Math.sqrt(variance);
    const time = data[index].time;
    upper.push({ time, value: mean + multiplier * deviation });
    middle.push({ time, value: mean });
    lower.push({ time, value: mean - multiplier * deviation });
  }
  return { upper, middle, lower };
}

function calcRSI(data: Array<{ time: number; close: number }>, period = 14): LinePoint[] {
  if (data.length <= period) return [];
  const result: LinePoint[] = [];
  let gain = 0;
  let loss = 0;
  for (let index = 1; index <= period; index += 1) {
    const diff = data[index].close - data[index - 1].close;
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  result.push({
    time: data[period].time,
    value: avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss),
  });
  for (let index = period + 1; index < data.length; index += 1) {
    const diff = data[index].close - data[index - 1].close;
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
    result.push({
      time: data[index].time,
      value: avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss),
    });
  }
  return result;
}

function calcMACD(data: Array<{ time: number; close: number }>, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const closes = data.map((item) => item.close);
  const emaFast = calcEMAValues(closes, fastPeriod);
  const emaSlow = calcEMAValues(closes, slowPeriod);
  const macdPoints = data
    .map((item, index) => {
      const fast = emaFast[index];
      const slow = emaSlow[index];
      return fast == null || slow == null ? null : { time: item.time, value: fast - slow };
    })
    .filter((item): item is LinePoint => item !== null);
  const signalPoints = calcEMA(macdPoints.map((item) => ({ time: item.time, close: item.value })), signalPeriod);
  const signalByTime = new Map(signalPoints.map((item) => [item.time, item.value]));
  const histogram = macdPoints
    .map((item) => {
      const signal = signalByTime.get(item.time);
      return signal == null ? null : { time: item.time, value: item.value - signal };
    })
    .filter((item): item is LinePoint => item !== null);
  return { macd: macdPoints, signal: signalPoints, histogram };
}

function calcStoch(data: Candle[], period = 14, smooth = 3) {
  const k: LinePoint[] = [];
  for (let index = period - 1; index < data.length; index += 1) {
    const slice = data.slice(index - period + 1, index + 1);
    const highest = Math.max(...slice.map((item) => item.high));
    const lowest = Math.min(...slice.map((item) => item.low));
    const value = highest === lowest ? 50 : ((data[index].close - lowest) / (highest - lowest)) * 100;
    k.push({ time: data[index].time, value });
  }
  const d = calcSMA(k.map((item) => ({ time: item.time, close: item.value })), smooth);
  return { k, d };
}

// StochRSI = Stochastic áp lên chuỗi RSI (mặc định 14,14,3,3). Trả %K + %D (0–100).
function calcStochRSI(
  data: Array<{ time: number; close: number }>,
  rsiPeriod = 14,
  stochPeriod = 14,
  smoothK = 3,
  smoothD = 3,
) {
  const rsi = calcRSI(data, rsiPeriod);
  const raw: LinePoint[] = [];
  for (let index = stochPeriod - 1; index < rsi.length; index += 1) {
    const window = rsi.slice(index - stochPeriod + 1, index + 1).map((point) => point.value);
    const highest = Math.max(...window);
    const lowest = Math.min(...window);
    const value = highest === lowest ? 0 : ((rsi[index].value - lowest) / (highest - lowest)) * 100;
    raw.push({ time: rsi[index].time, value });
  }
  const k = calcSMA(raw.map((point) => ({ time: point.time, close: point.value })), smoothK);
  const d = calcSMA(k.map((point) => ({ time: point.time, close: point.value })), smoothD);
  return { k, d };
}

function constantLine(data: Array<{ time: number }>, value: number): LinePoint[] {
  return data.map((item) => ({ time: item.time, value }));
}

// Điểm giao cắt giữa 2 đường (fast cắt slow): cắt LÊN → chấm xanh dưới, cắt XUỐNG → chấm đỏ trên.
function computeCrossMarkers(fast: LinePoint[], slow: LinePoint[]) {
  const slowByTime = new Map(slow.map((point) => [point.time, point.value]));
  const markers: Array<{ time: number; position: "aboveBar" | "belowBar"; color: string; shape: "circle"; size: number }> = [];
  let prevDiff: number | null = null;
  for (const point of fast) {
    const slowValue = slowByTime.get(point.time);
    if (slowValue == null) {
      prevDiff = null;
      continue;
    }
    const diff = point.value - slowValue;
    if (prevDiff != null) {
      if (prevDiff <= 0 && diff > 0) {
        markers.push({ time: point.time, position: "belowBar", color: "#22c55e", shape: "circle", size: 1 });
      } else if (prevDiff >= 0 && diff < 0) {
        markers.push({ time: point.time, position: "aboveBar", color: "#ef4444", shape: "circle", size: 1 });
      }
    }
    prevDiff = diff;
  }
  return markers;
}

function mergeLatestCandle(candles: Candle[], latest: Candle) {
  const sanitizedLatest = sanitizeCandles([latest])[0];
  if (!sanitizedLatest) return candles;
  const next = candles.filter((candle) => candle.time !== sanitizedLatest.time).concat(sanitizedLatest);
  return sanitizeCandles(next);
}

function lastPoint<T extends { time: number }>(points: T[]) {
  return points.length ? points[points.length - 1] : null;
}

function updateLastPoint(series: any, points: LinePoint[]) {
  const point = lastPoint(points);
  if (point) series.update(point as any);
}

function ToolButton({
  active,
  label,
  onClick,
  className = "",
  children,
}: {
  active?: boolean;
  label: string;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors ${className}`}
      style={{
        borderColor: active ? "var(--primary)" : "var(--border)",
        background: active ? "var(--primary-light)" : "var(--surface)",
        color: active ? "var(--primary)" : "var(--text-secondary)",
      }}
    >
      {children}
    </button>
  );
}

function ToolbarGroup({ children, vertical = false }: { children: ReactNode; vertical?: boolean }) {
  return <div className={vertical ? "flex flex-col gap-1" : "flex items-center gap-1"}>{children}</div>;
}

export function StockChart({
  symbol,
  exchange = "HOSE",
  sourceLabel,
  timeframe = "1D",
  onTimeframeChange,
  onSymbolSubmit,
  isLive = false,
}: StockChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<ChartSeriesRefs>({ overlays: [] });
  const pendingAnchorsRef = useRef<DrawAnchor[]>([]);
  const didFitRef = useRef(false);
  const chartCandlesRef = useRef<Candle[]>([]);
  const requestTokenRef = useRef(0);
  const skipNextFullRenderRef = useRef(false);
  const skipNextDrawingSaveRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<DrawingTool>("cursor");
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [drawingsHidden, setDrawingsHidden] = useState(false);
  const [drawingsLocked, setDrawingsLocked] = useState(false);
  const [indicatorPanelOpen, setIndicatorPanelOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [enabledIndicators, setEnabledIndicators] = useState<IndicatorId[]>(DEFAULT_INDICATORS);
  const [indicatorSettings, setIndicatorSettings] = useState<IndicatorSettings>(DEFAULT_SETTINGS);
  const [symbolSearch, setSymbolSearch] = useState(symbol);
  const [loadedCandles, setLoadedCandles] = useState<Candle[]>([]);
  const [chartReadyVersion, setChartReadyVersion] = useState(0);
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const chartCandles = useMemo(() => sanitizeCandles(loadedCandles), [loadedCandles]);
  const latestCandle = chartCandles.at(-1) ?? null;
  const previousCandle = chartCandles.at(-2) ?? null;
  const change = latestCandle && previousCandle ? latestCandle.close - previousCandle.close : null;
  const changePct = latestCandle && previousCandle && previousCandle.close > 0 ? (change! / previousCandle.close) * 100 : null;
  const isIntraday = INTRADAY_TIMEFRAMES.has(timeframe);
  const drawingStorageKey = `adn-chart-drawings:${symbol}:${timeframe}`;
  const indicatorStorageKey = `adn-chart-indicators:${symbol}:${timeframe}`;
  const settingsStorageKey = `adn-chart-settings:${symbol}:${timeframe}`;
  const enabledKey = enabledIndicators.join(",");
  const settingsKey = JSON.stringify(indicatorSettings);

  useEffect(() => {
    chartCandlesRef.current = chartCandles;
  }, [chartCandles]);

  useEffect(() => {
    setSymbolSearch(symbol);
  }, [symbol]);

  const handleSymbolSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = normalizeSymbolInput(symbolSearch);
    if (!next) return;
    setSymbolSearch(next);
    onSymbolSubmit?.(next);
  };

  const applyLatestCandlePatch = (latest: Candle, nextCandles: Candle[]) => {
    const refs = seriesRef.current;
    if (!chartRef.current || !refs.candle) return;
    refs.candle.update({
      time: latest.time as number,
      open: latest.open,
      high: latest.high,
      low: latest.low,
      close: latest.close,
    } as any);
    refs.volume?.update({
      time: latest.time as number,
      value: latest.volume,
      color: latest.close >= latest.open ? "rgba(0,192,135,0.38)" : "rgba(255,77,90,0.38)",
    } as any);

    const closeData = nextCandles.map((item) => ({ time: item.time, close: item.close }));
    for (const item of refs.overlays) {
      if (item.id === "ema10") updateLastPoint(item.series, calcEMA(closeData, 10));
      if (item.id === "ema20") updateLastPoint(item.series, calcEMA(closeData, 20));
      if (item.id === "ema30") updateLastPoint(item.series, calcEMA(closeData, 30));
      if (item.id === "ema50") updateLastPoint(item.series, calcEMA(closeData, 50));
      if (item.id === "ema200") updateLastPoint(item.series, calcEMA(closeData, 200));
      if (item.id === "sma20") updateLastPoint(item.series, calcSMA(closeData, 20));
      if (item.id === "sma50") updateLastPoint(item.series, calcSMA(closeData, 50));
      if (item.id === "sma200") updateLastPoint(item.series, calcSMA(closeData, 200));
    }

    if (enabledIndicators.includes("bb")) {
      const bb = calcBollinger(closeData, indicatorSettings.bb.period, indicatorSettings.bb.mult);
      const upper = refs.overlays.find((item) => item.id === "bb-upper")?.series;
      const middle = refs.overlays.find((item) => item.id === "bb-middle")?.series;
      const lower = refs.overlays.find((item) => item.id === "bb-lower")?.series;
      if (upper) updateLastPoint(upper, bb.upper);
      if (middle) updateLastPoint(middle, bb.middle);
      if (lower) updateLastPoint(lower, bb.lower);
    }
    if (refs.macd) {
      const macd = calcMACD(closeData, indicatorSettings.macd.fast, indicatorSettings.macd.slow, indicatorSettings.macd.signal);
      const hist = lastPoint(macd.histogram);
      updateLastPoint(refs.macd.macd, macd.macd);
      updateLastPoint(refs.macd.signal, macd.signal);
      if (hist) {
        refs.macd.histogram.update({
          time: hist.time as number,
          value: hist.value,
          color: hist.value >= 0 ? "rgba(34,197,94,0.85)" : "rgba(239,68,68,0.85)",
        } as any);
      }
      refs.macdMarkers?.setMarkers(computeCrossMarkers(macd.macd, macd.signal) as any);
    }
    if (refs.rsi) {
      const rsi = calcRSI(closeData, indicatorSettings.rsi.period);
      updateLastPoint(refs.rsi.line, rsi);
      updateLastPoint(refs.rsi.upper, constantLine(rsi, 70));
      updateLastPoint(refs.rsi.lower, constantLine(rsi, 30));
    }
    if (refs.stoch) {
      const stoch = calcStoch(nextCandles, indicatorSettings.stoch.period, indicatorSettings.stoch.smooth);
      updateLastPoint(refs.stoch.k, stoch.k);
      updateLastPoint(refs.stoch.d, stoch.d);
      updateLastPoint(refs.stoch.upper, constantLine(stoch.k, 80));
      updateLastPoint(refs.stoch.lower, constantLine(stoch.k, 20));
      refs.stochMarkers?.setMarkers(computeCrossMarkers(stoch.k, stoch.d) as any);
    }
    if (refs.stochrsi) {
      const sr = calcStochRSI(closeData, indicatorSettings.stochrsi.rsiPeriod, indicatorSettings.stochrsi.stochPeriod, indicatorSettings.stochrsi.smoothK, indicatorSettings.stochrsi.smoothD);
      updateLastPoint(refs.stochrsi.k, sr.k);
      updateLastPoint(refs.stochrsi.d, sr.d);
      updateLastPoint(refs.stochrsi.upper, constantLine(sr.k, 80));
      updateLastPoint(refs.stochrsi.lower, constantLine(sr.k, 20));
      refs.stochrsiMarkers?.setMarkers(computeCrossMarkers(sr.k, sr.d) as any);
    }
  };

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(drawingStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      // chỉ nhận nét vẽ neo theo {time,price}; bỏ định dạng %-cũ (đã hỏng khi pan/zoom).
      setDrawings(Array.isArray(parsed) ? parsed.filter((d: unknown) => isAnchoredDrawing(d)) : []);
    } catch {
      setDrawings([]);
    }
    // Đừng để effect lưu (chạy cùng lúc lúc mount với drawings=[]) ghi đè dữ liệu vừa load.
    skipNextDrawingSaveRef.current = true;
    pendingAnchorsRef.current = [];
    seriesRef.current.drawingsPrimitive?.setPreview(null);
  }, [drawingStorageKey]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(indicatorStorageKey);
      const saved = raw ? JSON.parse(raw) as IndicatorId[] : null;
      const allowed = new Set(INDICATORS.map((item) => item.id));
      const next = Array.isArray(saved) ? saved.filter((item) => allowed.has(item)) : DEFAULT_INDICATORS;
      setEnabledIndicators(next.length ? next : DEFAULT_INDICATORS);
    } catch {
      setEnabledIndicators(DEFAULT_INDICATORS);
    }
  }, [indicatorStorageKey]);

  useEffect(() => {
    if (skipNextDrawingSaveRef.current) {
      skipNextDrawingSaveRef.current = false;
      return;
    }
    try {
      window.localStorage.setItem(drawingStorageKey, JSON.stringify(drawings));
    } catch {
      // Local persistence is best-effort only.
    }
  }, [drawings, drawingStorageKey]);

  // Đẩy nét vẽ vào primitive (primitive tự repaint theo render-loop của chart → dính nến).
  useEffect(() => {
    seriesRef.current.drawingsPrimitive?.setDrawings(drawingsHidden ? [] : drawings);
  }, [drawings, drawingsHidden, chartReadyVersion]);

  useEffect(() => {
    try {
      window.localStorage.setItem(indicatorStorageKey, JSON.stringify(enabledIndicators));
    } catch {
      // Local persistence is best-effort only.
    }
  }, [enabledIndicators, indicatorStorageKey]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(settingsStorageKey);
      const saved = raw ? (JSON.parse(raw) as Partial<IndicatorSettings>) : null;
      setIndicatorSettings(saved ? { ...DEFAULT_SETTINGS, ...saved } : DEFAULT_SETTINGS);
    } catch {
      setIndicatorSettings(DEFAULT_SETTINGS);
    }
  }, [settingsStorageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(settingsStorageKey, settingsKey);
    } catch {
      // Local persistence is best-effort only.
    }
  }, [settingsKey, settingsStorageKey]);

  useEffect(() => {
    pendingAnchorsRef.current = [];
    seriesRef.current.drawingsPrimitive?.setPreview(null);
  }, [activeTool]);

  const toggleIndicator = (indicator: IndicatorId) => {
    setEnabledIndicators((prev) => {
      if (prev.includes(indicator)) return prev.filter((item) => item !== indicator);
      return [...prev, indicator];
    });
  };

  const updateSetting = (id: keyof IndicatorSettings, key: string, value: number) => {
    setIndicatorSettings((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
  };

  const resetPreset = () => {
    setEnabledIndicators(DEFAULT_INDICATORS);
  };

  const handleSnapshot = () => {
    const canvas = chartRef.current?.takeScreenshot?.();
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${symbol}-${timeframe}.png`;
    link.click();
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;

    let disposed = false;
    let cleanup: (() => void) | undefined;

    async function init() {
      try {
        setLoading(true);
        setError(null);
        const {
          createChart,
          CandlestickSeries,
          HistogramSeries,
          LineSeries,
          ColorType,
          CrosshairMode,
          createSeriesMarkers,
        } = await import("lightweight-charts");

        if (disposed || !chartContainerRef.current) return undefined;
        const container = chartContainerRef.current;
        container.innerHTML = "";
        didFitRef.current = false;

        const chart = createChart(container, {
          width: container.clientWidth,
          height: getChartHeight(container.clientWidth),
          layout: {
            background: { type: ColorType.Solid, color: isDark ? "#0b0d12" : "#ffffff" },
            textColor: isDark ? "#c8c2b8" : "#4b5563",
            fontSize: 11,
            panes: {
              separatorColor: isDark ? "#1f2430" : "#e5e7eb",
              separatorHoverColor: isDark ? "#2b3342" : "#d1d5db",
              enableResize: true,
            },
          },
          grid: {
            vertLines: { color: isDark ? "#161a22" : "#edf2f7" },
            horzLines: { color: isDark ? "#161a22" : "#edf2f7" },
          },
          crosshair: { mode: CrosshairMode.Normal },
          rightPriceScale: {
            borderColor: isDark ? "#242a36" : "#d6cdbb",
            scaleMargins: { top: 0.08, bottom: enabledIndicators.includes("volume") ? 0.26 : 0.08 },
          },
          timeScale: {
            borderColor: isDark ? "#242a36" : "#d6cdbb",
            timeVisible: isIntraday,
            secondsVisible: timeframe === "1m",
          },
        });

        const candle = chart.addSeries(CandlestickSeries, {
          upColor: "#00c087",
          downColor: "#ff4d5a",
          borderUpColor: "#00c087",
          borderDownColor: "#ff4d5a",
          wickUpColor: "#00c087",
          wickDownColor: "#ff4d5a",
          priceLineVisible: true,
          lastValueVisible: true,
        });

        const nextSeries: ChartSeriesRefs = { candle, overlays: [] };

        const drawingsPrimitive = new DrawingsPrimitive({
          getCandles: () => chartCandlesRef.current,
          isDark,
        });
        candle.attachPrimitive(drawingsPrimitive);
        nextSeries.drawingsPrimitive = drawingsPrimitive;

        if (enabledIndicators.includes("volume")) {
          const volume = chart.addSeries(HistogramSeries, {
            priceFormat: { type: "volume" },
            priceScaleId: "volume",
          });
          chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });
          nextSeries.volume = volume;
        }

        const addOverlay = (id: string, title: string, color: string, lineWidth: 1 | 2 | 3 | 4 = 1) => {
          const series = chart.addSeries(LineSeries, {
            color,
            lineWidth,
            title,
            priceLineVisible: false,
            lastValueVisible: false,
          });
          nextSeries.overlays.push({ id, series });
          return series;
        };

        for (const indicator of enabledIndicators) {
          if (indicator.startsWith("ema")) addOverlay(indicator, indicator.toUpperCase(), INDICATOR_COLORS[indicator]);
          if (indicator.startsWith("sma")) addOverlay(indicator, indicator.toUpperCase(), INDICATOR_COLORS[indicator]);
        }

        if (enabledIndicators.includes("bb")) {
          addOverlay("bb-upper", "BB Upper", "#64748b");
          addOverlay("bb-middle", "BB Mid", "#94a3b8");
          addOverlay("bb-lower", "BB Lower", "#64748b");
        }

        let paneIndex = 1;
        if (enabledIndicators.includes("macd")) {
          const histogram = chart.addSeries(HistogramSeries, { priceScaleId: "right", title: "MACD Hist" }, paneIndex);
          const macd = chart.addSeries(LineSeries, { color: "#14b8a6", lineWidth: 1, title: "MACD" }, paneIndex);
          const signal = chart.addSeries(LineSeries, { color: "#ef4444", lineWidth: 1, title: "Signal" }, paneIndex);
          nextSeries.macd = { histogram, macd, signal };
          nextSeries.macdMarkers = createSeriesMarkers(macd, []);
          paneIndex += 1;
        }
        if (enabledIndicators.includes("rsi")) {
          const line = chart.addSeries(LineSeries, { color: "#8b5cf6", lineWidth: 1, title: "RSI" }, paneIndex);
          const upper = chart.addSeries(LineSeries, { color: "rgba(148,163,184,0.45)", lineWidth: 1, title: "RSI 70", lastValueVisible: false }, paneIndex);
          const lower = chart.addSeries(LineSeries, { color: "rgba(148,163,184,0.45)", lineWidth: 1, title: "RSI 30", lastValueVisible: false }, paneIndex);
          nextSeries.rsi = { line, upper, lower };
          paneIndex += 1;
        }
        if (enabledIndicators.includes("stoch")) {
          const k = chart.addSeries(LineSeries, { color: "#0ea5e9", lineWidth: 1, title: "%K" }, paneIndex);
          const d = chart.addSeries(LineSeries, { color: "#f97316", lineWidth: 1, title: "%D" }, paneIndex);
          const upper = chart.addSeries(LineSeries, { color: "rgba(148,163,184,0.45)", lineWidth: 1, title: "Stoch 80", lastValueVisible: false }, paneIndex);
          const lower = chart.addSeries(LineSeries, { color: "rgba(148,163,184,0.45)", lineWidth: 1, title: "Stoch 20", lastValueVisible: false }, paneIndex);
          nextSeries.stoch = { k, d, upper, lower };
          nextSeries.stochMarkers = createSeriesMarkers(k, []);
          paneIndex += 1;
        }
        if (enabledIndicators.includes("stochrsi")) {
          const k = chart.addSeries(LineSeries, { color: "#22d3ee", lineWidth: 1, title: "StochRSI %K" }, paneIndex);
          const d = chart.addSeries(LineSeries, { color: "#fb923c", lineWidth: 1, title: "%D" }, paneIndex);
          const upper = chart.addSeries(LineSeries, { color: "rgba(148,163,184,0.45)", lineWidth: 1, title: "StochRSI 80", lastValueVisible: false }, paneIndex);
          const lower = chart.addSeries(LineSeries, { color: "rgba(148,163,184,0.45)", lineWidth: 1, title: "StochRSI 20", lastValueVisible: false }, paneIndex);
          nextSeries.stochrsi = { k, d, upper, lower };
          nextSeries.stochrsiMarkers = createSeriesMarkers(k, []);
        }

        requestAnimationFrame(() => {
          const panes = chart.panes?.() ?? [];
          panes[0]?.setStretchFactor?.(0.58);
          for (let index = 1; index < panes.length; index += 1) {
            panes[index]?.setStretchFactor?.(0.14);
          }
        });

        chartRef.current = chart;
        seriesRef.current = nextSeries;
        setChartReadyVersion((value) => value + 1);

        const observer = new ResizeObserver(() => {
          if (container.clientWidth > 0) {
            chart.applyOptions({
              width: container.clientWidth,
              height: getChartHeight(container.clientWidth),
            });
          }
        });
        observer.observe(container);

        return () => {
          observer.disconnect();
          chart.remove();
          chartRef.current = null;
          seriesRef.current = { overlays: [] };
        };
      } catch (err) {
        if (!disposed) {
          if (chartContainerRef.current) chartContainerRef.current.innerHTML = "";
          setError(err instanceof Error ? err.message : "Lỗi tải biểu đồ");
          setLoading(false);
        }
      }
      return undefined;
    }

    void init().then((teardown) => {
      if (disposed) teardown?.();
      else cleanup = teardown;
    });
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [symbol, isDark, timeframe, isIntraday, enabledKey]);

  useEffect(() => {
    let disposed = false;

    async function fetchChartData() {
      const token = ++requestTokenRef.current;
      try {
        setLoading(true);
        setError(null);
        setLoadedCandles([]);
        const res = await fetch(`/api/chart?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}`, {
          cache: "no-store",
        });
        const payload = await res.json() as { candles?: Candle[]; error?: string };
        if (!res.ok) throw new Error(payload.error || "Không tải được dữ liệu biểu đồ");
        const nextCandles = sanitizeCandles(payload.candles);
        if (!nextCandles.length) throw new Error("Biểu đồ đang cập nhật dữ liệu cho khung này");
        if (!disposed && token === requestTokenRef.current) setLoadedCandles(nextCandles);
      } catch (err) {
        if (!disposed && token === requestTokenRef.current) {
          setLoadedCandles([]);
          setError(err instanceof Error ? err.message : "Lỗi tải biểu đồ");
          setLoading(false);
        }
      }
    }

    void fetchChartData();
    return () => {
      disposed = true;
    };
  }, [symbol, timeframe]);

  useEffect(() => {
    let disposed = false;

    async function updateData() {
      try {
        const nextCandles = chartCandles;
        if (!nextCandles.length) throw new Error("Biểu đồ đang cập nhật dữ liệu cho khung này");
        if (disposed || !chartRef.current || !seriesRef.current.candle) return;
        if (skipNextFullRenderRef.current) {
          skipNextFullRenderRef.current = false;
          setError(null);
          setLoading(false);
          return;
        }

        const chartData = nextCandles.map((c) => ({
          time: c.time as number,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));
        seriesRef.current.candle.setData(chartData as any);

        if (seriesRef.current.volume) {
          seriesRef.current.volume.setData(nextCandles.map((c) => ({
            time: c.time as number,
            value: c.volume,
            color: c.close >= c.open ? "rgba(0,192,135,0.38)" : "rgba(255,77,90,0.38)",
          })) as any);
        }

        const closeData = nextCandles.map((item) => ({ time: item.time, close: item.close }));
        for (const item of seriesRef.current.overlays) {
          if (item.id === "ema10") item.series.setData(calcEMA(closeData, 10) as any);
          if (item.id === "ema20") item.series.setData(calcEMA(closeData, 20) as any);
          if (item.id === "ema30") item.series.setData(calcEMA(closeData, 30) as any);
          if (item.id === "ema50") item.series.setData(calcEMA(closeData, 50) as any);
          if (item.id === "ema200") item.series.setData(calcEMA(closeData, 200) as any);
          if (item.id === "sma20") item.series.setData(calcSMA(closeData, 20) as any);
          if (item.id === "sma50") item.series.setData(calcSMA(closeData, 50) as any);
          if (item.id === "sma200") item.series.setData(calcSMA(closeData, 200) as any);
        }

        if (enabledIndicators.includes("bb")) {
          const bb = calcBollinger(closeData, indicatorSettings.bb.period, indicatorSettings.bb.mult);
          seriesRef.current.overlays.find((item) => item.id === "bb-upper")?.series.setData(bb.upper as any);
          seriesRef.current.overlays.find((item) => item.id === "bb-middle")?.series.setData(bb.middle as any);
          seriesRef.current.overlays.find((item) => item.id === "bb-lower")?.series.setData(bb.lower as any);
        }

        if (seriesRef.current.macd) {
          const macd = calcMACD(closeData, indicatorSettings.macd.fast, indicatorSettings.macd.slow, indicatorSettings.macd.signal);
          seriesRef.current.macd.macd.setData(macd.macd as any);
          seriesRef.current.macd.signal.setData(macd.signal as any);
          seriesRef.current.macd.histogram.setData(macd.histogram.map((item) => ({
            time: item.time as number,
            value: item.value,
            color: item.value >= 0 ? "rgba(34,197,94,0.85)" : "rgba(239,68,68,0.85)",
          })) as any);
          seriesRef.current.macdMarkers?.setMarkers(computeCrossMarkers(macd.macd, macd.signal) as any);
        }

        if (seriesRef.current.rsi) {
          const rsi = calcRSI(closeData, indicatorSettings.rsi.period);
          seriesRef.current.rsi.line.setData(rsi as any);
          seriesRef.current.rsi.upper.setData(constantLine(rsi, 70) as any);
          seriesRef.current.rsi.lower.setData(constantLine(rsi, 30) as any);
        }

        if (seriesRef.current.stoch) {
          const stoch = calcStoch(nextCandles, indicatorSettings.stoch.period, indicatorSettings.stoch.smooth);
          seriesRef.current.stoch.k.setData(stoch.k as any);
          seriesRef.current.stoch.d.setData(stoch.d as any);
          seriesRef.current.stoch.upper.setData(constantLine(stoch.k, 80) as any);
          seriesRef.current.stoch.lower.setData(constantLine(stoch.k, 20) as any);
          seriesRef.current.stochMarkers?.setMarkers(computeCrossMarkers(stoch.k, stoch.d) as any);
        }

        if (seriesRef.current.stochrsi) {
          const sr = calcStochRSI(closeData, indicatorSettings.stochrsi.rsiPeriod, indicatorSettings.stochrsi.stochPeriod, indicatorSettings.stochrsi.smoothK, indicatorSettings.stochrsi.smoothD);
          seriesRef.current.stochrsi.k.setData(sr.k as any);
          seriesRef.current.stochrsi.d.setData(sr.d as any);
          seriesRef.current.stochrsi.upper.setData(constantLine(sr.k, 80) as any);
          seriesRef.current.stochrsi.lower.setData(constantLine(sr.k, 20) as any);
          seriesRef.current.stochrsiMarkers?.setMarkers(computeCrossMarkers(sr.k, sr.d) as any);
        }

        if (!didFitRef.current) {
          chartRef.current.timeScale().fitContent();
          didFitRef.current = true;
        }
        setError(null);
        setLoading(false);
      } catch (err) {
        if (!disposed) {
          setError(err instanceof Error ? err.message : "Lỗi tải biểu đồ");
          setLoading(false);
        }
      }
    }

    void updateData();
    return () => {
      disposed = true;
    };
  }, [chartCandles, symbol, timeframe, enabledIndicators, chartReadyVersion, settingsKey]);

  useEffect(() => {
    if (!chartReadyVersion || !chartCandles.length) return;
    let disposed = false;
    const token = requestTokenRef.current;

    async function pollLatest() {
      try {
        const res = await fetch(`/api/chart?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}&latest=1`, {
          cache: "no-store",
        });
        if (disposed || token !== requestTokenRef.current) return;
        if (res.status === 204) return;
        const payload = await res.json() as { symbol?: string; timeframe?: string; candles?: Candle[] };
        if (!res.ok) return;
        if (payload.symbol?.toUpperCase() !== symbol.toUpperCase() || payload.timeframe !== timeframe) return;
        const latest = sanitizeCandles(payload.candles)[0];
        if (!latest) return;
        const nextCandles = mergeLatestCandle(chartCandlesRef.current, latest);
        const mergedLatest = nextCandles.find((candle) => candle.time === latest.time) ?? latest;
        applyLatestCandlePatch(mergedLatest, nextCandles);
        chartCandlesRef.current = nextCandles;
        skipNextFullRenderRef.current = true;
        setLoadedCandles(nextCandles);
      } catch {
        // Latest polling is best-effort; keep the loaded chart stable.
      }
    }

    void pollLatest();
    const interval = window.setInterval(pollLatest, 10_000);
    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, [symbol, timeframe, chartReadyVersion, chartCandles.length, enabledKey, settingsKey]);

  function anchorFromEvent(event: PointerEvent<HTMLDivElement>): DrawAnchor | null {
    const chart = chartRef.current;
    const series = seriesRef.current.candle;
    const container = chartContainerRef.current;
    if (!chart || !series || !container) return null;
    const rect = container.getBoundingClientRect();
    const x = (event.clientX - rect.left) as Coordinate;
    const y = (event.clientY - rect.top) as Coordinate;
    const time = chart.timeScale().coordinateToTime(x);
    const price = series.coordinateToPrice(y);
    if (time == null || price == null) return null;
    return { time: Number(time), price: Number(price) };
  }

  function pointsNeeded(tool: DrawTool): number {
    if (tool === "hline" || tool === "vline" || tool === "text") return 1;
    if (tool === "channel") return 3;
    return 2;
  }

  function addDrawing(anchor: DrawAnchor) {
    if (activeTool === "cursor" || drawingsLocked) return;
    const tool = activeTool as DrawTool;
    if (tool === "text") {
      const text = window.prompt("Nội dung ghi chú", "Ghi chú")?.trim();
      if (!text) return;
      setDrawings((prev) => [...prev, { id: crypto.randomUUID(), tool, anchors: [anchor], text }]);
      return;
    }
    const next = [...pendingAnchorsRef.current, anchor];
    if (next.length >= pointsNeeded(tool)) {
      setDrawings((prev) => [...prev, { id: crypto.randomUUID(), tool, anchors: next }]);
      pendingAnchorsRef.current = [];
      seriesRef.current.drawingsPrimitive?.setPreview(null);
    } else {
      pendingAnchorsRef.current = next;
      seriesRef.current.drawingsPrimitive?.setPreview({ id: "preview", tool, anchors: next });
    }
  }

  function previewMove(anchor: DrawAnchor) {
    const tool = activeTool as DrawTool;
    if (activeTool === "cursor" || drawingsLocked || tool === "text") return;
    const pending = pendingAnchorsRef.current;
    if (pending.length === 0) return;
    seriesRef.current.drawingsPrimitive?.setPreview({ id: "preview", tool, anchors: [...pending, anchor] });
  }

  function cancelPending() {
    pendingAnchorsRef.current = [];
    seriesRef.current.drawingsPrimitive?.setPreview(null);
  }

  const drawingToolbar = (vertical = false) => (
    <ToolbarGroup vertical={vertical}>
      <ToolButton label="Con trỏ" active={activeTool === "cursor"} onClick={() => setActiveTool("cursor")}><MousePointer2 className="h-4 w-4" /></ToolButton>
      <ToolButton label="Crosshair" active={activeTool === "measure"} onClick={() => setActiveTool("measure")}><Crosshair className="h-4 w-4" /></ToolButton>
      <ToolButton label="Trendline" active={activeTool === "trend"} onClick={() => setActiveTool("trend")}><Slash className="h-4 w-4" /></ToolButton>
      <ToolButton label="Tia (ray)" active={activeTool === "ray"} onClick={() => setActiveTool("ray")}><MoveUpRight className="h-4 w-4" /></ToolButton>
      <ToolButton label="Đường ngang" active={activeTool === "hline"} onClick={() => setActiveTool("hline")}><Minus className="h-4 w-4" /></ToolButton>
      <ToolButton label="Đường dọc" active={activeTool === "vline"} onClick={() => setActiveTool("vline")}><Rows3 className="h-4 w-4 rotate-90" /></ToolButton>
      <ToolButton label="Vùng giá" active={activeTool === "zone"} onClick={() => setActiveTool("zone")}><RectangleHorizontal className="h-4 w-4" /></ToolButton>
      <ToolButton label="Fibonacci" active={activeTool === "fib"} onClick={() => setActiveTool("fib")}><GitGraph className="h-4 w-4" /></ToolButton>
      <ToolButton label="Kênh song song" active={activeTool === "channel"} onClick={() => setActiveTool("channel")}><Equal className="h-4 w-4" /></ToolButton>
      <ToolButton label="Ghi chú" active={activeTool === "text"} onClick={() => setActiveTool("text")}><Type className="h-4 w-4" /></ToolButton>
      {vertical ? <div className="my-1 h-px w-8 bg-[var(--border)]" /> : <div className="mx-1 h-6 w-px bg-[var(--border)]" />}
      <ToolButton label="Hoàn tác nét vẽ" onClick={() => setDrawings((prev) => prev.slice(0, -1))}><Undo2 className="h-4 w-4" /></ToolButton>
      <ToolButton label={drawingsLocked ? "Mở khóa nét vẽ" : "Khóa nét vẽ"} active={drawingsLocked} onClick={() => setDrawingsLocked((value) => !value)}>
        {drawingsLocked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
      </ToolButton>
      <ToolButton label={drawingsHidden ? "Hiện nét vẽ" : "Ẩn nét vẽ"} active={drawingsHidden} onClick={() => setDrawingsHidden((value) => !value)}>
        {drawingsHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </ToolButton>
      <ToolButton label="Xóa tất cả nét vẽ" onClick={() => setDrawings([])}><Trash2 className="h-4 w-4" /></ToolButton>
    </ToolbarGroup>
  );

  const wrapperClass = fullscreen
    ? "fixed inset-3 z-50 flex flex-col overflow-hidden rounded-xl border shadow-2xl"
    : "w-full max-w-full min-w-0 overflow-hidden rounded-xl border";

  return (
    <div className={wrapperClass} style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="flex min-w-0 flex-wrap items-center gap-2 border-b px-2 py-1.5" style={{ borderColor: "var(--border)", background: isDark ? "#11141b" : "var(--surface)" }}>
        <div className="flex min-w-0 items-center gap-2 pr-2">
          <form onSubmit={handleSymbolSearch} className="flex h-9 items-center rounded-md border" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <input
              value={symbolSearch}
              onChange={(event) => setSymbolSearch(normalizeSymbolInput(event.target.value))}
              aria-label="Tìm mã cổ phiếu trên biểu đồ"
              className="h-full w-[72px] bg-transparent px-2 text-sm font-black uppercase outline-none"
              style={{ color: "var(--text-primary)" }}
            />
            <button type="submit" aria-label="Mở mã cổ phiếu" className="flex h-full w-8 items-center justify-center" style={{ color: "var(--text-secondary)" }}>
              <Search className="h-3.5 w-3.5" />
            </button>
          </form>
          <span className="hidden text-xs sm:inline" style={{ color: "var(--text-secondary)" }}>
            {sourceLabel ? `${sourceLabel} · ` : ""}{exchange}
          </span>
          <span
            className="rounded-full border px-2 py-0.5 text-[10px] font-black"
            style={{
              borderColor: isLive ? "rgba(16,185,129,0.35)" : "var(--border)",
              background: isLive ? "rgba(16,185,129,0.12)" : "var(--surface-2)",
              color: isLive ? "#10b981" : "var(--text-muted)",
            }}
          >
            {isLive ? "LIVE" : isIntraday ? "GẦN NHẤT" : "EOD"}
          </span>
        </div>

        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
          {TIMEFRAMES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onTimeframeChange?.(item)}
              className="h-8 min-w-8 rounded-md px-2 text-xs font-bold"
              style={{
                background: item === timeframe ? "var(--primary-light)" : "transparent",
                color: item === timeframe ? "var(--primary)" : "var(--text-secondary)",
              }}
            >
              {formatTimeframe(item)}
            </button>
          ))}
        </div>

        <div className="ml-auto flex min-w-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setIndicatorPanelOpen((value) => !value)}
            className="inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs font-bold"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: indicatorPanelOpen ? "var(--surface-2)" : "transparent" }}
          >
            <Activity className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Các chỉ báo</span>
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button type="button" className="hidden h-8 items-center gap-1 rounded-md px-2 text-xs font-bold md:inline-flex" style={{ color: "var(--text-secondary)" }}>
            <BarChart3 className="h-3.5 w-3.5" /> Biểu đồ
          </button>
          <button type="button" className="hidden h-8 rounded-md px-2 text-xs font-bold md:inline-flex" style={{ color: "var(--primary)", background: "var(--primary-light)" }}>
            Kỹ thuật
          </button>
          <button type="button" className="hidden h-8 rounded-md px-2 text-xs font-bold md:inline-flex" style={{ color: "var(--text-secondary)" }}>
            Cơ bản
          </button>
          <button type="button" aria-label="Chụp ảnh biểu đồ" onClick={handleSnapshot} className="hidden h-8 w-8 items-center justify-center rounded-md border md:inline-flex" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
            <Camera className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Phóng to biểu đồ" onClick={() => setFullscreen((value) => !value)} className="h-8 w-8 rounded-md border" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
            <Expand className="mx-auto h-4 w-4" />
          </button>
          <Settings className="hidden h-4 w-4 md:block" style={{ color: "var(--text-muted)" }} />
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-1.5 text-xs" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
        <span className="font-bold" style={{ color: "var(--text-primary)" }}>
          {symbol} · {formatTimeframe(timeframe)}
        </span>
        <span>O {formatPrice(latestCandle?.open)}</span>
        <span>H {formatPrice(latestCandle?.high)}</span>
        <span>L {formatPrice(latestCandle?.low)}</span>
        <span>C {formatPrice(latestCandle?.close)}</span>
        <span>KL {formatVolume(latestCandle?.volume)}</span>
        {change != null && changePct != null ? (
          <span className="font-bold" style={{ color: change >= 0 ? "#00c087" : "#ff4d5a" }}>
            {change >= 0 ? "+" : ""}{formatPrice(change)} ({changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%)
          </span>
        ) : null}
      </div>

      {indicatorPanelOpen ? (
        <div className="grid gap-3 border-b px-3 py-3 sm:grid-cols-2" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          {(["Trên giá", "Panel dưới"] as const).map((group) => (
            <div key={group}>
              <div className="mb-2 text-[11px] font-black uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{group}</div>
              <div className="flex flex-wrap gap-2">
                {INDICATORS.filter((item) => item.group === group).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleIndicator(item.id)}
                    className="rounded-md border px-2 py-1 text-xs font-bold"
                    style={{
                      borderColor: enabledIndicators.includes(item.id) ? "var(--primary)" : "var(--border)",
                      background: enabledIndicators.includes(item.id) ? "var(--primary-light)" : "var(--surface)",
                      color: enabledIndicators.includes(item.id) ? "var(--primary)" : "var(--text-secondary)",
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="sm:col-span-2">
            <button type="button" onClick={resetPreset} className="inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs font-bold" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
              <Ruler className="h-3.5 w-3.5" /> HGL-EMA mặc định
            </button>
          </div>

          {SETTINGS_SCHEMA.some((schema) => enabledIndicators.includes(schema.id as IndicatorId)) ? (
            <div className="sm:col-span-2 border-t pt-3" style={{ borderColor: "var(--border)" }}>
              <div className="mb-2 text-[11px] font-black uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Thông số chỉ báo</div>
              <div className="flex flex-col gap-2">
                {SETTINGS_SCHEMA.filter((schema) => enabledIndicators.includes(schema.id as IndicatorId)).map((schema) => (
                  <div key={schema.id} className="flex flex-wrap items-center gap-2">
                    <span className="w-20 text-xs font-bold" style={{ color: "var(--text-primary)" }}>{schema.label}</span>
                    {schema.fields.map((field) => (
                      <label key={field.key} className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                        {field.label}
                        <input
                          type="number"
                          min={field.min}
                          max={field.max}
                          value={(indicatorSettings[schema.id] as Record<string, number>)[field.key]}
                          onChange={(event) =>
                            updateSetting(
                              schema.id,
                              field.key,
                              Math.max(field.min, Math.min(field.max, Number(event.target.value) || field.min)),
                            )
                          }
                          className="w-14 rounded-md border px-1.5 py-1 text-center font-bold"
                          style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-primary)" }}
                        />
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1">
        <div className="hidden shrink-0 border-r p-1.5 md:block" style={{ borderColor: "var(--border)", background: isDark ? "#11141b" : "var(--surface)" }}>
          {drawingToolbar(true)}
        </div>
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <div ref={chartContainerRef} className="h-[520px] w-full max-w-full min-w-0 md:h-[650px] xl:h-[780px]">
            {loading && !error ? (
              <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500/40 border-t-emerald-400" />
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    Đang tải biểu đồ {symbol}...
                  </span>
                </div>
              </div>
            ) : null}
            {error ? (
              <div className="flex h-full items-center justify-center px-6 text-center">
                <span className="text-sm text-yellow-600">{error}</span>
              </div>
            ) : null}
          </div>
          {!error ? (
            <div
              className="absolute inset-0"
              style={{
                pointerEvents: activeTool === "cursor" || drawingsLocked || drawingsHidden ? "none" : "auto",
                cursor: activeTool === "cursor" || drawingsLocked ? "default" : "crosshair",
                zIndex: 2,
              }}
              onPointerDown={(event) => {
                if (activeTool === "cursor" || drawingsLocked) return;
                event.preventDefault();
                const anchor = anchorFromEvent(event);
                if (anchor) addDrawing(anchor);
              }}
              onPointerMove={(event) => {
                if (activeTool === "cursor" || drawingsLocked) return;
                const anchor = anchorFromEvent(event);
                if (anchor) previewMove(anchor);
              }}
              onDoubleClick={(event) => {
                event.preventDefault();
                cancelPending();
              }}
            />
          ) : null}
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto border-t p-2 md:hidden" style={{ borderColor: "var(--border)" }}>
        {drawingToolbar(false)}
      </div>
    </div>
  );
}

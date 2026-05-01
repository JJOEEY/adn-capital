"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent, ReactNode } from "react";
import {
  Eye,
  EyeOff,
  GitGraph,
  Lock,
  LockOpen,
  Minus,
  MousePointer2,
  RectangleHorizontal,
  Rows3,
  Slash,
  Trash2,
  Type,
  Undo2,
} from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";

export type ChartTimeframe = "1m" | "5m" | "15m" | "30m" | "1D";

interface StockChartProps {
  symbol: string;
  exchange?: string;
  candles?: Candle[];
  sourceLabel?: string;
  timeframe?: ChartTimeframe;
  onTimeframeChange?: (timeframe: ChartTimeframe) => void;
  allowFallbackFetch?: boolean;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

type DrawingTool = "cursor" | "trend" | "hline" | "vline" | "zone" | "fib" | "text";
type Drawing = {
  id: string;
  tool: Exclude<DrawingTool, "cursor">;
  points: Array<{ x: number; y: number }>;
  text?: string;
};

const CHART_HEIGHT_MOBILE = 360;
const CHART_HEIGHT_DESKTOP = 560;
const TIMEFRAMES: ChartTimeframe[] = ["1m", "5m", "15m", "30m", "1D"];

function getChartHeight() {
  return typeof window !== "undefined" && window.innerWidth >= 768
    ? CHART_HEIGHT_DESKTOP
    : CHART_HEIGHT_MOBILE;
}

function calcEMA(data: Array<{ time: number; close: number }>, period: number) {
  const emaData: { time: number; value: number }[] = [];
  const k = 2 / (period + 1);
  let ema = 0;
  for (let i = 0; i < data.length; i += 1) {
    if (i < period - 1) {
      ema += data[i].close / period;
      continue;
    }
    if (i === period - 1) {
      ema += data[i].close / period;
      emaData.push({ time: data[i].time, value: ema });
      continue;
    }
    ema = data[i].close * k + ema * (1 - k);
    emaData.push({ time: data[i].time, value: ema });
  }
  return emaData;
}

function sanitizeCandles(candles?: Candle[]) {
  return (candles ?? [])
    .filter((c) => Number.isFinite(c.time) && Number.isFinite(c.open) && Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(c.close))
    .sort((a, b) => a.time - b.time)
    .filter((c, index, all) => index === 0 || c.time !== all[index - 1].time);
}

function pointFromEvent(event: PointerEvent<SVGSVGElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
    y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)),
  };
}

function drawingPath(drawing: Drawing) {
  const [a, b] = drawing.points;
  if (!a) return null;
  if (drawing.tool === "hline") return { x1: 0, y1: a.y, x2: 100, y2: a.y };
  if (drawing.tool === "vline") return { x1: a.x, y1: 0, x2: a.x, y2: 100 };
  if (!b) return null;
  return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
}

function ToolButton({
  active,
  label,
  onClick,
  children,
}: {
  active?: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors"
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

export function StockChart({
  symbol,
  exchange = "HOSE",
  candles,
  sourceLabel,
  timeframe = "1D",
  onTimeframeChange,
  allowFallbackFetch = true,
}: StockChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const pendingPointRef = useRef<{ x: number; y: number } | null>(null);
  const [pendingPoint, setPendingPoint] = useState<{ x: number; y: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<DrawingTool>("cursor");
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [drawingsHidden, setDrawingsHidden] = useState(false);
  const [drawingsLocked, setDrawingsLocked] = useState(false);
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const chartCandles = useMemo(() => sanitizeCandles(candles), [candles]);
  const storageKey = `adn-chart-drawings:${symbol}:${timeframe}`;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      setDrawings(raw ? JSON.parse(raw) : []);
    } catch {
      setDrawings([]);
    }
    pendingPointRef.current = null;
    setPendingPoint(null);
  }, [storageKey]);

  useEffect(() => {
    pendingPointRef.current = null;
    setPendingPoint(null);
  }, [activeTool]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(drawings));
    } catch {
      // Local persistence is best-effort only.
    }
  }, [drawings, storageKey]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    let disposed = false;
    let cleanup: (() => void) | undefined;

    async function init() {
      try {
        setLoading(true);
        setError(null);

        let nextCandles = chartCandles;
        if (!nextCandles.length && allowFallbackFetch && timeframe === "1D") {
          const res = await fetch(`/api/chart?symbol=${symbol}`);
          if (!res.ok) throw new Error("Không tải được dữ liệu chart");
          const payload = (await res.json()) as { candles: Candle[] };
          nextCandles = sanitizeCandles(payload.candles);
        }
        if (!nextCandles.length) throw new Error("Biểu đồ đang cập nhật dữ liệu cho khung này");
        if (disposed) return;

        const {
          createChart,
          CandlestickSeries,
          HistogramSeries,
          LineSeries,
          ColorType,
          CrosshairMode,
        } = await import("lightweight-charts");

        if (disposed || !chartContainerRef.current) return;
        const container = chartContainerRef.current;
        container.innerHTML = "";

        const chart = createChart(container, {
          width: container.clientWidth,
          height: getChartHeight(),
          layout: {
            background: { type: ColorType.Solid, color: isDark ? "#0d1410" : "#ffffff" },
            textColor: isDark ? "#8ea195" : "#6b7280",
            fontSize: 11,
          },
          grid: {
            vertLines: { color: isDark ? "#1a2a1d" : "#edf2f7" },
            horzLines: { color: isDark ? "#1a2a1d" : "#edf2f7" },
          },
          crosshair: { mode: CrosshairMode.Normal },
          rightPriceScale: {
            borderColor: isDark ? "#223328" : "#d6cdbb",
            scaleMargins: { top: 0.1, bottom: 0.3 },
          },
          timeScale: {
            borderColor: isDark ? "#223328" : "#d6cdbb",
            timeVisible: timeframe !== "1D",
            secondsVisible: timeframe === "1m",
          },
        });

        const candleSeries = chart.addSeries(CandlestickSeries, {
          upColor: "#10b981",
          downColor: "#ef4444",
          borderUpColor: "#10b981",
          borderDownColor: "#ef4444",
          wickUpColor: "#10b981",
          wickDownColor: "#ef4444",
        });

        const chartData = nextCandles.map((c) => ({
          time: c.time as number,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));
        candleSeries.setData(chartData as any);

        const volumeSeries = chart.addSeries(HistogramSeries, {
          priceFormat: { type: "volume" },
          priceScaleId: "volume",
        });
        chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
        volumeSeries.setData(nextCandles.map((c) => ({
          time: c.time as number,
          value: c.volume,
          color: c.close >= c.open ? "rgba(16,185,129,0.35)" : "rgba(239,68,68,0.35)",
        })) as any);

        chart.addSeries(LineSeries, { color: "#f59e0b", lineWidth: 1, title: "EMA10" })
          .setData(calcEMA(chartData, 10) as any);
        chart.addSeries(LineSeries, { color: "#8b5cf6", lineWidth: 1, title: "EMA30" })
          .setData(calcEMA(chartData, 30) as any);

        chart.timeScale().fitContent();
        const observer = new ResizeObserver(() => {
          if (container.clientWidth > 0) chart.applyOptions({ width: container.clientWidth });
        });
        observer.observe(container);
        setLoading(false);

        return () => {
          observer.disconnect();
          chart.remove();
        };
      } catch (err) {
        if (!disposed) {
          if (chartContainerRef.current) chartContainerRef.current.innerHTML = "";
          setError(err instanceof Error ? err.message : "Lỗi tải chart");
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
  }, [symbol, isDark, timeframe, chartCandles, allowFallbackFetch]);

  function addDrawing(point: { x: number; y: number }) {
    if (activeTool === "cursor" || drawingsLocked) return;
    const oneClick = activeTool === "hline" || activeTool === "vline" || activeTool === "text";
    if (oneClick) {
      const text = activeTool === "text" ? window.prompt("Nội dung ghi chú", "Ghi chú")?.trim() : undefined;
      if (activeTool === "text" && !text) return;
      setDrawings((prev) => [...prev, { id: crypto.randomUUID(), tool: activeTool, points: [point], text } as Drawing]);
      return;
    }

    const pending = pendingPointRef.current;
    if (!pending) {
      pendingPointRef.current = point;
      setPendingPoint(point);
      return;
    }
    setDrawings((prev) => [...prev, { id: crypto.randomUUID(), tool: activeTool, points: [pending, point] } as Drawing]);
    pendingPointRef.current = null;
    setPendingPoint(null);
  }

  return (
    <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2" style={{ borderColor: "var(--border)" }}>
        <div className="flex min-w-0 items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="truncate text-[11px] font-bold" style={{ color: "var(--primary)" }}>
            {symbol} - Biểu đồ giao dịch
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {TIMEFRAMES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onTimeframeChange?.(item)}
              className="rounded-md border px-2 py-1 text-[11px] font-bold"
              style={{
                borderColor: item === timeframe ? "var(--primary)" : "var(--border)",
                background: item === timeframe ? "var(--primary-light)" : "var(--surface)",
                color: item === timeframe ? "var(--primary)" : "var(--text-secondary)",
              }}
            >
              {item}
            </button>
          ))}
          <span className="ml-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
            {exchange}:{symbol} {sourceLabel ? `· ${sourceLabel}` : ""}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b px-3 py-2" style={{ borderColor: "var(--border)" }}>
        <ToolButton label="Con trỏ" active={activeTool === "cursor"} onClick={() => setActiveTool("cursor")}><MousePointer2 className="h-4 w-4" /></ToolButton>
        <ToolButton label="Trendline" active={activeTool === "trend"} onClick={() => setActiveTool("trend")}><Slash className="h-4 w-4" /></ToolButton>
        <ToolButton label="Đường ngang" active={activeTool === "hline"} onClick={() => setActiveTool("hline")}><Minus className="h-4 w-4" /></ToolButton>
        <ToolButton label="Đường dọc" active={activeTool === "vline"} onClick={() => setActiveTool("vline")}><Rows3 className="h-4 w-4 rotate-90" /></ToolButton>
        <ToolButton label="Vùng giá" active={activeTool === "zone"} onClick={() => setActiveTool("zone")}><RectangleHorizontal className="h-4 w-4" /></ToolButton>
        <ToolButton label="Fibonacci" active={activeTool === "fib"} onClick={() => setActiveTool("fib")}><GitGraph className="h-4 w-4" /></ToolButton>
        <ToolButton label="Ghi chú" active={activeTool === "text"} onClick={() => setActiveTool("text")}><Type className="h-4 w-4" /></ToolButton>
        <div className="mx-1 h-6 w-px bg-[var(--border)]" />
        <ToolButton label="Hoàn tác drawing" onClick={() => setDrawings((prev) => prev.slice(0, -1))}><Undo2 className="h-4 w-4" /></ToolButton>
        <ToolButton label={drawingsLocked ? "Mở khóa drawing" : "Khóa drawing"} active={drawingsLocked} onClick={() => setDrawingsLocked((value) => !value)}>
          {drawingsLocked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
        </ToolButton>
        <ToolButton label={drawingsHidden ? "Hiện drawing" : "Ẩn drawing"} active={drawingsHidden} onClick={() => setDrawingsHidden((value) => !value)}>
          {drawingsHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </ToolButton>
        <ToolButton label="Xóa tất cả drawing" onClick={() => setDrawings([])}><Trash2 className="h-4 w-4" /></ToolButton>
      </div>

      <div className="relative">
        <div ref={chartContainerRef} className="w-full" style={{ minHeight: CHART_HEIGHT_MOBILE }}>
          {loading && !error && (
            <div className="flex h-[360px] items-center justify-center md:h-[560px]">
              <div className="flex flex-col items-center gap-3">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500/40 border-t-emerald-400" />
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  Đang tải chart {symbol}...
                </span>
              </div>
            </div>
          )}
          {error && (
            <div className="flex h-[360px] items-center justify-center px-6 text-center md:h-[560px]">
              <span className="text-sm text-yellow-600">{error}</span>
            </div>
          )}
        </div>
        {!drawingsHidden && !error ? (
          <svg
            className="absolute inset-0 h-full w-full"
            style={{
              pointerEvents: activeTool === "cursor" || drawingsLocked ? "none" : "auto",
              cursor: activeTool === "cursor" || drawingsLocked ? "default" : "crosshair",
              zIndex: 2,
            }}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              addDrawing(pointFromEvent(event));
            }}
          >
            {pendingPoint ? (
              <g>
                <circle cx={`${pendingPoint.x}%`} cy={`${pendingPoint.y}%`} r="5" fill="#22c55e" stroke="#ffffff" strokeWidth="2" />
                <line x1={`${pendingPoint.x}%`} y1="0" x2={`${pendingPoint.x}%`} y2="100%" stroke="rgba(34,197,94,0.35)" strokeDasharray="4 4" />
                <line x1="0" y1={`${pendingPoint.y}%`} x2="100%" y2={`${pendingPoint.y}%`} stroke="rgba(34,197,94,0.35)" strokeDasharray="4 4" />
              </g>
            ) : null}
            {drawings.map((drawing) => {
              if (drawing.tool === "zone" && drawing.points[1]) {
                const [a, b] = drawing.points;
                const x = Math.min(a.x, b.x);
                const y = Math.min(a.y, b.y);
                const width = Math.abs(a.x - b.x);
                const height = Math.abs(a.y - b.y);
                return <rect key={drawing.id} x={`${x}%`} y={`${y}%`} width={`${width}%`} height={`${height}%`} fill="rgba(245,158,11,0.12)" stroke="#f59e0b" strokeWidth="1.5" />;
              }
              if (drawing.tool === "fib" && drawing.points[1]) {
                const [a, b] = drawing.points;
                const levels = [0, 23.6, 38.2, 50, 61.8, 100];
                return (
                  <g key={drawing.id}>
                    {levels.map((level) => {
                      const y = a.y + ((b.y - a.y) * level) / 100;
                      return (
                        <g key={level}>
                          <line x1={`${a.x}%`} y1={`${y}%`} x2={`${b.x}%`} y2={`${y}%`} stroke="#22c55e" strokeWidth="1" strokeDasharray="4 4" />
                          <text x={`${Math.min(a.x, b.x)}%`} y={`${y}%`} fill="#22c55e" fontSize="11">{level}%</text>
                        </g>
                      );
                    })}
                  </g>
                );
              }
              if (drawing.tool === "text") {
                const [a] = drawing.points;
                return <text key={drawing.id} x={`${a.x}%`} y={`${a.y}%`} fill="#f59e0b" fontSize="13" fontWeight="700">{drawing.text}</text>;
              }
              const path = drawingPath(drawing);
              if (!path) return null;
              return (
                <line
                  key={drawing.id}
                  x1={`${path.x1}%`}
                  y1={`${path.y1}%`}
                  x2={`${path.x2}%`}
                  y2={`${path.y2}%`}
                  stroke={drawing.tool === "trend" ? "#38bdf8" : "#f59e0b"}
                  strokeWidth="2"
                  strokeDasharray={drawing.tool === "vline" || drawing.tool === "hline" ? "5 5" : undefined}
                />
              );
            })}
          </svg>
        ) : null}
      </div>
    </div>
  );
}

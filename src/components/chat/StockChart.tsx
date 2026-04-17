"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/components/providers/ThemeProvider";

interface StockChartProps {
  symbol: string;
  exchange?: string;
}

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const CHART_HEIGHT_MOBILE = 320;
const CHART_HEIGHT_DESKTOP = 500;

function getChartHeight() {
  return typeof window !== "undefined" && window.innerWidth >= 768
    ? CHART_HEIGHT_DESKTOP
    : CHART_HEIGHT_MOBILE;
}

export function StockChart({ symbol, exchange = "HOSE" }: StockChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    if (!chartContainerRef.current) return;

    let disposed = false;

    async function init() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/chart?symbol=${symbol}`);
        if (!res.ok) throw new Error("Không tải được dữ liệu");
        const { candles } = (await res.json()) as { candles: Candle[] };
        if (!candles?.length) throw new Error("Không có dữ liệu");
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
            timeVisible: false,
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

        const chartData = candles.map((c) => ({
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

        chart.priceScale("volume").applyOptions({
          scaleMargins: { top: 0.8, bottom: 0 },
        });

        const volumeData = candles.map((c) => ({
          time: c.time as number,
          value: c.volume,
          color: c.close >= c.open ? "rgba(16,185,129,0.35)" : "rgba(239,68,68,0.35)",
        }));
        volumeSeries.setData(volumeData as any);

        const ema10Series = chart.addSeries(LineSeries, {
          color: "#f59e0b",
          lineWidth: 1,
          title: "EMA10",
        });
        const ema30Series = chart.addSeries(LineSeries, {
          color: "#8b5cf6",
          lineWidth: 1,
          title: "EMA30",
        });

        function calcEMA(data: typeof chartData, period: number) {
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
              emaData.push({ time: data[i].time as number, value: ema });
              continue;
            }
            ema = data[i].close * k + ema * (1 - k);
            emaData.push({ time: data[i].time as number, value: ema });
          }
          return emaData;
        }

        ema10Series.setData(calcEMA(chartData, 10) as any);
        ema30Series.setData(calcEMA(chartData, 30) as any);
        chart.timeScale().fitContent();

        const observer = new ResizeObserver(() => {
          if (container.clientWidth > 0) {
            chart.applyOptions({ width: container.clientWidth });
          }
        });
        observer.observe(container);

        setLoading(false);

        return () => {
          observer.disconnect();
          chart.remove();
        };
      } catch (err: any) {
        if (!disposed) {
          if (chartContainerRef.current) chartContainerRef.current.innerHTML = "";
          setError(err?.message || "Lỗi tải chart");
          setLoading(false);
        }
      }
      return undefined;
    }

    void init();
    return () => {
      disposed = true;
    };
  }, [symbol, isDark]);

  return (
    <div className="mt-3 rounded-xl overflow-hidden border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-bold font-mono" style={{ color: "var(--primary)" }}>
            {symbol} — Biểu đồ kỹ thuật
          </span>
        </div>
        <div className="flex items-center gap-2 text-[12px] font-mono" style={{ color: "var(--text-muted)" }}>
          <span className="text-yellow-500">━ EMA10</span>
          <span className="text-purple-500">━ EMA30</span>
          <span>{exchange}:{symbol}</span>
        </div>
      </div>

      <div ref={chartContainerRef} className="w-full" style={{ minHeight: CHART_HEIGHT_MOBILE }}>
        {loading && !error && (
          <div className="flex items-center justify-center h-[320px] md:h-[500px]">
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-emerald-500/40 border-t-emerald-400 rounded-full animate-spin" />
              <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                Đang tải chart {symbol}...
              </span>
            </div>
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center h-[320px] md:h-[500px]">
            <div className="flex flex-col items-center gap-2 text-center px-6">
              <svg className="w-8 h-8 text-yellow-500/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
              <span className="text-xs text-yellow-500/80 font-mono">Hệ thống dữ liệu đang bảo trì</span>
              <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                Vui lòng thử lại sau ít phút
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


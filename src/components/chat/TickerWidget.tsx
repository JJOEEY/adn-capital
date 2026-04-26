"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  MessageSquareQuote,
  ShieldCheck,
  AlertTriangle,
  Minus,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────
export interface TickerWidgetData {
  ticker: string;
  data: {
    technical: { data: any; aiInsight: string };
    fundamental: { data: any; aiInsight: string; period: string | null };
    behavior: { data: { teiScore: number; status: string; period: string }; aiInsight: string };
    news: { data: { title: string; time: string; url?: string; source: string }[]; aiInsight: string };
  };
}

type TabId = "ta" | "fa" | "news" | "behavior";

const TABS: { id: TabId; label: string }[] = [
  { id: "ta",       label: "PTKT" },
  { id: "fa",       label: "PTCB" },
  { id: "behavior", label: "HÀNH VI" },
  { id: "news",     label: "TIN TỨC" },
];

// ── Helpers ─────────────────────────────────────────────────────────────
const fmt   = (v?: number | null) => v != null ? v.toLocaleString("vi-VN") : "—";
const fmtPct = (v?: number | null) => v != null ? `${v >= 0 ? "+" : ""}${v.toFixed(2)}%` : "—";

// ── TradingView Chart ───────────────────────────────────────────────────
function TradingViewChart({ ticker }: { ticker: string }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;

    // Cleanup previous chart
    container.current.innerHTML = "";
    
    const wrapper = document.createElement("div");
    wrapper.className = "tradingview-widget-container__widget";
    container.current.appendChild(wrapper);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    // VN stocks: HOSE:FPT, HOSE:VCB, etc.
    const tvSymbol = ticker.length <= 3 
      ? `HOSE:${ticker}` 
      : ticker.startsWith("VN") ? `HOSE:${ticker}` : `HOSE:${ticker}`;
    script.innerHTML = JSON.stringify({
      "autosize": true,
      "symbol": tvSymbol,
      "interval": "D",
      "timezone": "Asia/Ho_Chi_Minh",
      "theme": "dark",
      "style": "1",
      "locale": "vi",
      "enable_publishing": false,
      "hide_top_toolbar": false,
      "hide_legend": false,
      "save_image": false,
      "calendar": false,
      "hide_volume": false,
      "support_host": "https://www.tradingview.com"
    });
    container.current.appendChild(script);

    return () => {
      if (container.current) {
        container.current.innerHTML = "";
      }
    };
  }, [ticker]);

  return (
    <div className="tradingview-widget-container w-full h-[300px] sm:h-[380px] rounded-xl overflow-hidden border border-white/5 bg-black/20" ref={container} />
  );
}


// ── Small stat box ──────────────────────────────────────────────────────
function StatBox({ label, value, sub, highlight }: {
  label: string; value: string; sub?: string; highlight?: "up" | "down" | "neutral";
}) {
  const valueColor = highlight === "up" ? "#16a34a" : highlight === "down" ? "var(--danger)" : "var(--text-primary)";
  return (
    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
      <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: "#334155" }}>{label}</p>
      <p className="text-[13px] font-black leading-tight tabular-nums" style={{ color: valueColor }}>{value}</p>
      {sub && <p className="text-[9px] mt-0.5" style={{ color: "#334155" }}>{sub}</p>}
    </div>
  );
}

// ── AI Insight Card ──────────────────────────────────────────────────────
function AIInsightBlock({ insight }: { insight: string | null }) {
  if (!insight) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="relative rounded-xl overflow-hidden border border-yellow-500/25 bg-gradient-to-br from-yellow-500/[0.08] to-orange-500/[0.04] p-4"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/5 to-transparent pointer-events-none" />
      <div className="flex gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <div className="w-7 h-7 rounded-lg bg-yellow-500/15 border border-yellow-500/25 flex items-center justify-center">
            <MessageSquareQuote className="w-3.5 h-3.5 text-yellow-400" />
          </div>
        </div>
        <div className="flex-1">
          <p className="text-[9px] text-yellow-500/70 font-black uppercase tracking-widest mb-1.5">
            Nhận định AIDEN
          </p>
          <p className="text-[12px] text-slate-200 leading-relaxed whitespace-pre-wrap">{insight}</p>
        </div>
      </div>
    </motion.div>
  );
}

// ── TEI Arc Gauge ────────────────────────────────────────────────────────
function TEIGauge({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(5, value));
  const r = 50;
  const circumference = Math.PI * r;
  const progress = (clamped / 5) * circumference;
  const strokeColor = value >= 4.8 ? "#f87171" : value >= 2.5 ? "#fbbf24" : "#34d399";

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 120 75" className="w-44 overflow-visible">
        <path d="M 10 68 A 50 50 0 0 1 110 68" fill="none" stroke="#1f2937" strokeWidth="10" strokeLinecap="round" />
        <motion.path
          d="M 10 68 A 50 50 0 0 1 110 68"
          fill="none"
          stroke={strokeColor}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 1, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 8px ${strokeColor}80)` }}
        />
        {[0, 1, 2, 3, 4, 5].map(v => {
          const a = Math.PI - (v / 5) * Math.PI;
          const lx = 60 + 64 * Math.cos(a);
          const ly = 68 - 64 * Math.sin(a);
          return <text key={v} x={lx} y={ly} textAnchor="middle" dominantBaseline="central" fill="#4b5563" fontSize="8" fontWeight="bold">{v}</text>;
        })}
        <text x="60" y="60" textAnchor="middle" fill={strokeColor} fontSize="20" fontWeight="900">{value.toFixed(1)}</text>
        <text x="60" y="71" textAnchor="middle" fill="#6b7280" fontSize="7" fontWeight="bold">ART</text>
      </svg>
    </div>
  );
}

// ── MAIN COMPONENT ───────────────────────────────────────────────────────
export function TickerWidget({ ticker, data }: TickerWidgetData) {
  const [activeTab, setActiveTab] = useState<TabId>("ta");

  const ta       = data.technical?.data;
  const fa       = data.fundamental?.data;
  const behavior = data.behavior?.data;
  const teiScore = behavior?.teiScore ?? 2.5;
  const isUp     = (ta?.price?.changePct ?? 0) >= 0;

  const teiColor = teiScore >= 4.8 ? "text-red-400" : teiScore >= 2.5 ? "text-yellow-400" : "text-emerald-400";

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="w-full max-w-full sm:max-w-2xl my-2 mx-auto"
    >
      <Card glass glow={isUp ? "emerald" : "red"} className="overflow-hidden border-white/10">

        {/* Header */}
        <div className="px-4 sm:px-6 pt-5 pb-4 border-b border-white/[0.07] flex items-center justify-between gap-4 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/[0.07] border border-white/[0.10] flex items-center justify-center font-black text-sm text-white shadow-inner">
              {ticker.slice(0, 3)}
            </div>
            <div>
              <h3 className="text-lg font-black text-white tracking-tight">{ticker}</h3>
              <p className="text-[10px] text-slate-500 mt-0.5 uppercase font-bold tracking-widest">ADN Capital Quant</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl sm:text-3xl font-black text-white tabular-nums tracking-tighter">{fmt(ta?.price?.current)}</p>
            <div className={cn("flex items-center justify-end gap-1 text-xs sm:text-sm font-black", isUp ? "text-emerald-400" : "text-red-400")}>
              {isUp ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              {fmtPct(ta?.price?.changePct)}
            </div>
          </div>
        </div>

        {/* Tab Bar - Text Only */}
        <div className="flex border-b border-white/[0.07] bg-black/20">
          {TABS.map(tab => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex-1 pt-4 pb-3 text-[11px] sm:text-xs font-black transition-all duration-300 relative uppercase tracking-widest",
                  active ? "text-yellow-400" : "text-slate-500 hover:text-slate-300"
                )}
              >
                {tab.label}
                {active && (
                  <motion.div
                    layoutId="tabUnderline"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-yellow-500"
                    style={{ boxShadow: "0 0 12px rgba(251,191,36,0.6)" }}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-6 min-h-[300px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              {/* PTKT */}
              {activeTab === "ta" && (
                <>
                  <TradingViewChart ticker={ticker} />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <StatBox label="Xu hướng" value={ta?.trend?.direction ?? "—"} />
                    <StatBox label="Tín hiệu" value={ta?.signal ?? "—"}
                      highlight={ta?.signal?.includes("BUY") || ta?.signal?.includes("TĂNG") ? "up" :
                                 ta?.signal?.includes("SELL") || ta?.signal?.includes("GIẢM") ? "down" : "neutral"} />
                    <StatBox label="RSI (14)" value={ta?.indicators?.rsi14 != null ? ta.indicators.rsi14.toFixed(1) : "—"}
                      sub={ta?.indicators?.rsi14 > 70 ? "Quá mua" : ta?.indicators?.rsi14 < 30 ? "Quá bán" : "Trung tính"} />
                    <StatBox label="Bull/Bear" value={`${ta?.bullishScore ?? "?"} / ${ta?.bearishScore ?? "?"}`} />
                  </div>
                  <AIInsightBlock insight={data.technical?.aiInsight} />
                </>
              )}

              {/* PTCB */}
              {activeTab === "fa" && (
                <>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Kỳ báo cáo: {data.fundamental.period || "N/A"}</p>
                    <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] font-black">BCTC</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <StatBox label="P/E" value={fa?.pe ? `${fa.pe}x` : "—"} />
                    <StatBox label="P/B" value={fa?.pb ? `${fa.pb}x` : "—"} />
                    <StatBox label="ROE" value={fa?.roe ? `${fa.roe}%` : "—"} />
                    <StatBox label="Tăng trưởng LN" value={fmtPct(fa?.profitGrowthYoY)}
                      highlight={fa?.profitGrowthYoY != null ? fa.profitGrowthYoY >= 0 ? "up" : "down" : "neutral"} />
                    <StatBox label="Doanh thu" value={fa?.revenueLastQ ? `${fmt(fa.revenueLastQ)} tỷ` : "—"} />
                    <StatBox label="Lợi nhuận" value={fa?.profitLastQ ? `${fmt(fa.profitLastQ)} tỷ` : "—"} />
                  </div>
                  <AIInsightBlock insight={data.fundamental?.aiInsight} />
                </>
              )}

              {/* Tin Tức */}
              {activeTab === "news" && (
                <>
                  <div className="space-y-2">
                    {(data.news?.data || []).slice(0, 6).map((item, i) => (
                      <motion.a
                        key={i}
                        href={item.url || "#"}
                        target={item.url ? "_blank" : undefined}
                        rel="noopener noreferrer"
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className="group flex items-start gap-3 p-3 rounded-xl hover:bg-white/[0.04] border border-transparent hover:border-white/5 transition-all block"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-400/70 mt-2 flex-shrink-0 shadow-[0_0_8px_rgba(251,191,36,0.4)]" />
                        <div className="flex-1">
                          <p className="text-xs sm:text-[13px] text-slate-300 group-hover:text-white transition-colors line-clamp-2 leading-relaxed font-medium">
                            {item.title}
                          </p>
                          <div className="flex items-center justify-between mt-1.5">
                            <p className="text-[10px] text-slate-600 font-bold">{item.time}</p>
                            <p className="text-[9px] text-slate-700 font-black uppercase tracking-tighter">{item.source}</p>
                          </div>
                        </div>
                      </motion.a>
                    ))}
                  </div>
                  <AIInsightBlock insight={data.news?.aiInsight} />
                </>
              )}

              {/* Hành Vi */}
              {activeTab === "behavior" && (
                <div className="flex flex-col items-center gap-6">
                  <div className="w-full flex justify-between items-center px-2">
                    <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Dữ liệu: {behavior?.period ?? "Hôm nay"}</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase">Real-time</span>
                  </div>
                  <TEIGauge value={teiScore} />
                  <div className={cn("text-center text-base font-black uppercase tracking-widest", teiColor)}>
                    {behavior?.status ?? "—"}
                  </div>
                  <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { label: "Hưng phấn cực độ (≥ 4.8)", style: { color: "var(--danger)" }, icon: AlertTriangle },
                      { label: "Trung tính (2.0 – 4.0)", style: { color: "#eab308" }, icon: Minus },
                      { label: "Bi quan – Cơ hội (≤ 1.0)", style: { color: "#16a34a" }, icon: ShieldCheck },
                    ].map(item => (
                      <div key={item.label} className="flex items-center gap-2 text-[10px] px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5">
                        <item.icon className="w-3.5 h-3.5 flex-shrink-0" style={item.style} />
                        <span className="font-bold" style={item.style}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                  <AIInsightBlock insight={data.behavior?.aiInsight} />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer - Cleaned up as requested */}
        <div className="px-6 py-3 border-t border-white/[0.06] flex items-center justify-between bg-black/40">
          <span className="text-[10px] text-slate-600 font-black uppercase tracking-widest">ADN Capital · Quant Engine</span>
          <div className="flex items-center gap-1.5 opacity-50">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] text-emerald-500 font-black uppercase">Live Data</span>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

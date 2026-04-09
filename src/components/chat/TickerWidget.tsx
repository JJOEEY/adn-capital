"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  BarChart3,
  Newspaper,
  Activity,
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

const TABS: { id: TabId; label: string; icon: typeof TrendingUp }[] = [
  { id: "ta",       label: "PTKT",   icon: TrendingUp },
  { id: "fa",       label: "PTCB",   icon: BarChart3 },
  { id: "news",     label: "Tin Tức", icon: Newspaper },
  { id: "behavior", label: "Hành Vi", icon: Activity },
];

// ── Helpers ─────────────────────────────────────────────────────────────
const fmt   = (v?: number | null) => v != null ? v.toLocaleString("vi-VN") : "—";
const fmtPct = (v?: number | null) => v != null ? `${v >= 0 ? "+" : ""}${v.toFixed(2)}%` : "—";

// ── Small stat box ──────────────────────────────────────────────────────
function StatBox({ label, value, sub, highlight }: {
  label: string; value: string; sub?: string; highlight?: "up" | "down" | "neutral";
}) {
  const valueColor = highlight === "up" ? "text-emerald-400" : highlight === "down" ? "text-red-400" : "text-white";
  return (
    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-1">{label}</p>
      <p className={cn("text-[13px] font-black leading-tight tabular-nums", valueColor)}>{value}</p>
      {sub && <p className="text-[9px] text-slate-600 mt-0.5">{sub}</p>}
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
        <div>
          <p className="text-[9px] text-yellow-500/70 font-black uppercase tracking-widest mb-1.5">
            Nhận định AI — Khổng Minh
          </p>
          <p className="text-[12px] text-slate-200 leading-relaxed">{insight}</p>
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
  const strokeColor = value >= 4.5 ? "#f87171" : value >= 2.5 ? "#fbbf24" : "#34d399";

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
        <text x="60" y="71" textAnchor="middle" fill="#6b7280" fontSize="7" fontWeight="bold">TEI</text>
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

  const teiColor = teiScore >= 4.5 ? "text-red-400" : teiScore >= 2.5 ? "text-yellow-400" : "text-emerald-400";

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="w-full max-w-xl my-2"
    >
      <Card glass glow={isUp ? "emerald" : "red"} className="overflow-hidden">

        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-white/[0.07] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/[0.07] border border-white/[0.10] flex items-center justify-center font-black text-sm text-white">
              {ticker.slice(0, 3)}
            </div>
            <div>
              <h3 className="text-base font-black text-white">{ticker}</h3>
              <p className="text-[9px] text-slate-600 mt-0.5 uppercase font-bold tracking-wider">ADN Capital Quant</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-white tabular-nums">{fmt(ta?.price?.current)}</p>
            <div className={cn("flex items-center justify-end gap-1 text-xs font-bold", isUp ? "text-emerald-400" : "text-red-400")}>
              {isUp ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              {fmtPct(ta?.price?.changePct)}
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex border-b border-white/[0.07]">
          {TABS.map(tab => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex-1 pt-3 pb-2.5 flex flex-col items-center gap-1 text-[10px] font-bold transition-all duration-300 relative",
                  active ? "text-white" : "text-slate-600 hover:text-slate-300"
                )}
              >
                <tab.icon className={cn("w-3.5 h-3.5 transition-transform duration-300", active && "scale-110")} />
                <span className="hidden xs:inline">{tab.label}</span>
                {active && (
                  <motion.div
                    layoutId="tabUnderline"
                    className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-gradient-to-r from-yellow-500 via-orange-400 to-yellow-500"
                    style={{ boxShadow: "0 0 10px rgba(251,191,36,0.5)" }}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="p-5 min-h-[220px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {activeTab === "ta" && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <StatBox label="Xu hướng" value={ta?.trend?.direction ?? "—"} sub={ta?.trend?.strength} />
                    <StatBox label="Tín hiệu" value={ta?.signal ?? "—"}
                      highlight={ta?.signal?.includes("BUY") || ta?.signal?.includes("TĂNG") ? "up" :
                                 ta?.signal?.includes("SELL") || ta?.signal?.includes("GIẢM") ? "down" : "neutral"} />
                    <StatBox label="RSI (14)" value={ta?.indicators?.rsi14 != null ? ta.indicators.rsi14.toFixed(1) : "—"}
                      sub={ta?.indicators?.rsi14 > 70 ? "Quá mua" : ta?.indicators?.rsi14 < 30 ? "Quá bán" : "Trung tính"} />
                    <StatBox label="Bull/Bear" value={`${ta?.bullishScore ?? "?"} / ${ta?.bearishScore ?? "?"}`} />
                  </div>
                  {ta?.patterns?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {ta.patterns.map((p: string) => (
                        <span key={p} className="px-2 py-0.5 rounded-md bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-[9px] font-bold">{p}</span>
                      ))}
                    </div>
                  )}
                  <AIInsightBlock insight={data.technical?.aiInsight} />
                </>
              )}

              {activeTab === "fa" && (
                <>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] text-slate-500 font-bold uppercase">Kỳ báo cáo: {data.fundamental.period || "N/A"}</p>
                    <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[8px] font-black">BCTC</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
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

              {activeTab === "news" && (
                <>
                  <div className="space-y-1.5">
                    {(data.news?.data || []).slice(0, 6).map((item, i) => (
                      <motion.a
                        key={i}
                        href={item.url || "#"}
                        target={item.url ? "_blank" : undefined}
                        rel="noopener noreferrer"
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className="group flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-white/[0.04] transition-colors block"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-400/70 mt-1.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-[11px] text-slate-300 group-hover:text-white transition-colors line-clamp-2 leading-relaxed">
                            {item.title}
                          </p>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-[9px] text-slate-600">{item.time}</p>
                            <p className="text-[8px] text-slate-700 font-bold uppercase">{item.source}</p>
                          </div>
                        </div>
                      </motion.a>
                    ))}
                  </div>
                  <AIInsightBlock insight={data.news?.aiInsight} />
                </>
              )}

              {activeTab === "behavior" && (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-full flex justify-between items-center px-2">
                    <span className="text-[9px] text-slate-500 font-bold uppercase">Dữ liệu: {behavior?.period ?? "Hôm nay"}</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[8px] font-black">REAL-TIME</span>
                  </div>
                  <TEIGauge value={teiScore} />
                  <div className={cn("text-center text-sm font-black", teiColor)}>
                    {behavior?.status ?? "—"}
                  </div>
                  <div className="w-full space-y-1">
                    {[
                      { label: "Hưng phấn cực độ (≥ 4.5)", color: "text-red-400", icon: AlertTriangle },
                      { label: "Trung tính (2.0 – 4.0)", color: "text-yellow-400", icon: Minus },
                      { label: "Bi quan – Cơ hội (≤ 1.0)", color: "text-emerald-400", icon: ShieldCheck },
                    ].map(item => (
                      <div key={item.label} className="flex items-center gap-2 text-[10px] px-2 py-1">
                        <item.icon className={cn("w-3 h-3 flex-shrink-0", item.color)} />
                        <span className={item.color}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                  <AIInsightBlock insight={data.behavior?.aiInsight} />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-white/[0.06] flex items-center justify-between bg-white/[0.01]">
          <span className="text-[9px] text-slate-700 italic">ADN Capital · FiinQuant Data</span>
          <span className="text-[9px] text-slate-600">
            <span className="font-mono">/ta {ticker}</span> để phân tích đầy đủ
          </span>
        </div>
      </Card>
    </motion.div>
  );
}

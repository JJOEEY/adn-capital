"use client";

import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
  Tooltip,
} from "recharts";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Banknote,
  ChevronDown,
  Calendar,
  Zap,
  Shield,
  Target,
  AlertTriangle,
  RefreshCw,
  Briefcase,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { LockOverlay } from "@/components/ui/LockOverlay";
import { useSubscription } from "@/hooks/useSubscription";

/* ─────── Types ─────── */
interface HoldingSignal {
  tier: string;
  status: string;
  pnl: number | null;
}

interface Holding {
  ticker: string;
  qty: number;
  avgPrice: number;
  totalCost: number;
  marketValue: number;
  signal: HoldingSignal | null;
}

interface Allocation {
  ticker: string;
  value: number;
  pct: number;
}

interface Transaction {
  id: string;
  action: string;
  price: number;
  qty: number;
  date: string;
  psychologyTag: string | null;
  tradeReason: string | null;
}

interface ClosedTrade {
  ticker: string;
  pnl: number;
  buyPrice: number;
  sellPrice: number;
  qty: number;
  date: string;
}

interface PortfolioData {
  initialNAV: number;
  realizedPnL: number;
  holdingsValue: number;
  cash: number;
  currentNAV: number;
  navChangePercent: number;
  allocation: Allocation[];
  currentHoldings: Holding[];
  txByTicker: Record<string, Transaction[]>;
  closedTrades: ClosedTrade[];
  stats: {
    totalTrades: number;
    closedTrades: number;
    winTrades: number;
    lossTrades: number;
    winRate: number;
  };
}

interface SparklineData {
  [ticker: string]: { date: string; close: number }[];
}

/* ─────── Helpers ─────── */
const fmt = (n: number) =>
  n.toLocaleString("vi-VN", { maximumFractionDigits: 0 });
const fmtPct = (n: number) => (n >= 0 ? "+" : "") + n.toFixed(1) + "%";

const DONUT_COLORS = [
  "#10b981", "#6366f1", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#f97316", "#ec4899", "#14b8a6", "#a78bfa",
];
const CASH_COLOR = "#374151";

/* AI Signal Badge */
function SignalBadge({ signal }: { signal: HoldingSignal | null }) {
  if (!signal) return null;
  const tierMap: Record<string, { icon: typeof Zap; color: string; label: string }> = {
    LEADER: { icon: Zap, color: "text-amber-400", label: "Leader" },
    TRUNG_HAN: { icon: Shield, color: "text-blue-400", label: "Trung hạn" },
    NGAN_HAN: { icon: Target, color: "text-emerald-400", label: "Ngắn hạn" },
  };
  const cfg = tierMap[signal.tier] ?? tierMap.NGAN_HAN;
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[9px] font-bold ${cfg.color} bg-current/10 px-1.5 py-0.5 rounded-full`}
      style={{ backgroundColor: `color-mix(in srgb, currentColor 10%, transparent)` }}
      title={`AI Signal: ${cfg.label} (${signal.status})`}
    >
      <Icon className="w-2.5 h-2.5" />
      {cfg.label}
    </span>
  );
}

/* Sparkline mini chart */
function Sparkline({ data }: { data: { date: string; close: number }[] }) {
  if (!data || data.length < 2) {
    return <div className="w-[80px] h-[28px] bg-neutral-800/30 rounded animate-pulse" />;
  }

  const first = data[0].close;
  const last = data[data.length - 1].close;
  const isUp = last >= first;

  return (
    <div className="w-[80px] h-[28px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="close"
            stroke={isUp ? "#10b981" : "#ef4444"}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
          <Tooltip
            contentStyle={{
              background: "#1a1a1a",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              fontSize: 10,
              color: "#e5e5e5",
              padding: "4px 8px",
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(v: any) => [fmt(Number(v ?? 0)), "Giá"]}
            labelFormatter={(l) => String(l)}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─────── Expandable Detail Panel ─────── */
function DetailPanel({
  ticker,
  transactions,
}: {
  ticker: string;
  transactions: Transaction[];
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    let list = [...transactions];
    if (from) list = list.filter((t) => t.date >= from);
    if (to) list = list.filter((t) => t.date <= to + "T23:59:59.999Z");
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, from, to]);

  // Calculate realized PnL within filtered period
  const filteredPnL = useMemo(() => {
    const buys: { price: number; qty: number }[] = [];
    let pnl = 0;
    // Sort by date for FIFO matching
    const sorted = [...filtered].sort((a, b) => a.date.localeCompare(b.date));
    for (const tx of sorted) {
      if (tx.action === "BUY") {
        buys.push({ price: tx.price, qty: tx.qty });
      } else if (tx.action === "SELL") {
        let sellQty = tx.qty;
        while (sellQty > 0 && buys.length > 0) {
          const oldest = buys[0];
          const matched = Math.min(sellQty, oldest.qty);
          pnl += (tx.price - oldest.price) * matched;
          oldest.qty -= matched;
          sellQty -= matched;
          if (oldest.qty <= 0) buys.shift();
        }
      }
    }
    return pnl;
  }, [filtered]);

  const clearFilter = () => {
    setFrom("");
    setTo("");
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="overflow-hidden"
    >
      <div className="px-4 py-4 bg-white/[0.02] border-t border-white/[0.04]">
        {/* Date Range Filter */}
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <label className="text-[10px] text-neutral-500 block mb-1">
              <Calendar className="w-3 h-3 inline mr-0.5" />
              Từ ngày
            </label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs px-2.5 py-1.5 rounded-lg outline-none focus:border-emerald-500/50"
            />
          </div>
          <div>
            <label className="text-[10px] text-neutral-500 block mb-1">
              Đến ngày
            </label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs px-2.5 py-1.5 rounded-lg outline-none focus:border-emerald-500/50"
            />
          </div>
          {(from || to) && (
            <button
              onClick={clearFilter}
              className="text-[10px] text-neutral-500 hover:text-neutral-300 underline pb-1"
            >
              Xóa lọc
            </button>
          )}
        </div>

        {/* Realized PnL Badge */}
        {filtered.some((t) => t.action === "SELL") && (
          <div
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl mb-4 border ${
              filteredPnL >= 0
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : "bg-red-500/10 border-red-500/20 text-red-400"
            }`}
          >
            <span className="text-[10px] uppercase tracking-wider font-medium opacity-70">
              Lợi nhuận đã chốt {from || to ? "(trong kỳ)" : "(toàn bộ)"}
            </span>
            <span className="text-lg font-black font-mono">
              {filteredPnL >= 0 ? "+" : ""}
              {fmt(filteredPnL)}
            </span>
          </div>
        )}

        {/* Transaction History */}
        <div className="max-h-[300px] overflow-y-auto space-y-1">
          {filtered.length === 0 ? (
            <p className="text-xs text-neutral-600 py-4 text-center">
              Không có giao dịch {ticker} trong khoảng này
            </p>
          ) : (
            filtered.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-neutral-800/30 hover:bg-neutral-800/60 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      tx.action === "BUY"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-red-500/15 text-red-400"
                    }`}
                  >
                    {tx.action === "BUY" ? "MUA" : "BÁN"}
                  </span>
                  <div>
                    <span className="text-xs font-mono text-neutral-200">
                      {fmt(tx.price)} × {tx.qty.toLocaleString("vi-VN")}
                    </span>
                    <span className="text-[10px] text-neutral-600 ml-2">
                      = {fmt(tx.price * tx.qty)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {tx.psychologyTag && (
                    <span className="text-[9px] text-neutral-500 bg-neutral-800 px-1.5 py-0.5 rounded">
                      {tx.psychologyTag}
                    </span>
                  )}
                  <span className="text-[10px] text-neutral-600 font-mono">
                    {new Date(tx.date).toLocaleDateString("vi-VN")}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ═════════════════ MAIN PAGE ═════════════════ */
export default function PortfolioPage() {
  const { isVip } = useSubscription();
  const [data, setData] = useState<PortfolioData | null>(null);
  const [sparklines, setSparklines] = useState<SparklineData>({});
  const [loading, setLoading] = useState(true);
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);

  const fetchPortfolio = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/portfolio");
      if (!res.ok) throw new Error("Failed");
      const d: PortfolioData = await res.json();
      setData(d);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch sparkline data for all holdings
  const fetchSparklines = useCallback(async (tickers: string[]) => {
    const results: SparklineData = {};
    await Promise.all(
      tickers.map(async (ticker) => {
        try {
          const res = await fetch(`/api/historical/${ticker}?days=10`);
          if (!res.ok) return;
          const json = await res.json();
          // Take last 7 data points
          const raw: { date?: string; close?: number }[] = json.data ?? [];
          results[ticker] = raw
            .slice(-7)
            .map((d) => ({ date: d.date ?? "", close: d.close ?? 0 }));
        } catch {
          /* silent */
        }
      }),
    );
    setSparklines(results);
  }, []);

  useEffect(() => {
    fetchPortfolio();
  }, [fetchPortfolio]);

  useEffect(() => {
    if (data && data.currentHoldings.length > 0) {
      fetchSparklines(data.currentHoldings.map((h) => h.ticker));
    }
  }, [data, fetchSparklines]);

  // Donut chart data
  const donutData = useMemo(() => {
    if (!data) return [];
    return data.allocation.map((a, i) => ({
      name: a.ticker,
      value: Math.max(a.value, 0),
      pct: a.pct,
      fill: a.ticker === "Tiền mặt" ? CASH_COLOR : DONUT_COLORS[i % DONUT_COLORS.length],
    }));
  }, [data]);

  return (
    <MainLayout>
      <LockOverlay isLocked={!isVip} message="Nâng cấp VIP để quản lý danh mục">
        <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
          {/* ─── Page Title ─── */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-lg font-black text-white tracking-tight">
                  Visual Asset Manager
                </h1>
                <p className="text-[10px] text-neutral-500">
                  Quản lý danh mục đầu tư chuyên nghiệp
                </p>
              </div>
            </div>
            <button
              onClick={fetchPortfolio}
              disabled={loading}
              className="p-2 rounded-lg bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-700/50 transition-colors"
            >
              <RefreshCw
                className={`w-4 h-4 text-neutral-400 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>

          {loading && !data ? (
            <LoadingSkeleton />
          ) : data ? (
            <>
              {/* ═══════ PART 1: HEADER — GLASSMORPHISM + DONUT ═══════ */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                {/* Left: Key Metrics — Glass Cards */}
                <div className="lg:col-span-3 space-y-3">
                  {/* Main NAV Card */}
                  <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-2xl p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_8px_32px_-8px_rgba(0,0,0,0.4)]">
                    {/* Gradient glow behind */}
                    <div className="absolute -top-20 -right-20 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

                    <div className="relative">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 mb-1">
                        Tổng giá trị tài sản
                      </p>
                      <div className="flex items-baseline gap-3">
                        <span className="text-3xl font-black font-mono text-white tracking-tight">
                          {fmt(data.currentNAV)}
                        </span>
                        <span className="text-[10px] text-neutral-600">VNĐ</span>
                        {data.initialNAV > 0 && (
                          <span
                            className={`text-xs font-bold font-mono px-2 py-0.5 rounded-full ${
                              data.navChangePercent >= 0
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "bg-red-500/10 text-red-400"
                            }`}
                          >
                            {fmtPct(data.navChangePercent)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Sub Metrics Row */}
                  <div className="grid grid-cols-3 gap-3">
                    {/* Cash */}
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Banknote className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-[10px] text-neutral-500">Tiền mặt</span>
                      </div>
                      <p className="text-sm font-black font-mono text-amber-300">
                        {fmt(data.cash)}
                      </p>
                    </div>
                    {/* Unrealized */}
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Wallet className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-[10px] text-neutral-500">Đang nắm giữ</span>
                      </div>
                      <p className="text-sm font-black font-mono text-blue-300">
                        {fmt(data.holdingsValue)}
                      </p>
                    </div>
                    {/* Realized PnL */}
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
                      <div className="flex items-center gap-1.5 mb-2">
                        {data.realizedPnL >= 0 ? (
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                        )}
                        <span className="text-[10px] text-neutral-500">PnL đã chốt</span>
                      </div>
                      <p
                        className={`text-sm font-black font-mono ${
                          data.realizedPnL >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {data.realizedPnL >= 0 ? "+" : ""}
                        {fmt(data.realizedPnL)}
                      </p>
                    </div>
                  </div>

                  {/* Win Rate Pill */}
                  {data.stats.closedTrades > 0 && (
                    <div className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl px-4 py-3">
                      <div className="flex-1">
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-neutral-500">
                            Win Rate ({data.stats.winTrades}W / {data.stats.lossTrades}L)
                          </span>
                          <span
                            className={`font-bold font-mono ${
                              data.stats.winRate >= 50 ? "text-emerald-400" : "text-red-400"
                            }`}
                          >
                            {data.stats.winRate}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              data.stats.winRate >= 50 ? "bg-emerald-500" : "bg-red-500"
                            }`}
                            style={{ width: `${data.stats.winRate}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-[10px] text-neutral-600 font-mono">
                        {data.stats.totalTrades} lệnh
                      </span>
                    </div>
                  )}
                </div>

                {/* Right: Donut Chart — Allocation */}
                <div className="lg:col-span-2">
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] h-full flex flex-col">
                    <p className="text-[10px] uppercase tracking-[0.15em] text-neutral-500 mb-3">
                      Phân bổ tài sản
                    </p>

                    {donutData.length > 0 ? (
                      <>
                        <div className="flex-1 min-h-[160px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={donutData}
                                cx="50%"
                                cy="50%"
                                innerRadius="55%"
                                outerRadius="85%"
                                paddingAngle={2}
                                dataKey="value"
                                nameKey="name"
                                strokeWidth={0}
                                isAnimationActive={true}
                                animationDuration={600}
                              >
                                {donutData.map((d, i) => (
                                  <Cell key={i} fill={d.fill} />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{
                                  background: "#1a1a1a",
                                  border: "1px solid rgba(255,255,255,0.1)",
                                  borderRadius: 12,
                                  fontSize: 11,
                                  color: "#e5e5e5",
                                  padding: "6px 12px",
                                }}
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                formatter={(v: any, name: any) => [fmt(Number(v ?? 0)) + " VNĐ", String(name)]}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Legend */}
                        <div className="mt-3 space-y-1.5">
                          {donutData.map((d) => (
                            <div key={d.name} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2.5 h-2.5 rounded-full"
                                  style={{ backgroundColor: d.fill }}
                                />
                                <span className="text-[11px] text-neutral-400">{d.name}</span>
                              </div>
                              <span className="text-[11px] font-mono font-bold text-neutral-300">
                                {d.pct}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 flex items-center justify-center">
                        <p className="text-xs text-neutral-600">Chưa có vị thế</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ═══════ PART 2: SMART TABLE ═══════ */}
              {data.currentHoldings.length > 0 ? (
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl overflow-hidden shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
                  {/* Table Header */}
                  <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-neutral-500">
                    <div className="col-span-3 sm:col-span-2">Mã CP</div>
                    <div className="col-span-2 text-right hidden sm:block">KL</div>
                    <div className="col-span-2 text-right">Giá vốn</div>
                    <div className="col-span-2 text-right hidden sm:block">Giá TT</div>
                    <div className="col-span-2 text-right">Lãi/Lỗ</div>
                    <div className="col-span-3 sm:col-span-2 text-center">7 ngày</div>
                  </div>

                  {/* Rows */}
                  {data.currentHoldings.map((h) => {
                    const isExpanded = expandedTicker === h.ticker;
                    const pnlValue = h.marketValue - h.totalCost;
                    const pnlPct =
                      h.totalCost > 0
                        ? ((h.marketValue - h.totalCost) / h.totalCost) * 100
                        : 0;
                    const txs = data.txByTicker[h.ticker] ?? [];

                    return (
                      <Fragment key={h.ticker}>
                        <div
                          onClick={() =>
                            setExpandedTicker(isExpanded ? null : h.ticker)
                          }
                          className={`grid grid-cols-12 gap-2 px-4 py-3 cursor-pointer transition-colors hover:bg-white/[0.03] ${
                            isExpanded ? "bg-white/[0.04]" : ""
                          } border-b border-white/[0.03]`}
                        >
                          {/* Ticker + Signal Badge */}
                          <div className="col-span-3 sm:col-span-2 flex items-center gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-black text-white font-mono">
                                  {h.ticker}
                                </span>
                                <SignalBadge signal={h.signal} />
                              </div>
                              <span className="text-[10px] text-neutral-600 sm:hidden">
                                {h.qty.toLocaleString("vi-VN")} cp
                              </span>
                            </div>
                          </div>

                          {/* Quantity */}
                          <div className="col-span-2 text-right hidden sm:flex items-center justify-end">
                            <span className="text-xs font-mono text-neutral-300">
                              {h.qty.toLocaleString("vi-VN")}
                            </span>
                          </div>

                          {/* Avg Price */}
                          <div className="col-span-2 text-right flex items-center justify-end">
                            <span className="text-xs font-mono text-neutral-300">
                              {fmt(h.avgPrice)}
                            </span>
                          </div>

                          {/* Market Price (approx) */}
                          <div className="col-span-2 text-right hidden sm:flex items-center justify-end">
                            <span className="text-xs font-mono text-neutral-400">
                              {fmt(Math.round(h.marketValue / h.qty))}
                            </span>
                          </div>

                          {/* PnL */}
                          <div className="col-span-2 text-right flex items-center justify-end">
                            <div>
                              <p
                                className={`text-xs font-bold font-mono ${
                                  pnlValue >= 0 ? "text-emerald-400" : "text-red-400"
                                }`}
                              >
                                {pnlValue >= 0 ? "+" : ""}
                                {fmt(pnlValue)}
                              </p>
                              <p
                                className={`text-[9px] font-mono ${
                                  pnlPct >= 0 ? "text-emerald-500/70" : "text-red-500/70"
                                }`}
                              >
                                {fmtPct(pnlPct)}
                              </p>
                            </div>
                          </div>

                          {/* Sparkline + Expand Arrow */}
                          <div className="col-span-3 sm:col-span-2 flex items-center justify-center gap-1">
                            <Sparkline data={sparklines[h.ticker] ?? []} />
                            <motion.div
                              animate={{ rotate: isExpanded ? 180 : 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <ChevronDown className="w-3.5 h-3.5 text-neutral-600" />
                            </motion.div>
                          </div>
                        </div>

                        {/* Expandable Detail Panel */}
                        <AnimatePresence>
                          {isExpanded && (
                            <DetailPanel
                              ticker={h.ticker}
                              transactions={txs}
                            />
                          )}
                        </AnimatePresence>
                      </Fragment>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-12 text-center">
                  <Briefcase className="w-8 h-8 text-neutral-700 mx-auto mb-3" />
                  <p className="text-sm text-neutral-500">
                    Chưa có vị thế nào. Ghi nhật ký MUA để bắt đầu quản lý danh mục.
                  </p>
                </div>
              )}

              {/* ═══════ CLOSED TRADES SUMMARY ═══════ */}
              {data.closedTrades.length > 0 && (
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/[0.06]">
                    <p className="text-[10px] uppercase tracking-[0.15em] text-neutral-500">
                      Giao dịch đã chốt gần đây
                    </p>
                  </div>
                  <div className="max-h-[240px] overflow-y-auto">
                    {data.closedTrades.map((t, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono font-black text-white w-10">
                            {t.ticker}
                          </span>
                          <span className="text-[10px] text-neutral-600 font-mono">
                            {t.qty}cp · {fmt(t.buyPrice)} → {fmt(t.sellPrice)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`text-xs font-bold font-mono ${
                              t.pnl >= 0 ? "text-emerald-400" : "text-red-400"
                            }`}
                          >
                            {t.pnl >= 0 ? "+" : ""}
                            {fmt(t.pnl)}
                          </span>
                          <span className="text-[9px] text-neutral-700 font-mono">
                            {new Date(t.date).toLocaleDateString("vi-VN")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-12 text-center">
              <AlertTriangle className="w-8 h-8 text-neutral-700 mx-auto mb-3" />
              <p className="text-sm text-neutral-500">Không tải được dữ liệu danh mục.</p>
            </div>
          )}
        </div>
      </LockOverlay>
    </MainLayout>
  );
}

/* Loading state */
function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 space-y-3">
          <div className="h-32 rounded-2xl bg-neutral-900/50 animate-pulse" />
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-2xl bg-neutral-900/50 animate-pulse" />
            ))}
          </div>
        </div>
        <div className="lg:col-span-2">
          <div className="h-[280px] rounded-2xl bg-neutral-900/50 animate-pulse" />
        </div>
      </div>
      <div className="h-48 rounded-2xl bg-neutral-900/50 animate-pulse" />
    </div>
  );
}

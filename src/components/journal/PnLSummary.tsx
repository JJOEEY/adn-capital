"use client";

import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  Tooltip,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PieChart,
  BarChart3,
  ChevronDown,
  Calendar,
  Filter,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

/* ─── Types ─── */
interface TxRecord {
  id: string;
  action: string;
  price: number;
  qty: number;
  date: string;
  psychologyTag: string | null;
}

interface PnLData {
  initialNAV: number;
  realizedPnL: number;
  unrealizedPnL: number;
  holdingsCostBasis: number;
  holdingsMarketValue: number;
  currentNAV: number;
  currentHoldings: {
    ticker: string;
    qty: number;
    avgPrice: number;
    totalCost: number;
    marketPrice: number;
    marketValue: number;
  }[];
  closedTrades: {
    ticker: string;
    pnl: number;
    buyPrice: number;
    sellPrice: number;
    qty: number;
    date: string;
  }[];
  txByTicker: Record<string, TxRecord[]>;
  stats: {
    totalTrades: number;
    closedTrades: number;
    winTrades: number;
    lossTrades: number;
    winRate: number;
  };
}

type SparklineData = Record<string, { date: string; close: number }[]>;

const fmt = (n: number) =>
  n.toLocaleString("vi-VN", { maximumFractionDigits: 0 });

/* ─── Sparkline mini chart ─── */
function Sparkline({ data }: { data: { date: string; close: number }[] }) {
  if (!data || data.length < 2) {
    return <div className="w-[72px] h-[24px] bg-neutral-800/30 rounded" />;
  }
  const first = data[0].close;
  const last = data[data.length - 1].close;
  const isUp = last >= first;
  return (
    <div className="w-[72px] h-[24px]">
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

/* ─── Expandable Detail Panel (per ticker) ─── */
function TickerDetailPanel({ ticker, transactions }: { ticker: string; transactions: TxRecord[] }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    let list = [...transactions];
    if (from) list = list.filter((t) => t.date >= from);
    if (to) list = list.filter((t) => t.date <= to + "T23:59:59.999Z");
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, from, to]);

  // FIFO realized PnL within filtered period
  const filteredPnL = useMemo(() => {
    const buys: { price: number; qty: number }[] = [];
    let pnl = 0;
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

  const hasSells = filtered.some((t) => t.action === "SELL");

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <td colSpan={7} className="p-0">
        <div className="px-4 py-4 bg-white/[0.02] border-t border-white/[0.04]">
          {/* Top row: Date filter + Realized PnL */}
          <div className="flex flex-wrap items-end gap-3 mb-3">
            <div>
              <label className="text-[12px] text-neutral-500 block mb-1">
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
              <label className="text-[12px] text-neutral-500 block mb-1">Đến ngày</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs px-2.5 py-1.5 rounded-lg outline-none focus:border-emerald-500/50"
              />
            </div>
            {(from || to) && (
              <button
                onClick={() => { setFrom(""); setTo(""); }}
                className="text-[12px] text-neutral-500 hover:text-neutral-300 underline pb-1.5"
              >
                Xóa lọc
              </button>
            )}

            {/* Realized PnL badge */}
            {hasSells && (
              <div
                className={`ml-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs ${
                  filteredPnL >= 0
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    : "bg-red-500/10 border-red-500/20 text-red-400"
                }`}
              >
                <span className="text-[12px] opacity-70 uppercase tracking-wider">
                  Lãi/Lỗ chốt {from || to ? "(trong kỳ)" : ""}
                </span>
                <span className="font-black font-mono text-sm">
                  {filteredPnL >= 0 ? "+" : ""}{fmt(filteredPnL)}
                </span>
              </div>
            )}
          </div>

          {/* Transaction list */}
          <div className="max-h-[220px] overflow-y-auto space-y-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-neutral-600 py-3 text-center">
                Không có giao dịch {ticker} trong khoảng này
              </p>
            ) : (
              filtered.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-neutral-800/30 hover:bg-neutral-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-[12px] font-bold px-2 py-0.5 rounded ${
                        tx.action === "BUY"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-red-500/15 text-red-400"
                      }`}
                    >
                      {tx.action === "BUY" ? "MUA" : "BÁN"}
                    </span>
                    <span className="text-xs font-mono text-neutral-200">
                      {fmt(tx.price)} × {tx.qty.toLocaleString("vi-VN")}
                    </span>
                    <span className="text-[12px] text-neutral-600">
                      = {fmt(tx.price * tx.qty)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {tx.psychologyTag && (
                      <span className="text-[11px] text-neutral-500 bg-neutral-800 px-1.5 py-0.5 rounded">
                        {tx.psychologyTag}
                      </span>
                    )}
                    <span className="text-[12px] text-neutral-600 font-mono">
                      {new Date(tx.date).toLocaleDateString("vi-VN")}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </td>
    </motion.tr>
  );
}

/* ═══════════════════ MAIN COMPONENT ═══════════════════ */
export function PnLSummary() {
  const [data, setData] = useState<PnLData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingNAV, setEditingNAV] = useState(false);
  const [navValue, setNavValue] = useState("");
  const [savingNAV, setSavingNAV] = useState(false);

  // Global date range filter
  const [globalFrom, setGlobalFrom] = useState("");
  const [globalTo, setGlobalTo] = useState("");

  // Expandable row state
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);

  // Sparklines
  const [sparklines, setSparklines] = useState<SparklineData>({});

  const fetchPnL = useCallback(async (from?: string, to?: string) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const qs = params.toString();
      const res = await fetch(`/api/journal/pnl${qs ? "?" + qs : ""}`);
      if (!res.ok) throw new Error("Lỗi tải PnL");
      const d = await res.json();
      setData(d);
      setNavValue(d.initialNAV?.toString() ?? "0");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch sparklines for all holdings
  const fetchSparklines = useCallback(async (tickers: string[]) => {
    const results: SparklineData = {};
    await Promise.all(
      tickers.map(async (ticker) => {
        try {
          const res = await fetch(`/api/historical/${ticker}?days=10`);
          if (!res.ok) return;
          const json = await res.json();
          const raw: { date?: string; close?: number }[] = json.data ?? [];
          results[ticker] = raw.slice(-7).map((d) => ({ date: d.date ?? "", close: d.close ?? 0 }));
        } catch { /* silent */ }
      }),
    );
    setSparklines(results);
  }, []);

  useEffect(() => {
    fetchPnL();
  }, [fetchPnL]);

  useEffect(() => {
    if (data && data.currentHoldings.length > 0) {
      fetchSparklines(data.currentHoldings.map((h) => h.ticker));
    }
  }, [data, fetchSparklines]);

  const handleGlobalFilter = () => {
    fetchPnL(globalFrom || undefined, globalTo || undefined);
  };

  const handleClearFilter = () => {
    setGlobalFrom("");
    setGlobalTo("");
    fetchPnL();
  };

  const handleSaveNAV = async () => {
    setSavingNAV(true);
    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initialJournalNAV: parseFloat(navValue) || 0 }),
      });
      if (!res.ok) throw new Error("Lỗi lưu");
      setEditingNAV(false);
      fetchPnL(globalFrom || undefined, globalTo || undefined);
    } catch {
      // silent
    } finally {
      setSavingNAV(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-neutral-900 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-red-400">{error}</p>
        <Button variant="ghost" size="sm" onClick={() => fetchPnL()} className="mt-3">
          Thử lại
        </Button>
      </Card>
    );
  }

  if (!data) return null;

  const pnlColor = data.realizedPnL >= 0 ? "text-emerald-400" : "text-red-400";
  const unrealizedColor = data.unrealizedPnL >= 0 ? "text-emerald-400" : "text-red-400";
  const navChange = data.initialNAV > 0
    ? ((data.currentNAV - data.initialNAV) / data.initialNAV * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* ─── Global Date Range Filter ─── */}
      <Card className="p-3">
        <div className="flex flex-wrap items-end gap-3">
          <Filter className="w-4 h-4 text-neutral-500 self-center" />
          <div>
            <label className="text-[12px] text-neutral-500 block mb-1">Từ ngày</label>
            <input
              type="date"
              value={globalFrom}
              onChange={(e) => setGlobalFrom(e.target.value)}
              className="bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs px-2.5 py-1.5 rounded-lg outline-none focus:border-emerald-500/50"
            />
          </div>
          <div>
            <label className="text-[12px] text-neutral-500 block mb-1">Đến ngày</label>
            <input
              type="date"
              value={globalTo}
              onChange={(e) => setGlobalTo(e.target.value)}
              className="bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs px-2.5 py-1.5 rounded-lg outline-none focus:border-emerald-500/50"
            />
          </div>
          <button
            onClick={handleGlobalFilter}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-bold bg-emerald-500/15 text-emerald-400 rounded-lg hover:bg-emerald-500/25 transition-colors"
          >
            {loading ? "..." : "Lọc"}
          </button>
          {(globalFrom || globalTo) && (
            <button
              onClick={handleClearFilter}
              className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300 transition-colors"
              title="Xóa lọc"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {(globalFrom || globalTo) && (
            <span className="text-[12px] text-amber-400/70 self-center ml-auto">
              Đang lọc: {globalFrom || "..."} → {globalTo || "..."}
            </span>
          )}
        </div>
      </Card>

      {/* ─── NAV Overview ─── */}
      <Card glow={data.realizedPnL >= 0 ? "emerald" : "red"} className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Tổng Quan NAV</h3>
          </div>
          <button
            onClick={() => setEditingNAV(!editingNAV)}
            className="text-[12px] text-neutral-500 hover:text-neutral-300 transition-colors underline"
          >
            {editingNAV ? "Hủy" : "Cài đặt vốn"}
          </button>
        </div>

        {editingNAV && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mb-4 p-3 bg-neutral-800/50 rounded-xl border border-neutral-700 flex items-end gap-2"
          >
            <div className="flex-1">
              <label className="text-[12px] text-neutral-500 block mb-1">
                Vốn ban đầu (VNĐ)
              </label>
              <input
                type="number"
                value={navValue}
                onChange={(e) => setNavValue(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700 text-neutral-200 text-sm px-3 py-2 rounded-lg outline-none focus:border-emerald-500/50 font-mono"
                placeholder="100000000"
              />
            </div>
            <button
              onClick={handleSaveNAV}
              disabled={savingNAV}
              className="px-4 py-2 text-xs font-bold bg-emerald-500/15 text-emerald-400 rounded-lg hover:bg-emerald-500/25 transition-colors"
            >
              {savingNAV ? "..." : "Lưu"}
            </button>
          </motion.div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-[12px] text-neutral-600">Vốn ban đầu</p>
            <p className="text-sm font-bold font-mono text-neutral-300">{fmt(data.initialNAV)}</p>
          </div>
          <div>
            <p className="text-[12px] text-neutral-600">Lãi/Lỗ đã chốt</p>
            <p className={`text-sm font-bold font-mono ${pnlColor}`}>
              {data.realizedPnL >= 0 ? "+" : ""}{fmt(data.realizedPnL)}
            </p>
          </div>
          <div>
            <p className="text-[12px] text-neutral-600">Lãi/Lỗ chưa chốt</p>
            <p className={`text-sm font-bold font-mono ${unrealizedColor}`}>
              {data.unrealizedPnL >= 0 ? "+" : ""}{fmt(data.unrealizedPnL)}
            </p>
          </div>
          <div>
            <p className="text-[12px] text-neutral-600">Current NAV</p>
            <p className="text-lg font-black font-mono text-white">{fmt(data.currentNAV)}</p>
            {data.initialNAV > 0 && (
              <p className={`text-[12px] font-bold ${navChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {navChange >= 0 ? "+" : ""}{navChange.toFixed(1)}%
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* ─── Win/Loss Stats ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: <BarChart3 className="w-3.5 h-3.5" />, label: "Tổng lệnh", value: data.stats.totalTrades, color: "text-neutral-200" },
          { icon: <PieChart className="w-3.5 h-3.5" />, label: "Đã chốt", value: data.stats.closedTrades, color: "text-neutral-200" },
          { icon: <TrendingUp className="w-3.5 h-3.5" />, label: "Win", value: data.stats.winTrades, color: "text-emerald-400" },
          { icon: <TrendingDown className="w-3.5 h-3.5" />, label: "Loss", value: data.stats.lossTrades, color: "text-red-400" },
        ].map((s) => (
          <Card key={s.label} className="p-3">
            <div className={`flex items-center gap-1 mb-1 ${s.color}`}>
              {s.icon}
              <span className="text-[12px] text-neutral-500">{s.label}</span>
            </div>
            <p className={`text-lg font-black font-mono ${s.color}`}>{s.value}</p>
          </Card>
        ))}
      </div>

      {/* ─── Win Rate Bar ─── */}
      {data.stats.closedTrades > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-neutral-400">Win Rate</span>
            <span
              className={`text-sm font-black font-mono ${
                data.stats.winRate >= 50 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {data.stats.winRate}%
            </span>
          </div>
          <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                data.stats.winRate >= 50 ? "bg-emerald-500" : "bg-red-500"
              }`}
              style={{ width: `${data.stats.winRate}%` }}
            />
          </div>
        </Card>
      )}

      {/* ═══════ SMART TABLE — Holdings + Accordion ═══════ */}
      {data.currentHoldings.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-[12px] uppercase tracking-wider text-neutral-500 font-medium px-4 py-3">Mã CP</th>
                  <th className="text-[12px] uppercase tracking-wider text-neutral-500 font-medium px-3 py-3 text-right">KL</th>
                  <th className="text-[12px] uppercase tracking-wider text-neutral-500 font-medium px-3 py-3 text-right">Giá vốn</th>
                  <th className="text-[12px] uppercase tracking-wider text-neutral-500 font-medium px-3 py-3 text-right hidden sm:table-cell">Giá TT</th>
                  <th className="text-[12px] uppercase tracking-wider text-neutral-500 font-medium px-3 py-3 text-right">Lãi/Lỗ</th>
                  <th className="text-[12px] uppercase tracking-wider text-neutral-500 font-medium px-3 py-3 text-center hidden sm:table-cell">7 ngày</th>
                  <th className="text-[12px] uppercase tracking-wider text-neutral-500 font-medium px-3 py-3 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {data.currentHoldings.map((h) => {
                  const isExpanded = expandedTicker === h.ticker;
                  const pnlVal = h.marketValue - (h.totalCost || h.qty * h.avgPrice);
                  const pnlPct = (h.totalCost || h.qty * h.avgPrice) > 0
                    ? (pnlVal / (h.totalCost || h.qty * h.avgPrice)) * 100
                    : 0;
                  const txs = data.txByTicker?.[h.ticker] ?? [];
                  const marketPrice = h.marketPrice ?? (h.qty > 0 ? Math.round(h.marketValue / h.qty) : 0);

                  return (
                    <Fragment key={h.ticker}>
                      <tr
                        onClick={() => setExpandedTicker(isExpanded ? null : h.ticker)}
                        className={`cursor-pointer transition-colors hover:bg-white/[0.03] border-b border-white/[0.03] ${
                          isExpanded ? "bg-white/[0.04]" : ""
                        }`}
                      >
                        {/* Ticker */}
                        <td className="px-4 py-3">
                          <span className="text-sm font-black text-white font-mono">{h.ticker}</span>
                        </td>

                        {/* Quantity */}
                        <td className="px-3 py-3 text-right">
                          <span className="text-xs font-mono text-neutral-300">
                            {h.qty.toLocaleString("vi-VN")}
                          </span>
                        </td>

                        {/* Avg Price */}
                        <td className="px-3 py-3 text-right">
                          <span className="text-xs font-mono text-neutral-300">
                            {fmt(h.avgPrice)}
                          </span>
                        </td>

                        {/* Market Price */}
                        <td className="px-3 py-3 text-right hidden sm:table-cell">
                          <span className="text-xs font-mono text-neutral-400">
                            {fmt(marketPrice)}
                          </span>
                        </td>

                        {/* PnL */}
                        <td className="px-3 py-3 text-right">
                          <p className={`text-xs font-bold font-mono ${pnlVal >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {pnlVal >= 0 ? "+" : ""}{fmt(pnlVal)}
                          </p>
                          <p className={`text-[11px] font-mono ${pnlPct >= 0 ? "text-emerald-500/60" : "text-red-500/60"}`}>
                            {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%
                          </p>
                        </td>

                        {/* Sparkline */}
                        <td className="px-3 py-3 text-center hidden sm:table-cell">
                          <Sparkline data={sparklines[h.ticker] ?? []} />
                        </td>

                        {/* Expand arrow */}
                        <td className="px-3 py-3">
                          <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                            <ChevronDown className="w-3.5 h-3.5 text-neutral-600" />
                          </motion.div>
                        </td>
                      </tr>

                      {/* Expandable Detail Panel */}
                      <AnimatePresence>
                        {isExpanded && (
                          <TickerDetailPanel ticker={h.ticker} transactions={txs} />
                        )}
                      </AnimatePresence>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ─── Recent Closed Trades ─── */}
      {data.closedTrades.length > 0 && (
        <Card className="p-4">
          <h4 className="text-xs font-bold text-neutral-400 mb-3">GD đã chốt gần đây</h4>
          <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
            {data.closedTrades.map((t, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-xs py-1 border-b border-neutral-800/50 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-white">{t.ticker}</span>
                  <span className="text-neutral-600">
                    {t.qty}cp | {fmt(t.buyPrice)} → {fmt(t.sellPrice)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`font-mono font-bold ${
                      t.pnl >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {t.pnl >= 0 ? "+" : ""}{fmt(t.pnl)}
                  </span>
                  {t.date && (
                    <span className="text-[11px] text-neutral-700 font-mono">
                      {new Date(t.date).toLocaleDateString("vi-VN")}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

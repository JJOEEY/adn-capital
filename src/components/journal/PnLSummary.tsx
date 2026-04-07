"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  PieChart,
  BarChart3,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface PnLData {
  initialNAV: number;
  realizedPnL: number;
  holdingsValue: number;
  currentNAV: number;
  currentHoldings: {
    ticker: string;
    qty: number;
    avgPrice: number;
    marketValue: number;
  }[];
  closedTrades: {
    ticker: string;
    pnl: number;
    buyPrice: number;
    sellPrice: number;
    qty: number;
  }[];
  stats: {
    totalTrades: number;
    closedTrades: number;
    winTrades: number;
    lossTrades: number;
    winRate: number;
  };
}

export function PnLSummary() {
  const [data, setData] = useState<PnLData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingNAV, setEditingNAV] = useState(false);
  const [navValue, setNavValue] = useState("");
  const [savingNAV, setSavingNAV] = useState(false);

  const fetchPnL = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/journal/pnl");
      if (!res.ok) throw new Error("Lỗi tải PnL");
      const d = await res.json();
      setData(d);
      setNavValue(d.initialNAV?.toString() ?? "0");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPnL();
  }, []);

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
      fetchPnL(); // Refresh
    } catch {
      // silent
    } finally {
      setSavingNAV(false);
    }
  };

  const fmt = (n: number) =>
    n.toLocaleString("vi-VN", { maximumFractionDigits: 0 });

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-32 rounded-2xl bg-neutral-900 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-red-400">{error}</p>
        <Button variant="ghost" size="sm" onClick={fetchPnL} className="mt-3">
          Thử lại
        </Button>
      </Card>
    );
  }

  if (!data) return null;

  const pnlColor = data.realizedPnL >= 0 ? "text-emerald-400" : "text-red-400";
  const navChange = data.initialNAV > 0
    ? ((data.currentNAV - data.initialNAV) / data.initialNAV * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* NAV Overview */}
      <Card glow={data.realizedPnL >= 0 ? "emerald" : "red"} className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Tổng Quan NAV</h3>
          </div>
          <button
            onClick={() => setEditingNAV(!editingNAV)}
            className="text-[10px] text-neutral-500 hover:text-neutral-300 transition-colors underline"
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
              <label className="text-[10px] text-neutral-500 block mb-1">
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
            <p className="text-[10px] text-neutral-600">Vốn ban đầu</p>
            <p className="text-sm font-bold font-mono text-neutral-300">{fmt(data.initialNAV)}</p>
          </div>
          <div>
            <p className="text-[10px] text-neutral-600">Lãi/Lỗ đã chốt</p>
            <p className={`text-sm font-bold font-mono ${pnlColor}`}>
              {data.realizedPnL >= 0 ? "+" : ""}{fmt(data.realizedPnL)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-neutral-600">Đang giữ (tạm tính)</p>
            <p className="text-sm font-bold font-mono text-blue-400">{fmt(data.holdingsValue)}</p>
          </div>
          <div>
            <p className="text-[10px] text-neutral-600">Current NAV</p>
            <p className="text-lg font-black font-mono text-white">{fmt(data.currentNAV)}</p>
            {data.initialNAV > 0 && (
              <p className={`text-[10px] font-bold ${navChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {navChange >= 0 ? "+" : ""}{navChange.toFixed(1)}%
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Win/Loss Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            icon: <BarChart3 className="w-3.5 h-3.5" />,
            label: "Tổng lệnh",
            value: data.stats.totalTrades,
            color: "text-neutral-200",
          },
          {
            icon: <PieChart className="w-3.5 h-3.5" />,
            label: "Đã chốt",
            value: data.stats.closedTrades,
            color: "text-neutral-200",
          },
          {
            icon: <TrendingUp className="w-3.5 h-3.5" />,
            label: "Win",
            value: data.stats.winTrades,
            color: "text-emerald-400",
          },
          {
            icon: <TrendingDown className="w-3.5 h-3.5" />,
            label: "Loss",
            value: data.stats.lossTrades,
            color: "text-red-400",
          },
        ].map((s) => (
          <Card key={s.label} className="p-3">
            <div className={`flex items-center gap-1 mb-1 ${s.color}`}>
              {s.icon}
              <span className="text-[10px] text-neutral-500">{s.label}</span>
            </div>
            <p className={`text-lg font-black font-mono ${s.color}`}>{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Win Rate Bar */}
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

      {/* Current Holdings */}
      {data.currentHoldings.length > 0 && (
        <Card className="p-4">
          <h4 className="text-xs font-bold text-neutral-400 mb-3 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" />
            Mã đang giữ
          </h4>
          <div className="space-y-2">
            {data.currentHoldings.map((h) => (
              <div
                key={h.ticker}
                className="flex items-center justify-between bg-neutral-800/50 rounded-lg px-3 py-2"
              >
                <div>
                  <span className="text-sm font-black text-white font-mono">{h.ticker}</span>
                  <span className="text-[10px] text-neutral-500 ml-2">
                    {h.qty.toLocaleString("vi-VN")} cp @ {h.avgPrice.toLocaleString("vi-VN")}
                  </span>
                </div>
                <span className="text-xs font-bold font-mono text-blue-400">
                  {fmt(h.marketValue)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recent Closed Trades */}
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
                <span
                  className={`font-mono font-bold ${
                    t.pnl >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {t.pnl >= 0 ? "+" : ""}{fmt(t.pnl)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

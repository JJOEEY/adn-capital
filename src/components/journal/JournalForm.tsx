"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Save, AlertTriangle, Calendar } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface JournalFormProps {
  onSaved: () => void;
}

const PSYCHOLOGIES = [
  { label: "Có kế hoạch", color: "emerald", icon: "✅" },
  { label: "Tự tin", color: "blue", icon: "💪" },
  { label: "FOMO", color: "yellow", icon: "⚡" },
  { label: "Theo room", color: "orange", icon: "👥" },
  { label: "Cảm tính", color: "red", icon: "🎲" },
  { label: "Hoảng loạn", color: "purple", icon: "😤" },
];

const defaultForm = {
  ticker: "",
  action: "BUY" as "BUY" | "SELL",
  price: "",
  quantity: "",
  psychology: "Có kế hoạch",
  tradeReason: "",
  tradeDate: new Date().toISOString().split("T")[0],
};

export function JournalForm({ onSaved }: JournalFormProps) {
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [t25Block, setT25Block] = useState<{
    blocked: boolean;
    message: string;
    earliestSellDate?: string;
  } | null>(null);

  const update = (field: keyof typeof defaultForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  // T+2.5 check khi chuyển sang BÁN
  const checkT25 = useCallback(async () => {
    if (form.action !== "SELL" || !form.ticker || form.ticker.length < 2) {
      setT25Block(null);
      return;
    }

    try {
      const res = await fetch(
        `/api/journal/t25-check?ticker=${form.ticker}&sellDate=${form.tradeDate}`
      );
      const data = await res.json();
      if (!data.eligible) {
        setT25Block({
          blocked: true,
          message: data.message,
          earliestSellDate: data.earliestSellDateFormatted,
        });
      } else {
        setT25Block(null);
      }
    } catch {
      setT25Block(null);
    }
  }, [form.action, form.ticker, form.tradeDate]);

  useEffect(() => {
    const timer = setTimeout(checkT25, 500);
    return () => clearTimeout(timer);
  }, [checkT25]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.ticker || !form.price || !form.quantity) {
      setError("Vui lòng điền đầy đủ thông tin bắt buộc (*)");
      return;
    }
    if (!form.tradeReason.trim() || form.tradeReason.trim().length < 5) {
      setError("Vui lòng nhập lý do giao dịch chi tiết (tối thiểu 5 ký tự)");
      return;
    }
    if (t25Block?.blocked) {
      setError("Cổ phiếu chưa về tài khoản theo luật T+2.5. Không thể bán!");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: form.ticker,
          action: form.action,
          price: parseFloat(form.price),
          quantity: parseInt(form.quantity),
          psychology: form.psychology,
          psychologyTag: form.psychology,
          tradeReason: form.tradeReason,
          tradeDate: form.tradeDate,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Lỗi lưu nhật ký");
      }
      setForm(defaultForm);
      setT25Block(null);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full bg-neutral-800/80 border border-neutral-700 focus:border-emerald-500/60 focus:bg-neutral-800 text-neutral-100 placeholder-neutral-600 text-sm px-3 py-2.5 rounded-xl outline-none transition-all";
  const labelCls = "text-xs font-medium text-neutral-400 mb-1.5 block";

  return (
    <Card className="p-6">
      <h2 className="text-base font-bold text-white mb-5 flex items-center gap-2">
        <Save className="w-4 h-4 text-emerald-400" />
        Ghi Nhật Ký Giao Dịch
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Row 1: Ticker, Action, Date */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Mã cổ phiếu *</label>
            <input
              value={form.ticker}
              onChange={(e) => update("ticker", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              placeholder="VD: HPG, FPT"
              className={`${inputCls} font-mono font-bold text-emerald-400 uppercase`}
              maxLength={10}
            />
          </div>
          <div>
            <label className={labelCls}>Loại lệnh *</label>
            <div className="flex rounded-xl overflow-hidden border border-neutral-700 h-[42px]">
              <button
                type="button"
                onClick={() => update("action", "BUY")}
                className={`flex-1 text-sm font-bold transition-all ${
                  form.action === "BUY"
                    ? "bg-emerald-500 text-black"
                    : "bg-neutral-800 text-neutral-500 hover:text-neutral-200"
                }`}
              >
                Mua
              </button>
              <button
                type="button"
                onClick={() => update("action", "SELL")}
                className={`flex-1 text-sm font-bold transition-all ${
                  form.action === "SELL"
                    ? "bg-red-500 text-white"
                    : "bg-neutral-800 text-neutral-500 hover:text-neutral-200"
                }`}
              >
                Bán
              </button>
            </div>
          </div>
          <div>
            <label className={labelCls}>
              <Calendar className="w-3 h-3 inline mr-1" />
              Ngày đi lệnh *
            </label>
            <input
              type="date"
              value={form.tradeDate}
              onChange={(e) => update("tradeDate", e.target.value)}
              className={`${inputCls} font-mono`}
              max={new Date().toISOString().split("T")[0]}
            />
          </div>
        </div>

        {/* T+2.5 Block Warning */}
        {t25Block?.blocked && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/25"
          >
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-400">
                Cổ phiếu chưa về tài khoản theo luật T+2.5. Không thể bán!
              </p>
              <p className="text-xs text-red-300/70 mt-1">
                {t25Block.message}
              </p>
            </div>
          </motion.div>
        )}

        {/* Row 2: Price + Quantity */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Giá *</label>
            <input
              type="number"
              value={form.price}
              onChange={(e) => update("price", e.target.value)}
              placeholder="24700"
              className={`${inputCls} font-mono`}
              step="100"
              min="0"
            />
          </div>
          <div>
            <label className={labelCls}>Khối lượng *</label>
            <input
              type="number"
              value={form.quantity}
              onChange={(e) => update("quantity", e.target.value)}
              placeholder="1000"
              className={`${inputCls} font-mono`}
              min="0"
            />
          </div>
        </div>

        {/* Psychology Selector */}
        <div className="border-t border-neutral-800 pt-4">
          <label className={labelCls}>Tâm lý khi vào lệnh *</label>
          <div className="flex flex-wrap gap-2">
            {PSYCHOLOGIES.map((p) => {
              const active = form.psychology === p.label;
              const colorMap: Record<string, string> = {
                emerald: active ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : "",
                blue: active ? "bg-blue-500/20 text-blue-300 border-blue-500/40" : "",
                yellow: active ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/40" : "",
                orange: active ? "bg-orange-500/20 text-orange-300 border-orange-500/40" : "",
                red: active ? "bg-red-500/20 text-red-300 border-red-500/40" : "",
                purple: active ? "bg-purple-500/20 text-purple-300 border-purple-500/40" : "",
              };
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => update("psychology", p.label)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                    active
                      ? colorMap[p.color]
                      : "bg-neutral-800/80 text-neutral-500 border-neutral-700 hover:border-neutral-600 hover:text-neutral-300"
                  }`}
                >
                  {p.icon} {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Trade Reason */}
        <div>
          <label className={labelCls}>Lý do giao dịch chi tiết *</label>
          <textarea
            value={form.tradeReason}
            onChange={(e) => update("tradeReason", e.target.value)}
            placeholder="VD: Breakout vùng kháng cự 25.000 với volume tăng mạnh. RSI divergence dương trên khung W..."
            className={`${inputCls} min-h-[80px] resize-y`}
            maxLength={1000}
          />
          <p className="text-[12px] text-neutral-600 mt-1 text-right">
            {form.tradeReason.length}/1000
          </p>
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"
          >
            {error}
          </motion.p>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={loading}
          className="w-full"
          disabled={t25Block?.blocked}
        >
          <Save className="w-4 h-4" />
          Lưu Nhật Ký
        </Button>
      </form>
    </Card>
  );
}

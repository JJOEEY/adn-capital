"use client";

import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useCurrentDbUser } from "@/hooks/useCurrentDbUser";
import { useSubscription } from "@/hooks/useSubscription";
import { LockOverlay } from "@/components/ui/LockOverlay";
import { SignalCard } from "@/components/signals/SignalCard";
import {
  Zap,
  TrendingUp,
  Rocket,
  Target,
  Play,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Info,
  BarChart2,
  Volume2,
  Activity,
  Shield,
  Eye,
} from "lucide-react";
import type { Signal } from "@/types";

/* ── Mô tả 3 công thức ────────────────────────────────────────────────── */
const FORMULAS = [
  {
    id: "SIEU_CO_PHIEU",
    name: "Siêu Cổ Phiếu",
    subtitle: "CANSLIM / VCP Breakout",
    icon: Rocket,
    color: "purple",
    gradient: "from-purple-500/10 to-purple-500/5",
    borderColor: "border-purple-500/20 hover:border-purple-500/40",
    iconBg: "bg-purple-500/15",
    iconColor: "text-purple-400",
    badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    description:
      "Cổ phiếu mạnh nhất thị trường, tích lũy nền dài cạn kiệt thanh khoản, đột phá Vol khổng lồ xác nhận vào siêu sóng.",
    conditions: [
      { icon: BarChart2, text: "RS Rating ≥ 85 (top 15% thị trường)" },
      { icon: Target, text: "Nền giá hẹp < 8% trong 20 phiên" },
      { icon: Volume2, text: "Volume đột biến > 2.5× trung bình 20 phiên" },
      { icon: TrendingUp, text: "Breakout đỉnh hộp 20 phiên" },
      { icon: Eye, text: "VNINDEX bullish (trên EMA20)" },
      { icon: Activity, text: "Siết nền VCP: CV < 5%" },
      { icon: Shield, text: "MACD không phân kỳ âm" },
    ],
  },
  {
    id: "TRUNG_HAN",
    name: "Trung Hạn",
    subtitle: "Trend Following",
    icon: TrendingUp,
    color: "emerald",
    gradient: "from-emerald-500/10 to-emerald-500/5",
    borderColor: "border-emerald-500/20 hover:border-emerald-500/40",
    iconBg: "bg-emerald-500/15",
    iconColor: "text-emerald-400",
    badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    description:
      "Cổ phiếu trong xu hướng tăng rõ ràng, pullback cạn Vol rồi bật tăng trở lại — đi theo dòng tiền lớn.",
    conditions: [
      { icon: TrendingUp, text: "Xu hướng: EMA10 > EMA20 > SMA50" },
      { icon: Target, text: "Giá vừa cắt lên lại EMA20" },
      { icon: Volume2, text: "Volume bùng nổ > 1.5× trung bình 20 phiên" },
      { icon: Eye, text: "VNINDEX bullish (trên EMA20, MACD xanh)" },
      { icon: Activity, text: "Siết nền VCP: CV < 5% trong 60 phiên" },
      { icon: Shield, text: "Đáy W hoặc Phân kỳ dương RSI/MACD" },
    ],
  },
  {
    id: "DAU_CO",
    name: "Lướt Sóng",
    subtitle: "Mean Reversion / Bounce",
    icon: Zap,
    color: "yellow",
    gradient: "from-yellow-500/10 to-yellow-500/5",
    borderColor: "border-yellow-500/20 hover:border-yellow-500/40",
    iconBg: "bg-yellow-500/15",
    iconColor: "text-yellow-400",
    badgeColor: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    description:
      "Cổ phiếu bị bán quá đà, RSI dưới 30 hoặc chạm Bollinger dưới — nảy lại nhanh để lướt sóng ngắn.",
    conditions: [
      { icon: Activity, text: "RSI vừa cắt lên từ dưới 30 (oversold)" },
      { icon: Target, text: "Hoặc: Giá vượt Bollinger dưới + Volume spike" },
      { icon: Volume2, text: "Volume > 1.2× trung bình 20 phiên" },
    ],
  },
];

type FormulaId = "SIEU_CO_PHIEU" | "TRUNG_HAN" | "DAU_CO";

export default function FormulaTestPage() {
  const { isAdmin, isLoading } = useCurrentDbUser();
  const { isSignalLocked } = useSubscription();
  const [scanning, setScanning] = useState(false);

  // Chỉ ADMIN mới truy cập được
  if (!isLoading && !isAdmin) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-neutral-500">Trang này chỉ dành cho Admin.</p>
        </div>
      </MainLayout>
    );
  }
  const [signals, setSignals] = useState<Signal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFormula, setSelectedFormula] = useState<FormulaId | "all">("all");
  const [expandedFormula, setExpandedFormula] = useState<string | null>(null);

  const runScan = async () => {
    setScanning(true);
    setError(null);
    setSignals(null);
    try {
      const res = await fetch("/api/scan-now", { method: "POST" });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error ?? "Lỗi");
      }
      const data = await res.json();
      const sigs: Signal[] = (data.signals ?? []).map(
        (s: { ticker: string; type: string; entryPrice: number; reason?: string }, i: number) => ({
          id: `scan-${i}-${s.ticker}`,
          ticker: s.ticker,
          type: s.type,
          entryPrice: s.entryPrice,
          reason: s.reason ?? null,
          createdAt: new Date().toISOString(),
        })
      );
      setSignals(sigs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setScanning(false);
    }
  };

  const filteredSignals =
    signals && selectedFormula !== "all"
      ? signals.filter((s) => s.type === selectedFormula)
      : signals;

  const countByType = (type: string) =>
    signals?.filter((s) => s.type === type).length ?? 0;

  return (
    <MainLayout>
      <div className="p-3 md:p-6 space-y-5 max-w-7xl mx-auto">
        {/* ═══ HEADER ═══ */}
        <div className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/80 p-5 sm:p-8">
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-purple-500/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl" />

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <Zap className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-[0.2em]">
                Formula Testing Lab
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">
              TEST CÔNG THỨC{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400">
                THẺ BÀI
              </span>
            </h1>
            <p className="text-sm text-neutral-400 mt-2 max-w-2xl leading-relaxed">
              Chạy 3 bộ lọc công thức chọn cổ phiếu trên 200 mã thanh khoản cao nhất thị trường.
              Kết quả hiển thị dạng thẻ tín hiệu real-time.
            </p>
          </div>
        </div>

        {/* ═══ 3 FORMULA CARDS ═══ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FORMULAS.map((f) => {
            const Icon = f.icon;
            const isExpanded = expandedFormula === f.id;
            return (
              <div
                key={f.id}
                className={`bg-gradient-to-br ${f.gradient} border ${f.borderColor} rounded-2xl p-5 transition-all cursor-pointer`}
                onClick={() => setExpandedFormula(isExpanded ? null : f.id)}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-xl ${f.iconBg}`}>
                    <Icon className={`w-5 h-5 ${f.iconColor}`} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">{f.name}</h3>
                    <p className="text-[10px] text-neutral-500">{f.subtitle}</p>
                  </div>
                  {signals && (
                    <span
                      className={`ml-auto text-lg font-black ${f.iconColor}`}
                    >
                      {countByType(f.id)}
                    </span>
                  )}
                </div>

                <p className="text-xs text-neutral-400 leading-relaxed">
                  {f.description}
                </p>

                {/* Expanded: show conditions */}
                {isExpanded && (
                  <div className="mt-4 space-y-2 border-t border-neutral-800 pt-3">
                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                      Điều kiện kích hoạt
                    </p>
                    {f.conditions.map((cond, i) => {
                      const CondIcon = cond.icon;
                      return (
                        <div
                          key={i}
                          className="flex items-start gap-2 text-xs text-neutral-300"
                        >
                          <CondIcon className={`w-3.5 h-3.5 ${f.iconColor} flex-shrink-0 mt-0.5`} />
                          <span>{cond.text}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-3 flex items-center gap-1 text-[10px] text-neutral-600">
                  <Info className="w-3 h-3" />
                  {isExpanded ? "Bấm để thu gọn" : "Bấm để xem điều kiện"}
                </div>
              </div>
            );
          })}
        </div>

        {/* ═══ SCAN BUTTON ═══ */}
        <LockOverlay
          isLocked={isSignalLocked}
          message="Nâng cấp VIP để chạy test công thức real-time"
        >
          <div className="flex flex-col sm:flex-row items-center gap-4 bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5">
            <div className="flex-1">
              <h3 className="text-sm font-bold text-white">
                Chạy quét toàn thị trường
              </h3>
              <p className="text-xs text-neutral-500 mt-1">
                Quét 200 mã cổ phiếu theo 3 công thức — mất khoảng 30-60 giây
              </p>
            </div>
            <button
              onClick={runScan}
              disabled={scanning}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500/20 to-emerald-500/20 border border-purple-500/30 text-white font-bold text-sm hover:from-purple-500/30 hover:to-emerald-500/30 transition-all disabled:opacity-50 cursor-pointer"
            >
              {scanning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang quét...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Chạy Test
                </>
              )}
            </button>
          </div>
        </LockOverlay>

        {/* ═══ ERROR ═══ */}
        {error && (
          <div className="rounded-xl p-4 bg-red-500/10 border border-red-500/20 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-400">Lỗi quét tín hiệu</p>
              <p className="text-xs text-neutral-400 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* ═══ RESULTS ═══ */}
        {signals !== null && (
          <div className="space-y-4">
            {/* Summary bar */}
            <div className="flex items-center justify-between bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <div>
                  <p className="text-sm font-bold text-white">
                    Phát hiện {signals.length} tín hiệu
                  </p>
                  <p className="text-[10px] text-neutral-500">
                    {countByType("SIEU_CO_PHIEU")} Siêu CP ·{" "}
                    {countByType("TRUNG_HAN")} Trung Hạn ·{" "}
                    {countByType("DAU_CO")} Lướt Sóng
                  </p>
                </div>
              </div>
            </div>

            {/* Type filter */}
            <div className="flex gap-2 flex-wrap">
              {[
                { val: "all" as const, label: "Tất cả", count: signals.length },
                { val: "SIEU_CO_PHIEU" as const, label: "Siêu Cổ Phiếu", count: countByType("SIEU_CO_PHIEU") },
                { val: "TRUNG_HAN" as const, label: "Trung Hạn", count: countByType("TRUNG_HAN") },
                { val: "DAU_CO" as const, label: "Lướt Sóng", count: countByType("DAU_CO") },
              ].map((item) => (
                <button
                  key={item.val}
                  onClick={() => setSelectedFormula(item.val)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                    selectedFormula === item.val
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      : "text-neutral-500 border-neutral-800 hover:border-neutral-700 hover:text-neutral-300 bg-neutral-900"
                  }`}
                >
                  {item.label}
                  <span className="ml-1.5 opacity-60">({item.count})</span>
                </button>
              ))}
            </div>

            {/* Signal cards grid */}
            {filteredSignals && filteredSignals.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredSignals.map((signal, index) => (
                  <SignalCard key={signal.id} signal={signal} index={index} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-neutral-900/80 border border-neutral-800 rounded-2xl">
                <Zap className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
                <p className="text-sm text-neutral-500">
                  {selectedFormula !== "all"
                    ? "Không có tín hiệu cho công thức này"
                    : "Không phát hiện tín hiệu nào hôm nay"}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ═══ Scanning progress ═══ */}
        {scanning && (
          <div className="text-center py-12 bg-neutral-900/80 border border-neutral-800 rounded-2xl">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-4" />
            <p className="text-sm font-bold text-white">Đang quét 200 mã cổ phiếu...</p>
            <p className="text-xs text-neutral-500 mt-1">
              Tính chỉ báo kỹ thuật + chạy 3 bộ lọc công thức. Vui lòng đợi 30-60 giây.
            </p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

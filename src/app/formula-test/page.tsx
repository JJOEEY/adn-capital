"use client";

import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useCurrentDbUser } from "@/hooks/useCurrentDbUser";
import { useSubscription } from "@/hooks/useSubscription";
import { useTheme } from "@/components/providers/ThemeProvider";
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
import { RPIDashboard } from "@/components/formula-test/RPIDashboard";

const FORMULAS = [
  {
    id: "SIEU_CO_PHIEU",
    name: "Siêu Cổ Phiếu",
    subtitle: "CANSLIM / VCP Breakout",
    icon: Rocket,
    color: "purple",
    iconBg: { background: "rgba(168,85,247,0.15)" },
    iconColor: "#a855f7",
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
    iconBg: { background: "rgba(16,185,129,0.15)" },
    iconColor: "#10b981",
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
    iconBg: { background: "rgba(234,179,8,0.15)" },
    iconColor: "#eab308",
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
  const { theme } = useTheme();
  const isDark = theme === "dark";
  // NOTE: components use CSS variables directly — isDark only needed for conditional className fallbacks
  void isDark; // suppress unused warning
  const [scanning, setScanning] = useState(false);

  // Chỉ ADMIN mới truy cập được
  if (!isLoading && !isAdmin) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p style={{ color: "var(--text-muted)" }}>Trang này chỉ dành cho Admin.</p>
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
        <div className="relative overflow-hidden rounded-2xl border p-5 sm:p-8" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full" style={{ background: "rgba(168,85,247,0.04)" }} />
          <div className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full" style={{ background: "rgba(16,185,129,0.04)" }} />

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-xl border" style={{ background: "rgba(168,85,247,0.10)", borderColor: "rgba(168,85,247,0.20)" }}>
                <Zap className="w-5 h-5" style={{ color: "#a855f7" }} />
              </div>
              <span className="text-[12px] font-bold uppercase tracking-[0.2em]" style={{ color: "#a855f7" }}>
                Formula Testing Lab
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black leading-tight" style={{ color: "var(--text-primary)" }}>
              TEST{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-emerald-400">
                CÔNG CỤ
              </span>
            </h1>
            <p className="text-sm mt-2 max-w-2xl leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Chạy 3 bộ lọc công thức chọn cổ phiếu trên 200 mã thanh khoản cao nhất thị trường.
              Kết quả hiển thị dạng thẻ tín hiệu real-time.
            </p>
          </div>
        </div>

        {/* ═══ RPI DASHBOARD ═══ */}
        <RPIDashboard />

        {/* ═══ 3 FORMULA CARDS ═══ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FORMULAS.map((f) => {
            const Icon = f.icon;
            const isExpanded = expandedFormula === f.id;
            return (
              <div
                key={f.id}
                className="glow-card border rounded-2xl p-5 transition-all cursor-pointer"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}
                onClick={() => setExpandedFormula(isExpanded ? null : f.id)}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-xl" style={f.iconBg}>
                    <Icon className="w-5 h-5" style={{ color: f.iconColor }} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black" style={{ color: "var(--text-primary)" }}>{f.name}</h3>
                    <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>{f.subtitle}</p>
                  </div>
                  {signals && (
                    <span
                      className="ml-auto text-lg font-black"
                      style={{ color: f.iconColor }}
                    >
                      {countByType(f.id)}
                    </span>
                  )}
                </div>

                <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {f.description}
                </p>

                {/* Expanded: show conditions */}
                {isExpanded && (
                  <div className="mt-4 space-y-2 border-t pt-3" style={{ borderColor: "var(--border)" }}>
                    <p className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                      Điều kiện kích hoạt
                    </p>
                    {f.conditions.map((cond, i) => {
                      const CondIcon = cond.icon;
                      return (
                        <div
                          key={i}
                          className="flex items-start gap-2 text-xs"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          <CondIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: f.iconColor }} />
                          <span>{cond.text}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-3 flex items-center gap-1 text-[12px] text-neutral-600">
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
          <div className="flex flex-col sm:flex-row items-center gap-4 border rounded-2xl p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex-1">
              <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                Chạy quét toàn thị trường
              </h3>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                Quét 200 mã cổ phiếu theo 3 công thức — mất khoảng 30-60 giây
              </p>
            </div>
            <button
              onClick={runScan}
              disabled={scanning}
              className="flex items-center gap-2 px-6 py-3 rounded-xl border font-bold text-sm transition-all disabled:opacity-50 cursor-pointer"
              style={{ background: "rgba(168,85,247,0.15)", borderColor: "rgba(168,85,247,0.30)", color: "var(--text-primary)" }}
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
            <div className="flex items-center justify-between border rounded-2xl p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <div>
                  <p className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                    Phát hiện {signals.length} tín hiệu
                  </p>
                  <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
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
                      : isDark
                        ? "text-neutral-500 border-white/[0.08] hover:border-white/[0.15] hover:text-neutral-300 bg-white/[0.03]"
                        : "text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700 bg-white/60"
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
              <div className="text-center py-12 border rounded-2xl" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                <Zap className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
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
          <div className="text-center py-12 border rounded-2xl" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" style={{ color: "#a855f7" }} />
            <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Đang quét 200 mã cổ phiếu...</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Tính chỉ báo kỹ thuật + chạy 3 bộ lọc công thức. Vui lòng đợi 30-60 giây.
            </p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

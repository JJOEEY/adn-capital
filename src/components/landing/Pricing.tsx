"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Check, Crown, Zap, Star, Shield, Gift, Sparkles, ExternalLink, Clock, Lock } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";

/* ═══════════════════════════════════════════════════════════════════════════
 *  PRICING SECTION — Landing Page "Chốt Sale"
 *  Promocode DNSE → 4 Pricing Cards (1M / 3M / 6M-PRO / 12M-VIP)
 * ═══════════════════════════════════════════════════════════════════════════ */

interface PricingPlan {
  id: string;
  name: string;
  period: string;
  price: number;        // giá thường (VND)
  dnsePrice: number;    // giá DNSE (VND)
  discountPct: number;  // % chiết khấu DNSE
  features: { text: string; locked?: boolean }[];
  icon: React.ReactNode;
  accent: "sky" | "blue" | "emerald" | "purple";
  ribbon?: string;      // dải băng đặc biệt
}

const plans: PricingPlan[] = [
  {
    id: "1m",
    name: "Gói 1 Tháng",
    period: "/tháng",
    price: 249_000,
    dnsePrice: 224_000,
    discountPct: 10,
    icon: <Zap className="w-5 h-5" />,
    accent: "sky",
    features: [
      { text: "Hệ thống AI tư vấn mạnh mẽ (20 lượt/ngày)" },
      { text: "Cập nhật tin tức hằng ngày" },
      { text: "Theo dõi sức mạnh TT, chỉ số Cạn Kiệt Xu Hướng" },
      { text: "Gợi ý cơ hội từ ADN Pilot" },
      { text: "Sở hữu Nhật Ký Giao Dịch theo dõi hành trình" },
      { text: "Nhật Ký AI: Phân tích tâm lý & Cơ cấu danh mục", locked: true },
      { text: "Chỉ báo Cạn Kiệt Xu Hướng cho từng mã riêng lẻ", locked: true },
      { text: "ADN Pilot cảnh báo theo thời gian thực (mua/bán/quản trị vốn)", locked: true },
      { text: "Nhận Report Weekly từ hệ thống ADN", locked: true },
      { text: "Hỗ trợ tư vấn 1-1 từ ADN Capital", locked: true },
      { text: "Tham gia room nhận tín hiệu Telegram", locked: true },
    ],
  },
  {
    id: "3m",
    name: "Gói 3 Tháng",
    period: "/3 tháng",
    price: 649_000,
    dnsePrice: 519_000,
    discountPct: 20,
    icon: <Star className="w-5 h-5" />,
    accent: "blue",
    features: [
      { text: "Hệ thống AI tư vấn mạnh mẽ (30 lượt/ngày)" },
      { text: "Cập nhật tin tức hằng ngày" },
      { text: "Theo dõi sức mạnh TT, chỉ số Cạn Kiệt Xu Hướng" },
      { text: "Gợi ý cơ hội từ ADN Pilot" },
      { text: "Sở hữu Nhật Ký Giao Dịch theo dõi hành trình" },
      { text: "Nhật Ký AI: Phân tích tâm lý & Cơ cấu danh mục", locked: true },
      { text: "Chỉ báo Cạn Kiệt Xu Hướng cho từng mã riêng lẻ", locked: true },
      { text: "ADN Pilot cảnh báo theo thời gian thực (mua/bán/quản trị vốn)", locked: true },
      { text: "Nhận Report Weekly từ hệ thống ADN", locked: true },
      { text: "Hỗ trợ tư vấn 1-1 từ ADN Capital", locked: true },
      { text: "Tham gia room nhận tín hiệu Telegram", locked: true },
    ],
  },
  {
    id: "6m",
    name: "Gói 6 Tháng",
    period: "/6 tháng",
    price: 1_199_000,
    dnsePrice: 839_000,
    discountPct: 30,
    icon: <Crown className="w-5 h-5" />,
    accent: "emerald",
    ribbon: "Bán chạy nhất",
    features: [
      { text: "Hệ thống AI tư vấn mạnh mẽ (Không giới hạn)" },
      { text: "Cập nhật tin tức hằng ngày" },
      { text: "Theo dõi sức mạnh TT, chỉ số Cạn Kiệt Xu Hướng" },
      { text: "Gợi ý cơ hội từ ADN Pilot" },
      { text: "Nhật Ký Giao Dịch, AI Phân tích & Cơ cấu danh mục" },
      { text: "Chỉ báo Cạn Kiệt Xu Hướng cho từng mã riêng lẻ" },
      { text: "ADN Pilot cảnh báo theo thời gian thực (mua/bán/quản trị vốn)" },
      { text: "Nhận Report Weekly từ hệ thống ADN" },
      { text: "Hỗ trợ tư vấn 1-1 từ ADN Capital", locked: true },
      { text: "Tham gia room nhận tín hiệu Telegram", locked: true },
    ],
  },
  {
    id: "12m",
    name: "Gói 12 Tháng",
    period: "/năm",
    price: 1_999_000,
    dnsePrice: 1_199_000,
    discountPct: 40,
    icon: <Sparkles className="w-5 h-5" />,
    accent: "purple",
    ribbon: "Tiết kiệm nhất",
    features: [
      { text: "Hệ thống AI tư vấn mạnh mẽ (Không giới hạn)" },
      { text: "Cập nhật tin tức hằng ngày" },
      { text: "Theo dõi sức mạnh TT, chỉ số Cạn Kiệt Xu Hướng" },
      { text: "Gợi ý cơ hội từ ADN Pilot" },
      { text: "Nhật Ký Giao Dịch, AI Phân tích & Cơ cấu danh mục" },
      { text: "Chỉ báo Cạn Kiệt Xu Hướng cho từng mã riêng lẻ" },
      { text: "ADN Pilot cảnh báo theo thời gian thực (mua/bán/quản trị vốn)" },
      { text: "Nhận Report Weekly sớm nhất" },
      { text: "Hỗ trợ tư vấn 1-1 từ ADN Capital" },
      { text: "Tham gia room nhận tín hiệu Telegram" },
    ],
  },
];

/* ── Accent colour tokens ─────────────────────────────────────────────── */
const accentTokens: Record<
  PricingPlan["accent"],
  {
    border: string;
    borderHover: string;
    shadow: string;
    badge: string;
    btn: string;
    iconBg: string;
    iconText: string;
    ribbon: string;
    priceText: string;
  }
> = {
  sky: {
    border: "border-sky-500/20",
    borderHover: "hover:border-sky-500/50",
    shadow: "hover:shadow-[0_0_50px_-12px_rgba(56,189,248,0.4)]",
    badge: "bg-sky-500/10 text-sky-400 border-sky-500/25",
    btn: "bg-sky-500 hover:bg-sky-400 text-white",
    iconBg: "bg-sky-500/10",
    iconText: "text-sky-400",
    ribbon: "bg-sky-500",
    priceText: "text-sky-400",
  },
  blue: {
    border: "border-blue-500/20",
    borderHover: "hover:border-blue-500/50",
    shadow: "hover:shadow-[0_0_50px_-12px_rgba(59,130,246,0.4)]",
    badge: "bg-blue-500/10 text-blue-400 border-blue-500/25",
    btn: "bg-blue-500 hover:bg-blue-400 text-white",
    iconBg: "bg-blue-500/10",
    iconText: "text-blue-400",
    ribbon: "bg-blue-500",
    priceText: "text-blue-400",
  },
  emerald: {
    border: "border-[var(--primary)]/30",
    borderHover: "hover:border-[var(--primary)]/60",
    shadow: "hover:shadow-[0_0_50px_-12px_rgba(46,77,61,0.5)]",
    badge: "bg-[var(--primary-light)] text-[var(--primary)] border-[var(--primary)]/25",
    btn: "bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--bg-page)]",
    iconBg: "bg-[var(--primary-light)]",
    iconText: "text-[var(--primary)]",
    ribbon: "bg-[var(--primary)]",
    priceText: "text-[var(--primary)]",
  },
  purple: {
    border: "border-purple-500/30",
    borderHover: "hover:border-purple-500/60",
    shadow: "hover:shadow-[0_0_50px_-12px_rgba(168,85,247,0.5)]",
    badge: "bg-purple-500/10 text-purple-400 border-purple-500/25",
    btn: "bg-purple-500 hover:bg-purple-400 text-white",
    iconBg: "bg-purple-500/10",
    iconText: "text-purple-400",
    ribbon: "bg-purple-500",
    priceText: "text-purple-400",
  },
};

/* ── Helpers ───────────────────────────────────────────────────────────── */
function formatVND(amount: number): string {
  return amount.toLocaleString("vi-VN") + "đ";
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  MAIN COMPONENT
 * ═══════════════════════════════════════════════════════════════════════════ */
export default function Pricing() {
  const { status } = useSession();
  const isSignedIn = status === "authenticated";
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [dnseId, setDnseId] = useState("");
  const [isDNSE, setIsDNSE] = useState(false);
  const [applied, setApplied] = useState(false);
  const [pending, setPending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  /** Load trạng thái DNSE của user khi đã đăng nhập */
  const loadDnseStatus = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      const res = await fetch("/api/user/dnse");
      if (!res.ok) return;
      const data = await res.json();
      if (data.dnseId) {
        setDnseId(data.dnseId);
        setApplied(true);
        setPending(!data.dnseVerified);
        setIsDNSE(data.dnseVerified === true);
      }
    } catch { /* ignore */ }
  }, [isSignedIn]);

  useEffect(() => {
    loadDnseStatus();
  }, [loadDnseStatus]);

  const handleApply = async () => {
    const trimmed = dnseId.trim();
    if (trimmed.length < 3) return;
    setErrorMsg("");

    if (!isSignedIn) {
      setErrorMsg("Vui lòng đăng nhập trước khi nhập ID DNSE.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/user/dnse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dnseId: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Không thể gửi ID DNSE.");
        return;
      }
      setApplied(true);
      setPending(!data.dnseVerified);
      setIsDNSE(data.dnseVerified === true);
    } catch {
      setErrorMsg("Lỗi kết nối, vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = () => {
    setDnseId("");
    setIsDNSE(false);
    setApplied(false);
    setPending(false);
    setErrorMsg("");
  };

  return (
    <section className="relative py-20 sm:py-28 px-4" style={{ borderTop: "1px solid var(--border, #E8E4DB)" }}>
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-[var(--primary-light)] rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* ── Heading ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <span className="inline-block text-[12px] font-bold uppercase tracking-[0.3em] mb-4 px-3 py-1 rounded-full border"
            style={{
              color: "var(--primary, #2E4D3D)",
              background: "var(--primary-light, rgba(46,77,61,0.08))",
              borderColor: "var(--border, #E8E4DB)",
            }}>
            Bảng giá đầu tư
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black" style={{ color: "var(--text-primary, #1C2B22)" }}>
            Chọn Gói Phù Hợp Với{" "}
            <span style={{ color: "var(--primary, #2E4D3D)" }}>Nhà Đầu Tư</span>
          </h2>
          <p className={`mt-4 max-w-xl mx-auto text-sm sm:text-base ${isDark ? "text-white/40" : "text-slate-500"}`}>
            Mở khoá toàn bộ sức mạnh của ADN System — Giao dịch thông minh hơn,
            nhanh hơn, chuẩn xác hơn.
          </p>
        </motion.div>

        {/* ── Free Trial Banner ────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="max-w-2xl mx-auto mb-8"
        >
          <div className="relative overflow-hidden rounded-2xl border p-5"
            style={{
              borderColor: "var(--border, #E8E4DB)",
              background: "var(--primary-light, rgba(46,77,61,0.08))",
            }}>
            <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "var(--surface, #FFFFFF)" }}>
                <Gift className="w-5 h-5" style={{ color: "var(--primary, #2E4D3D)" }} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold mb-1" style={{ color: "var(--text-primary, #1C2B22)" }}>
                  🎁 Mở tài khoản DNSE — Trải nghiệm miễn phí 1 tuần!
                </p>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary, #7D8471)" }}>
                  Mở tài khoản chứng khoán DNSE qua link giới thiệu, sau khi tài khoản được duyệt (~1 tiếng),
                  nhập ID DNSE vào ô bên dưới để kích hoạt <span style={{ color: isDark ? "var(--text-primary, #F8FAFC)" : "var(--primary, #2E4D3D)", fontWeight: 700 }}>VIP miễn phí 1 tuần</span> + giá ưu đãi DNSE cho các gói tiếp theo.
                </p>
              </div>
              <a
                href="https://s.dnse.vn/HVxkDz"
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105 active:scale-95"
                style={{
                  background: "var(--primary, #2E4D3D)",
                  color: "var(--bg-page, #F8F7F2)",
                }}
              >
                Mở TK DNSE
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </motion.div>

        {/* ── Promocode DNSE ───────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="max-w-md mx-auto mb-14"
        >
          <div className="rounded-2xl p-5"
            style={{
              background: "var(--surface, #FFFFFF)",
              border: "1px solid var(--border, #E8E4DB)",
            }}>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4" style={{ color: "var(--primary, #2E4D3D)" }} />
              <span className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                Nhập ID tài khoản DNSE
              </span>
            </div>
            <p className={`text-xs mb-3 ${isDark ? "text-white/35" : "text-slate-400"}`}>
              Áp dụng giá ưu đãi dành riêng cho khách hàng DNSE
            </p>

            {applied ? (
              <div className="flex items-center justify-between rounded-xl px-4 py-3"
                style={{
                  background: "var(--primary-light, rgba(46,77,61,0.08))",
                  border: "1px solid var(--border, #E8E4DB)",
                }}>
                <div className="flex items-center gap-2">
                  {pending ? (
                    <Clock className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Shield className="w-4 h-4" style={{ color: "var(--primary, #2E4D3D)" }} />
                  )}
                  <div>
                    <span className="text-sm font-bold" style={{ color: pending ? "var(--danger, #C0392B)" : "var(--primary, #2E4D3D)" }}>
                      DNSE: {dnseId}
                    </span>
                    {pending && (
                      <p className="text-[12px] text-amber-400/70 mt-0.5">
                        Đang chờ xác minh (~1 tiếng sau khi mở TK)
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleRemove}
                  className="text-xs text-neutral-500 hover:text-red-400 transition-colors cursor-pointer"
                >
                  Xóa
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={dnseId}
                  onChange={(e) => setDnseId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleApply()}
                  placeholder="Nhập ID tài khoản DNSE..."
                  className={`flex-1 text-sm rounded-xl px-4 py-2.5 focus:outline-none transition-colors ${
                    isDark
                      ? "bg-white/[0.06] border border-white/[0.1] text-white placeholder:text-white/30 focus:border-[var(--primary)]/50"
                      : "bg-white border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)]/50"
                  }`}
                />
                <button
                  onClick={handleApply}
                  disabled={submitting}
                  className="px-5 py-2.5 text-sm font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: "var(--primary, #2E4D3D)",
                    color: "var(--bg-page, #F8F7F2)",
                  }}
                >
                  {submitting ? "..." : "Áp dụng"}
                </button>
              </div>
            )}
            {errorMsg && (
              <p className="text-xs text-red-400 mt-2">{errorMsg}</p>
            )}
          </div>
        </motion.div>

        {/* ── Pricing Cards Grid ───────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" style={{ perspective: "1200px" }}>
          {plans.map((plan, idx) => (
            <PricingCard
              key={plan.id}
              plan={plan}
              isDNSE={isDNSE}
              isSignedIn={isSignedIn}
              isDark={isDark}
              index={idx}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  PRICING CARD
 * ═══════════════════════════════════════════════════════════════════════════ */

const glowRgba: Record<PricingPlan["accent"], string> = {
  sky: "0_0_50px_-8px_rgba(56,189,248,0.5)",
  blue: "0_0_50px_-8px_rgba(59,130,246,0.5)",
  emerald: "0_0_50px_-8px_rgba(16,185,129,0.55)",
  purple: "0_0_50px_-8px_rgba(168,85,247,0.55)",
};

function PricingCard({
  plan,
  isDNSE,
  isSignedIn,
  isDark,
  index,
}: {
  plan: PricingPlan;
  isDNSE: boolean;
  isSignedIn: boolean;
  isDark: boolean;
  index: number;
}) {
  const [loading, setLoading] = useState(false);
  const t = accentTokens[plan.accent];
  const glowShadow = glowRgba[plan.accent];
  const displayPrice = isDNSE ? plan.dnsePrice : plan.price;
  const showPctBadge = isDNSE && (plan.id === "6m" || plan.id === "12m");

  const handleCheckout = async () => {
    if (!isSignedIn) {
      window.location.href = "/auth";
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, useDnsePrice: isDNSE }),
      });
      const data = await res.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        alert(data.error ?? "Không tạo được link thanh toán");
      }
    } catch {
      alert("Lỗi kết nối, vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{
        opacity: { duration: 0.5, delay: 0.15 * index },
        y: { duration: 0.15, ease: "easeOut" },
        scale: { duration: 0.15, ease: "easeOut" },
      }}
      whileHover={{ scale: 1.06, y: -8 }}
      className={`
        glow-card relative flex flex-col rounded-2xl border
        p-6 cursor-pointer transition-all duration-300
        ${t.shadow}
        ${plan.ribbon ? "overflow-hidden" : ""}
      `}
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
      }}
    >
      {/* ── Ribbon ────────────────────────────────────────────────── */}
      {plan.ribbon && (
        <div
          className={`
            absolute top-5 -right-10 rotate-45 ${t.ribbon}
            text-[12px] font-bold text-white uppercase tracking-wider
            py-1 w-40 text-center shadow-lg
          `}
        >
          {plan.ribbon}
        </div>
      )}

      {/* ── Icon + Name ───────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-5">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.iconBg} ${t.iconText}`}
        >
          {plan.icon}
        </div>
        <div>
          <h3 className={`text-base font-bold ${isDark ? "text-white" : "text-slate-900"}`}>{plan.name}</h3>
          <span className={`text-[11px] ${isDark ? "text-white/35" : "text-slate-400"}`}>{plan.period}</span>
        </div>
      </div>

      {/* ── Price ─────────────────────────────────────────────────── */}
      <div className="mb-6">
        {isDNSE ? (
          <>
            <div className="flex items-center gap-2 mb-1">
              <p className={`text-sm line-through ${isDark ? "text-white/30" : "text-slate-400"}`}>
                {formatVND(plan.price)}
              </p>
              {showPctBadge && (
                <span className="inline-flex items-center gap-0.5 text-[11px] font-black uppercase tracking-wide bg-red-500/15 text-red-400 border border-red-500/25 px-2 py-0.5 rounded-full animate-pulse">
                  -{plan.discountPct}%
                </span>
              )}
            </div>
            <p className={`text-3xl font-black ${t.priceText}`}>
              {formatVND(displayPrice)}
            </p>
            <span className="inline-block mt-2 text-[12px] font-bold uppercase tracking-wider"
              style={{
                background: "var(--primary-light, rgba(46,77,61,0.08))",
                color: "var(--primary, #2E4D3D)",
                border: "1px solid var(--border, #E8E4DB)",
                borderRadius: "999px",
                padding: "2px 8px",
              }}>
              Tiết kiệm {formatVND(plan.price - plan.dnsePrice)}
            </span>
          </>
        ) : (
          <>
            <p className={`text-3xl font-black ${t.priceText}`}>
              {formatVND(displayPrice)}
            </p>
            <p className={`mt-1.5 text-[12px] ${isDark ? "text-white/30" : "text-slate-400"}`}>
              Chỉ <span style={{ color: "var(--primary, #2E4D3D)", fontWeight: 600 }}>{formatVND(plan.dnsePrice)}</span> với DNSE{" "}
              <span style={{ color: "var(--danger, #C0392B)" }}>(-{plan.discountPct}%)</span>
            </p>
          </>
        )}
      </div>

      {/* ── Features ──────────────────────────────────────────────── */}
      <ul className="space-y-3 mb-8 flex-1">
        {plan.features.map((feat) => (
          <li key={feat.text} className={`flex items-start gap-2.5 text-sm ${feat.locked ? "opacity-50" : ""}`}>
            {feat.locked ? (
              <Lock className="w-4 h-4 mt-0.5 shrink-0 text-slate-500" />
            ) : (
              <Check className={`w-4 h-4 mt-0.5 shrink-0 ${t.iconText}`} />
            )}
            <span className={feat.locked ? "text-slate-500" : isDark ? "text-white/60" : "text-slate-600"}>
              {feat.text}
            </span>
          </li>
        ))}
      </ul>

      {/* ── CTA Button ────────────────────────────────────────────── */}
      <button
        onClick={handleCheckout}
        disabled={loading}
        className={`
          w-full py-3 rounded-xl text-sm font-bold transition-all
          cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
          ${t.btn}
        `}
      >
        {loading ? "Đang tạo..." : "Đăng Ký Ngay"}
      </button>
    </motion.div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Check, Crown, Zap, Star, Shield, Gift, Sparkles, ExternalLink, Clock } from "lucide-react";

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
  features: string[];
  icon: React.ReactNode;
  accent: "sky" | "blue" | "emerald" | "purple";
  ribbon?: string;      // dải băng đặc biệt
}

const plans: PricingPlan[] = [
  {
    id: "1m",
    name: "Gói 1 Tháng",
    period: "/tháng",
    price: 1_000_000,
    dnsePrice: 700_000,
    icon: <Zap className="w-5 h-5" />,
    accent: "sky",
    features: [
      "Chat AI không giới hạn",
      "Dashboard đầy đủ",
      "Tín hiệu giao dịch",
      "RS Rating toàn thị trường",
    ],
  },
  {
    id: "3m",
    name: "Gói 3 Tháng",
    period: "/3 tháng",
    price: 2_000_000,
    dnsePrice: 1_500_000,
    icon: <Star className="w-5 h-5" />,
    accent: "blue",
    features: [
      "Tất cả tính năng Gói 1 Tháng",
      "Nhật ký + Phân tích tâm lý AI",
      "Báo cáo thị trường 8:00 & 17:00",
      "Tiết kiệm hơn so với gói tháng",
    ],
  },
  {
    id: "6m",
    name: "Gói 6 Tháng",
    period: "/6 tháng",
    price: 3_800_000,
    dnsePrice: 3_000_000,
    icon: <Crown className="w-5 h-5" />,
    accent: "emerald",
    ribbon: "Bán chạy nhất",
    features: [
      "Tất cả tính năng Gói 3 Tháng",
      "Ưu tiên tính năng mới",
      "Radar Leader Alert",
      "Top 5 Siêu Cổ Phiếu",
      "Hỗ trợ ưu tiên qua chat",
    ],
  },
  {
    id: "12m",
    name: "Gói 12 Tháng",
    period: "/năm",
    price: 7_000_000,
    dnsePrice: 6_000_000,
    icon: <Sparkles className="w-5 h-5" />,
    accent: "purple",
    ribbon: "Tiết kiệm nhất",
    features: [
      "Tất cả tính năng Gói 6 Tháng",
      "Tư vấn 1-1 hàng tháng",
      "VIP Discord community",
      "Whitelist tính năng beta",
      "Tiết kiệm tối đa so với gói tháng",
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
    btn: "bg-sky-500 hover:bg-sky-400 text-black",
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
    border: "border-emerald-500/30",
    borderHover: "hover:border-emerald-500/60",
    shadow: "hover:shadow-[0_0_50px_-12px_rgba(16,185,129,0.5)]",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
    btn: "bg-emerald-500 hover:bg-emerald-400 text-black",
    iconBg: "bg-emerald-500/10",
    iconText: "text-emerald-400",
    ribbon: "bg-emerald-500",
    priceText: "text-emerald-400",
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
    <section className="relative py-20 sm:py-28 px-4 bg-neutral-950">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-emerald-500/[0.03] rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* ── Heading ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <span className="inline-block text-[10px] font-bold text-emerald-400 uppercase tracking-[0.3em] mb-4 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
            Bảng giá đầu tư
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white">
            Chọn Gói Phù Hợp Với{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
              Đại Ca
            </span>
          </h2>
          <p className="text-neutral-400 mt-4 max-w-xl mx-auto text-sm sm:text-base">
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
          <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
            <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                <Gift className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white mb-1">
                  🎁 Mở tài khoản DNSE — Trải nghiệm miễn phí 1 tháng!
                </p>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Mở tài khoản chứng khoán DNSE qua link giới thiệu, sau khi tài khoản được duyệt (~1 tiếng),
                  nhập ID DNSE vào ô bên dưới để kích hoạt <span className="text-emerald-400 font-semibold">VIP miễn phí 1 tháng</span> + giá ưu đãi DNSE cho các gói tiếp theo.
                </p>
              </div>
              <a
                href="https://s.dnse.vn/HVxkDz"
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-all hover:scale-105 active:scale-95"
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
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-bold text-white">
                Nhập ID tài khoản DNSE
              </span>
            </div>
            <p className="text-xs text-neutral-500 mb-3">
              Áp dụng giá ưu đãi dành riêng cho khách hàng DNSE
            </p>

            {applied ? (
              <div className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                pending
                  ? "bg-amber-500/10 border border-amber-500/25"
                  : "bg-emerald-500/10 border border-emerald-500/25"
              }`}>
                <div className="flex items-center gap-2">
                  {pending ? (
                    <Clock className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Shield className="w-4 h-4 text-emerald-400" />
                  )}
                  <div>
                    <span className={`text-sm font-bold ${pending ? "text-amber-400" : "text-emerald-400"}`}>
                      DNSE: {dnseId}
                    </span>
                    {pending && (
                      <p className="text-[10px] text-amber-400/70 mt-0.5">
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
                  className="flex-1 bg-neutral-800 border border-neutral-700 text-white text-sm rounded-xl px-4 py-2.5 placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
                <button
                  onClick={handleApply}
                  disabled={submitting}
                  className="px-5 py-2.5 text-sm font-bold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan, idx) => (
            <PricingCard
              key={plan.id}
              plan={plan}
              isDNSE={isDNSE}
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
function PricingCard({
  plan,
  isDNSE,
  index,
}: {
  plan: PricingPlan;
  isDNSE: boolean;
  index: number;
}) {
  const t = accentTokens[plan.accent];
  const displayPrice = isDNSE ? plan.dnsePrice : plan.price;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: 0.15 * index }}
      className={`
        relative flex flex-col rounded-2xl border bg-neutral-900/60 backdrop-blur-sm
        p-6 transition-all duration-300 ease-out
        hover:-translate-y-4
        ${t.border} ${t.borderHover} ${t.shadow}
        ${plan.ribbon ? "overflow-hidden" : ""}
      `}
    >
      {/* ── Ribbon ────────────────────────────────────────────────── */}
      {plan.ribbon && (
        <div
          className={`
            absolute top-5 -right-10 rotate-45 ${t.ribbon}
            text-[10px] font-bold text-white uppercase tracking-wider
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
          <h3 className="text-base font-bold text-white">{plan.name}</h3>
          <span className="text-[11px] text-neutral-500">{plan.period}</span>
        </div>
      </div>

      {/* ── Price ─────────────────────────────────────────────────── */}
      <div className="mb-6">
        {isDNSE && (
          <p className="text-sm text-neutral-500 line-through mb-1">
            {formatVND(plan.price)}
          </p>
        )}
        <p className={`text-3xl font-black ${t.priceText}`}>
          {formatVND(displayPrice)}
        </p>
        {isDNSE && (
          <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
            Ưu đãi DNSE
          </span>
        )}
      </div>

      {/* ── Features ──────────────────────────────────────────────── */}
      <ul className="space-y-3 mb-8 flex-1">
        {plan.features.map((feat) => (
          <li key={feat} className="flex items-start gap-2.5 text-sm">
            <Check className={`w-4 h-4 mt-0.5 shrink-0 ${t.iconText}`} />
            <span className="text-neutral-300">{feat}</span>
          </li>
        ))}
      </ul>

      {/* ── CTA Button ────────────────────────────────────────────── */}
      <button
        className={`
          w-full py-3 rounded-xl text-sm font-bold transition-all
          cursor-pointer active:scale-95
          ${t.btn}
        `}
      >
        Đăng Ký Ngay
      </button>
    </motion.div>
  );
}

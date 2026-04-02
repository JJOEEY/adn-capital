"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Crown, Zap, Star, Shield, Gift, Sparkles } from "lucide-react";

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
    dnsePrice: 500_000,
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
    price: 3_000_000,
    dnsePrice: 1_800_000,
    icon: <Star className="w-5 h-5" />,
    accent: "blue",
    features: [
      "Tất cả tính năng Gói 1 Tháng",
      "Nhật ký + Phân tích tâm lý AI",
      "Báo cáo thị trường 8:00 & 17:00",
      "Tiết kiệm 10% so với gói tháng",
    ],
  },
  {
    id: "6m",
    name: "Gói 6 Tháng",
    period: "/6 tháng",
    price: 6_000_000,
    dnsePrice: 4_500_000,
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
    price: 12_000_000,
    dnsePrice: 6_000_000,
    icon: <Sparkles className="w-5 h-5" />,
    accent: "purple",
    ribbon: "Tiết kiệm nhất",
    features: [
      "Tất cả tính năng Gói 6 Tháng",
      "Tư vấn 1-1 hàng tháng",
      "VIP Discord community",
      "Whitelist tính năng beta",
      "Giảm 50% so với gói tháng",
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
  const [dnseId, setDnseId] = useState("");
  const [isDNSE, setIsDNSE] = useState(false);
  const [applied, setApplied] = useState(false);

  const handleApply = () => {
    if (dnseId.trim().length >= 3) {
      setIsDNSE(true);
      setApplied(true);
    }
  };

  const handleRemove = () => {
    setDnseId("");
    setIsDNSE(false);
    setApplied(false);
  };

  return (
    <section className="relative py-20 sm:py-28 px-4 bg-gray-900">
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
              <Gift className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-bold text-white">
                Khách hàng DNSE?
              </span>
            </div>
            <p className="text-xs text-neutral-500 mb-3">
              Nhập ID tài khoản DNSE để nhận ưu đãi giảm đến 50%
            </p>

            {applied ? (
              <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm text-emerald-400 font-bold">
                    DNSE: {dnseId}
                  </span>
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
                  className="px-5 py-2.5 text-sm font-bold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black transition-all cursor-pointer"
                >
                  Áp dụng
                </button>
              </div>
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

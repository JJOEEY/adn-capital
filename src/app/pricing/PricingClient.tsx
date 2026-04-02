"use client";

import { useState } from "react";
import { Check, Crown, Zap, Star, Gift, Shield } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  price: string;
  dnsePrice?: string;
  period: string;
  description: string;
  color: string;
  highlight: boolean;
  badge?: string;
  features: string[];
  cta: string;
}

const plans: Plan[] = [
  {
    id: "dnse",
    name: "DNSE Trader",
    price: "500K",
    period: "/tháng",
    description: "Dành riêng cho khách hàng DNSE",
    color: "emerald",
    highlight: false,
    badge: "DNSE",
    features: [
      "Chat AI 5 lượt/ngày",
      "Dashboard cơ bản",
      "Tín hiệu giao dịch",
      "Hỗ trợ qua chat",
    ],
    cta: "Đăng Ký DNSE",
  },
  {
    id: "vip3m",
    name: "VIP 3 Tháng",
    price: "3.000K",
    dnsePrice: "1.800K",
    period: "/3 tháng",
    description: "Phổ biến nhất cho trader chuyên nghiệp",
    color: "purple",
    highlight: true,
    features: [
      "Chat AI không giới hạn",
      "Đánh giá Vĩ mô đa khung",
      "Radar Leader Alert",
      "Top 5 Siêu Cổ Phiếu",
      "RS Rating toàn thị trường",
      "Nhật ký + Phân tích tâm lý AI",
      "Báo cáo thị trường 8:00 & 17:00",
      "Tín hiệu Siêu Cổ Phiếu",
    ],
    cta: "Đăng Ký VIP 3 Tháng",
  },
  {
    id: "vip6m",
    name: "VIP 6 Tháng",
    price: "6.000K",
    dnsePrice: "4.500K",
    period: "/6 tháng",
    description: "Tiết kiệm hơn với cam kết dài hạn",
    color: "yellow",
    highlight: false,
    features: [
      "Tất cả tính năng VIP 3 Tháng",
      "Ưu tiên tính năng mới",
      "Dedicated support",
    ],
    cta: "Chọn Gói 6 Tháng",
  },
  {
    id: "vip12m",
    name: "VIP 1 Năm",
    price: "12.000K",
    dnsePrice: "6.000K",
    period: "/năm",
    description: "Tiết kiệm tối đa – cam kết cả năm",
    color: "orange",
    highlight: false,
    features: [
      "Tất cả tính năng VIP",
      "Tư vấn 1-1 hàng tháng",
      "Whitelist tính năng beta",
      "VIP Discord community",
    ],
    cta: "Tiết Kiệm Nhiều Nhất",
  },
];

const colorMap: Record<string, { border: string; badge: string; btn: string; icon: string }> = {
  emerald: {
    border: "border-emerald-500/30",
    badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    btn: "bg-emerald-500 hover:bg-emerald-400 text-black",
    icon: "text-emerald-400 bg-emerald-500/15",
  },
  purple: {
    border: "border-purple-500/50",
    badge: "bg-purple-500/15 text-purple-400 border-purple-500/25",
    btn: "bg-purple-500 hover:bg-purple-400 text-white",
    icon: "text-purple-400 bg-purple-500/15",
  },
  yellow: {
    border: "border-yellow-500/30",
    badge: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
    btn: "bg-yellow-500 hover:bg-yellow-400 text-black",
    icon: "text-yellow-400 bg-yellow-500/15",
  },
  orange: {
    border: "border-orange-500/30",
    badge: "bg-orange-500/15 text-orange-400 border-orange-500/25",
    btn: "bg-orange-500 hover:bg-orange-400 text-black",
    icon: "text-orange-400 bg-orange-500/15",
  },
};

const iconMap: Record<string, React.ReactNode> = {
  emerald: <Zap className="w-5 h-5" />,
  purple: <Star className="w-5 h-5" />,
  yellow: <Crown className="w-5 h-5" />,
  orange: <Crown className="w-5 h-5" />,
};

export function PricingClient() {
  const [promoCode, setPromoCode] = useState("");
  const [isDnse, setIsDnse] = useState(false);
  const [promoApplied, setPromoApplied] = useState(false);

  const handleApplyPromo = () => {
    // Chấp nhận bất kỳ mã DNSE nào (ID khách hàng DNSE)
    if (promoCode.trim().length >= 3) {
      setIsDnse(true);
      setPromoApplied(true);
    }
  };

  const handleRemovePromo = () => {
    setPromoCode("");
    setIsDnse(false);
    setPromoApplied(false);
  };

  return (
    <>
      {/* Promocode DNSE */}
      <div className="max-w-md mx-auto mb-8">
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Gift className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-bold text-white">Khách hàng DNSE?</span>
          </div>
          <p className="text-xs text-neutral-500 mb-3">
            Nhập ID khách hàng DNSE để nhận ưu đãi đặc biệt
          </p>
          {promoApplied ? (
            <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-emerald-400 font-bold">
                  DNSE: {promoCode}
                </span>
              </div>
              <button
                onClick={handleRemovePromo}
                className="text-xs text-neutral-500 hover:text-red-400 transition-colors"
              >
                Xóa
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="Nhập ID khách hàng DNSE..."
                className="flex-1 bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
              />
              <button
                onClick={handleApplyPromo}
                disabled={promoCode.trim().length < 3}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-neutral-700 disabled:text-neutral-500 text-black font-bold text-sm rounded-xl transition-all"
              >
                Áp dụng
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {plans.map((plan) => {
          const colors = colorMap[plan.color];
          const showDnsePrice = isDnse && plan.dnsePrice;
          const displayPrice = showDnsePrice ? plan.dnsePrice! : plan.price;

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border ${colors.border} ${
                plan.highlight
                  ? "bg-neutral-800/80 shadow-xl shadow-purple-500/10"
                  : "bg-neutral-900"
              } p-6 transition-all hover:translate-y-[-2px]`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-purple-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                    Phổ biến nhất
                  </span>
                </div>
              )}

              {/* Plan header */}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-10 h-10 rounded-xl ${colors.icon} flex items-center justify-center`}>
                    {iconMap[plan.color]}
                  </div>
                  {plan.badge && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${colors.badge}`}>
                      {plan.badge}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-white mb-1">{plan.name}</h3>
                <p className="text-xs text-neutral-500">{plan.description}</p>
              </div>

              {/* Price */}
              <div className="mb-5">
                {showDnsePrice && (
                  <p className="text-sm text-neutral-600 line-through mb-0.5">
                    {plan.price}
                  </p>
                )}
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-white">{displayPrice}</span>
                  <span className="text-xs text-neutral-500">{plan.period}</span>
                </div>
                {showDnsePrice && (
                  <div className="inline-flex items-center gap-1 text-[10px] font-bold mt-1 px-2 py-0.5 rounded-md border bg-emerald-500/15 text-emerald-400 border-emerald-500/25">
                    <Gift className="w-3 h-3" />
                    Ưu đãi DNSE
                  </div>
                )}
              </div>

              {/* Features */}
              <ul className="space-y-2 flex-1 mb-6">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-xs text-neutral-300">
                    <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${colors.btn} ${
                  plan.highlight ? "shadow-lg shadow-purple-500/25" : ""
                }`}
              >
                {plan.cta}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

import { MainLayout } from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/Card";
import { DollarSign, Check, Crown, Zap, Star } from "lucide-react";

export const metadata = { title: "Bảng Giá - ADN Capital" };

const plans = [
  {
    id: "dnse",
    name: "DNSE",
    price: "500K",
    period: "/tháng",
    description: "Dành cho trader mới bắt đầu",
    icon: <Zap className="w-5 h-5" />,
    color: "emerald",
    features: [
      "30 lượt chat AI/ngày",
      "Phân tích PTKT cơ bản",
      "Signal tự động",
      "Nhật ký giao dịch",
      "Hỗ trợ qua chat",
    ],
    notIncluded: ["Phân tích tâm lý nâng cao", "Priority support"],
    cta: "Bắt đầu với DNSE",
    highlight: false,
  },
  {
    id: "vip1m",
    name: "VIP 1 Tháng",
    price: "1.500K",
    period: "/tháng",
    description: "Phổ biến nhất cho trader chuyên nghiệp",
    icon: <Star className="w-5 h-5" />,
    color: "purple",
    features: [
      "Chat AI không giới hạn",
      "PTKT & PTCB đầy đủ",
      "Signal ưu tiên cao",
      "Nhật ký + Phân tích tâm lý",
      "Cá nhân hóa AI theo lịch sử",
      "Báo cáo thị trường 8:00 & 17:00",
      "Priority support",
    ],
    notIncluded: [],
    cta: "Đăng Ký VIP Ngay",
    highlight: true,
  },
  {
    id: "vip3m",
    name: "VIP 3 Tháng",
    price: "4.000K",
    period: "/3 tháng",
    originalPrice: "4.500K",
    description: "Tiết kiệm 11% với gói 3 tháng",
    icon: <Crown className="w-5 h-5" />,
    color: "yellow",
    features: [
      "Tất cả tính năng VIP 1 Tháng",
      "Tiết kiệm 500K",
      "Ưu tiên tính năng mới",
      "Dedicated support",
    ],
    notIncluded: [],
    cta: "Chọn Gói 3 Tháng",
    highlight: false,
  },
  {
    id: "vip12m",
    name: "VIP 1 Năm",
    price: "12.000K",
    period: "/năm",
    originalPrice: "18.000K",
    description: "Tiết kiệm 33% với gói năm",
    icon: <Crown className="w-5 h-5" />,
    color: "orange",
    features: [
      "Tất cả tính năng VIP",
      "Tiết kiệm 6 triệu",
      "Tư vấn 1-1 hàng tháng",
      "Whitelist tính năng beta",
      "VIP Discord community",
    ],
    notIncluded: [],
    cta: "Tiết Kiệm Nhiều Nhất",
    highlight: false,
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

export default function PricingPage() {
  return (
    <MainLayout>
      <div className="p-3 md:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-3 py-1.5 rounded-full mb-4">
            <DollarSign className="w-3 h-3" />
            Bảng Giá Dịch Vụ
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white mb-3">
            Nâng cấp để giao dịch{" "}
            <span className="text-emerald-400">chuyên nghiệp hơn</span>
          </h1>
          <p className="text-neutral-400 max-w-lg mx-auto text-sm">
            Truy cập đầy đủ ADN Capital với phân tích chuyên sâu, tín hiệu ưu tiên và tư vấn cá nhân hóa theo lịch sử giao dịch của đại ca.
          </p>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {plans.map((plan) => {
            const colors = colorMap[plan.color];
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
                  <div className={`w-10 h-10 rounded-xl ${colors.icon} flex items-center justify-center mb-3`}>
                    {plan.icon}
                  </div>
                  <h3 className="text-base font-bold text-white mb-1">{plan.name}</h3>
                  <p className="text-xs text-neutral-500">{plan.description}</p>
                </div>

                {/* Price */}
                <div className="mb-5">
                  {plan.originalPrice && (
                    <p className="text-sm text-neutral-600 line-through mb-0.5">
                      {plan.originalPrice}
                    </p>
                  )}
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-white">{plan.price}</span>
                    <span className="text-xs text-neutral-500">{plan.period}</span>
                  </div>
                  {plan.originalPrice && (
                    <div className={`inline-block text-[10px] font-bold mt-1 px-2 py-0.5 rounded-md border ${colors.badge}`}>
                      Tiết kiệm {plan.color === "yellow" ? "11%" : "33%"}
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
                  {plan.notIncluded.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-xs text-neutral-600 line-through">
                      <span className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-center">×</span>
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

        {/* FAQ / Note */}
        <Card className="mt-8 p-6 text-center">
          <p className="text-sm text-neutral-400 mb-2">
            💳 Thanh toán qua <strong className="text-white">chuyển khoản ngân hàng</strong> hoặc{" "}
            <strong className="text-white">MoMo / ZaloPay</strong>
          </p>
          <p className="text-xs text-neutral-600">
            Liên hệ admin để kích hoạt tài khoản sau khi thanh toán · Hỗ trợ 24/7
          </p>
        </Card>
      </div>
    </MainLayout>
  );
}

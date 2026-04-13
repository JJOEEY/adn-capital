"use client";

import { useState, useRef, useCallback } from "react";
import { Check, Crown, Zap, Star, Gift, Shield, Lock, Sparkles } from "lucide-react";

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
  features: { text: string; locked?: boolean }[];
  cta: string;
}

const plans: Plan[] = [
  {
    id: "1m",
    name: "Gói 1 Tháng",
    price: "249.000đ",
    dnsePrice: "224.000đ",
    period: "/tháng",
    description: "Khởi đầu trải nghiệm ADN System",
    color: "emerald",
    highlight: false,
    features: [
      { text: "Hệ thống AI tư vấn mạnh mẽ (20 lượt/ngày)" },
      { text: "Cập nhật tin tức hằng ngày" },
      { text: "Theo dõi sức mạnh TT, chỉ số Cạn Kiệt Xu Hướng" },
      { text: "Khuyến nghị cổ phiếu từ AI Broker" },
      { text: "Sở hữu Nhật Ký Giao Dịch theo dõi hành trình" },
      { text: "Nhật Ký AI: Phân tích tâm lý & Cơ cấu danh mục", locked: true },
      { text: "Chỉ báo Cạn Kiệt Xu Hướng cho từng mã riêng lẻ", locked: true },
      { text: "AI Broker cảnh báo Real-time (Mua/Bán/Đi vốn)", locked: true },
      { text: "Nhận Report Weekly từ hệ thống ADN", locked: true },
      { text: "Hỗ trợ tư vấn 1-1 từ ADN Capital", locked: true },
      { text: "Tham gia room nhận tín hiệu Telegram", locked: true },
    ],
    cta: "Đăng Ký Ngay",
  },
  {
    id: "3m",
    name: "Gói 3 Tháng",
    price: "649.000đ",
    dnsePrice: "519.000đ",
    period: "/3 tháng",
    description: "Phổ biến cho trader chú trọng chi phí",
    color: "purple",
    highlight: false,
    features: [
      { text: "Hệ thống AI tư vấn mạnh mẽ (30 lượt/ngày)" },
      { text: "Cập nhật tin tức hằng ngày" },
      { text: "Theo dõi sức mạnh TT, chỉ số Cạn Kiệt Xu Hướng" },
      { text: "Khuyến nghị cổ phiếu từ AI Broker" },
      { text: "Sở hữu Nhật Ký Giao Dịch theo dõi hành trình" },
      { text: "Nhật Ký AI: Phân tích tâm lý & Cơ cấu danh mục", locked: true },
      { text: "Chỉ báo Cạn Kiệt Xu Hướng cho từng mã riêng lẻ", locked: true },
      { text: "AI Broker cảnh báo Real-time (Mua/Bán/Đi vốn)", locked: true },
      { text: "Nhận Report Weekly từ hệ thống ADN", locked: true },
      { text: "Hỗ trợ tư vấn 1-1 từ ADN Capital", locked: true },
      { text: "Tham gia room nhận tín hiệu Telegram", locked: true },
    ],
    cta: "Đăng Ký Ngay",
  },
  {
    id: "6m",
    name: "Gói 6 Tháng",
    price: "1.199.000đ",
    dnsePrice: "839.000đ",
    period: "/6 tháng",
    description: "Bán chạy nhất — mở khóa gần như toàn bộ",
    color: "yellow",
    highlight: true,
    badge: "Bán chạy",
    features: [
      { text: "Hệ thống AI tư vấn mạnh mẽ (Không giới hạn)" },
      { text: "Cập nhật tin tức hằng ngày" },
      { text: "Theo dõi sức mạnh TT, chỉ số Cạn Kiệt Xu Hướng" },
      { text: "Khuyến nghị cổ phiếu từ AI Broker" },
      { text: "Nhật Ký Giao Dịch, AI Phân tích & Cơ cấu danh mục" },
      { text: "Chỉ báo Cạn Kiệt Xu Hướng cho từng mã riêng lẻ" },
      { text: "AI Broker cảnh báo Real-time (Mua/Bán/Đi vốn)" },
      { text: "Nhận Report Weekly từ hệ thống ADN" },
      { text: "Hỗ trợ tư vấn 1-1 từ ADN Capital", locked: true },
      { text: "Tham gia room nhận tín hiệu Telegram", locked: true },
    ],
    cta: "Đăng Ký Ngay",
  },
  {
    id: "12m",
    name: "Gói 12 Tháng",
    price: "1.999.000đ",
    dnsePrice: "1.199.000đ",
    period: "/năm",
    description: "Tiết kiệm tối đa — mở khóa toàn bộ",
    color: "orange",
    highlight: false,
    badge: "Tiết kiệm",
    features: [
      { text: "Hệ thống AI tư vấn mạnh mẽ (Không giới hạn)" },
      { text: "Cập nhật tin tức hằng ngày" },
      { text: "Theo dõi sức mạnh TT, chỉ số Cạn Kiệt Xu Hướng" },
      { text: "Khuyến nghị cổ phiếu từ AI Broker" },
      { text: "Nhật Ký Giao Dịch, AI Phân tích & Cơ cấu danh mục" },
      { text: "Chỉ báo Cạn Kiệt Xu Hướng cho từng mã riêng lẻ" },
      { text: "AI Broker cảnh báo Real-time (Mua/Bán/Đi vốn)" },
      { text: "Nhận Report Weekly sớm nhất" },
      { text: "Hỗ trợ tư vấn 1-1 từ ADN Capital" },
      { text: "Tham gia room nhận tín hiệu Telegram" },
    ],
    cta: "Tiết Kiệm Nhiều Nhất",
  },
];

const colorMap: Record<string, {
  border: string; badge: React.CSSProperties; btn: React.CSSProperties; icon: React.CSSProperties;
  hoverBorder: string; hoverShadow: string; blob: React.CSSProperties;
}> = {
  emerald: {
    border: "rgba(16,185,129,0.30)",
    hoverBorder: "hover:border-emerald-500/50",
    hoverShadow: "hover:shadow-[0_0_40px_-10px_rgba(16,185,129,0.7)]",
    blob: { background: "rgba(16,185,129,0.20)" },
    badge: { background: "rgba(16,185,129,0.15)", color: "#10b981", borderColor: "rgba(16,185,129,0.25)" },
    btn: { background: "#10b981", color: "#000" },
    icon: { color: "#10b981", background: "rgba(16,185,129,0.15)" },
  },
  purple: {
    border: "rgba(168,85,247,0.30)",
    hoverBorder: "hover:border-purple-500/50",
    hoverShadow: "hover:shadow-[0_0_40px_-10px_rgba(168,85,247,0.7)]",
    blob: { background: "rgba(168,85,247,0.20)" },
    badge: { background: "rgba(168,85,247,0.15)", color: "#a855f7", borderColor: "rgba(168,85,247,0.25)" },
    btn: { background: "#a855f7", color: "#fff" },
    icon: { color: "#a855f7", background: "rgba(168,85,247,0.15)" },
  },
  yellow: {
    border: "rgba(234,179,8,0.30)",
    hoverBorder: "hover:border-yellow-500/50",
    hoverShadow: "hover:shadow-[0_0_40px_-10px_rgba(234,179,8,0.7)]",
    blob: { background: "rgba(234,179,8,0.20)" },
    badge: { background: "rgba(234,179,8,0.15)", color: "#eab308", borderColor: "rgba(234,179,8,0.25)" },
    btn: { background: "#eab308", color: "#000" },
    icon: { color: "#eab308", background: "rgba(234,179,8,0.15)" },
  },
  orange: {
    border: "rgba(249,115,22,0.30)",
    hoverBorder: "hover:border-orange-500/50",
    hoverShadow: "hover:shadow-[0_0_40px_-10px_rgba(249,115,22,0.7)]",
    blob: { background: "rgba(249,115,22,0.20)" },
    badge: { background: "rgba(249,115,22,0.15)", color: "#f97316", borderColor: "rgba(249,115,22,0.25)" },
    btn: { background: "#f97316", color: "#000" },
    icon: { color: "#f97316", background: "rgba(249,115,22,0.15)" },
  },
};

const iconMap: Record<string, React.ReactNode> = {
  emerald: <Zap className="w-5 h-5" />,
  purple: <Star className="w-5 h-5" />,
  yellow: <Crown className="w-5 h-5" />,
  orange: <Crown className="w-5 h-5" />,
};

/* ── Glow color per plan ────────────────────────────────────────────── */
const glowMap: Record<string, string> = {
  emerald: "rgba(16,185,129,0.35)",
  purple: "rgba(168,85,247,0.4)",
  yellow: "rgba(234,179,8,0.35)",
  orange: "rgba(249,115,22,0.35)",
};

/* ── 3D Interactive Card ────────────────────────────────────────────── */
function Card3D({
  children,
  color,
  highlight,
}: {
  children: React.ReactNode;
  color: string;
  highlight: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  const handleEnter = useCallback(() => {
    const glow = glowMap[color] ?? "rgba(255,255,255,0.15)";
    setStyle({
      transform: "perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1.05,1.05,1.05)",
      boxShadow: `0 25px 60px -12px ${glow}, 0 0 40px -8px ${glow}`,
    });
  }, [color]);

  const handleMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const midX = rect.width / 2;
      const midY = rect.height / 2;
      const rotateY = ((x - midX) / midX) * 12;   // max ±12deg
      const rotateX = ((midY - y) / midY) * 10;    // max ±10deg
      const glow = glowMap[color] ?? "rgba(255,255,255,0.15)";

      setStyle({
        transform: `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05,1.05,1.05)`,
        boxShadow: `0 25px 60px -12px ${glow}, 0 0 40px -8px ${glow}`,
      });
    },
    [color],
  );

  const handleLeave = useCallback(() => {
    setStyle({
      transform: "perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)",
      boxShadow: highlight
        ? `0 8px 30px -8px ${glowMap[color] ?? "rgba(255,255,255,0.08)"}`
        : "none",
    });
  }, [color, highlight]);

  return (
    <div
      ref={ref}
      onMouseEnter={handleEnter}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{
        ...style,
        transition: "transform 0.25s cubic-bezier(.22,.68,0,.98), box-shadow 0.35s ease",
        transformStyle: "preserve-3d",
        willChange: "transform",
      }}
      className="relative"
    >
      {children}
    </div>
  );
}

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
        <div className="border rounded-2xl p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Gift className="w-4 h-4" style={{ color: "var(--primary)" }} />
            <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Khách hàng DNSE?</span>
          </div>
          <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
            Nhập ID khách hàng DNSE để nhận ưu đãi đặc biệt
          </p>
          {promoApplied ? (
            <div className="flex items-center justify-between border rounded-xl px-4 py-3" style={{ background: "rgba(16,185,129,0.10)", borderColor: "rgba(16,185,129,0.25)" }}>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" style={{ color: "#10b981" }} />
                <span className="text-sm font-bold" style={{ color: "#10b981" }}>
                  DNSE: {promoCode}
                </span>
              </div>
              <button
                onClick={handleRemovePromo}
                className="text-xs transition-colors" style={{ color: "var(--text-muted)" }}
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
                className="flex-1 border rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors"
                style={{
                  background: "var(--surface-2)",
                  borderColor: "var(--border)",
                  color: "var(--text-primary)",
                }}
              />
              <button
                onClick={handleApplyPromo}
                disabled={promoCode.trim().length < 3}
                className="px-5 py-2.5 font-bold text-sm rounded-xl transition-all" style={{ background: "#10b981", color: "#000" }}
              >
                Áp dụng
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6" style={{ perspective: "1200px" }}>
        {plans.map((plan) => {
          const colors = colorMap[plan.color];
          const showDnsePrice = isDnse && plan.dnsePrice;
          const displayPrice = showDnsePrice ? plan.dnsePrice! : plan.price;

          return (
            <Card3D key={plan.id} color={plan.color} highlight={plan.highlight}>
              <div
                className="relative overflow-hidden flex flex-col rounded-2xl border p-6 transition-all duration-300 ease-out"
                style={{ background: "var(--surface)", borderColor: colors.border }}
              >
              {/* Backlight glow blob */}
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-30" style={colors.blob} />
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="text-[12px] font-bold px-3 py-1 rounded-full uppercase tracking-wide" style={{ background: "#a855f7", color: "#fff" }}>
                    Phổ biến nhất
                  </span>
                </div>
              )}

              {/* Plan header */}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={colors.icon}>
                    {iconMap[plan.color]}
                  </div>
                  {plan.badge && (
                    <span className="text-[12px] font-bold px-2 py-0.5 rounded-md border" style={colors.badge}>
                      {plan.badge}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold mb-1" style={{ color: "var(--text-primary)" }}>{plan.name}</h3>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{plan.description}</p>
              </div>

              {/* Price */}
              <div className="mb-5">
                {showDnsePrice && (
                  <p className="text-sm line-through mb-0.5" style={{ color: "var(--text-muted)" }}>
                    {plan.price}
                  </p>
                )}
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>{displayPrice}</span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{plan.period}</span>
                </div>
                {showDnsePrice && (
                  <div className="inline-flex items-center gap-1 text-[12px] font-bold mt-1 px-2 py-0.5 rounded-md border" style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", borderColor: "rgba(16,185,129,0.25)" }}>
                    <Gift className="w-3 h-3" />
                    Ưu đãi DNSE
                  </div>
                )}
              </div>

              {/* Features */}
              <ul className="space-y-2 flex-1 mb-6">
                {plan.features.map((feat) => (
                  <li key={feat.text} className={`flex items-start gap-2 text-xs ${feat.locked ? "opacity-50" : ""}`}>
                    {feat.locked ? (
                      <Lock className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
                    ) : (
                      <Check className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "#10b981" }} />
                    )}
                    <span style={{ color: feat.locked ? "var(--text-muted)" : "var(--text-secondary)" }}>{feat.text}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                className="w-full py-3 rounded-xl text-sm font-bold transition-all" style={{ ...colors.btn, ...(plan.highlight ? { boxShadow: "0 10px 15px -3px rgba(168,85,247,0.25)" } : {}) }}
              >
                {plan.cta}
              </button>
              </div>
            </Card3D>
          );
        })}
      </div>
    </>
  );
}

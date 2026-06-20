"use client";

/**
 * Pricing — interactive plan cards + referral, restyled to the marketing design.
 * LOGIC PRESERVED from the original: referral (localStorage `adn_referral_code` +
 * ?ref/?referralCode/…), session check, /api/payment/create (amount guard), DNSE discount.
 * Only the JSX/visuals changed (flip cards + growth art). Renders inside the marketing Shell.
 */

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Check, Loader2, Sparkles } from "lucide-react";

type PlanId = "3m" | "6m" | "12m";

type PricingPlan = {
  id: PlanId;
  name: string;
  num: string;
  short: string;
  tier: "base" | "vip" | "premium";
  period: string;
  focus: string;
  tagline: string;
  tag: string;
  price: number;
  bullets: string[];
  featured?: boolean;
};

const plans: PricingPlan[] = [
  {
    id: "3m", name: "ADN Base", num: "01", short: "Base", tier: "base", period: "3 tháng",
    focus: "Làm quen có kỷ luật", tagline: "Gieo hạt đầu tiên", tag: "Cơ bản", price: 649000,
    bullets: ["Nhịp thị trường và dữ liệu giá EOD", "ADN Stock bản cơ bản", "Nhật ký giao dịch", "AIDEN bản giới hạn"],
  },
  {
    id: "6m", name: "ADN VIP", num: "02", short: "VIP", tier: "vip", period: "6 tháng",
    focus: "Dùng công cụ hằng ngày", tagline: "Cây non vươn cành", tag: "Phổ biến", price: 1199000, featured: true,
    bullets: ["Mở khoá AIDEN, Radar, ART, RANK", "ADN Stock và ADN Lab đầy đủ", "Dữ liệu và cảnh báo realtime", "Ưu tiên hỗ trợ"],
  },
  {
    id: "12m", name: "ADN Premium", num: "03", short: "Premium", tier: "premium", period: "12 tháng",
    focus: "Theo sát phương pháp", tagline: "Cây trưởng thành, đơm hoa", tag: "Chuyên sâu", price: 1999000,
    bullets: ["Toàn bộ công cụ như gói VIP", "Ưu tiên hỗ trợ riêng", "Thời hạn 12 tháng, lợi nhất theo tháng"],
  },
];

const dong = (n: number) => `${n.toLocaleString("vi-VN")}đ`;
const inputCls =
  "w-full rounded-[10px] border border-[var(--hairline)] bg-[var(--canvas)] px-4 py-3 text-[15px] text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-faint)] focus:border-[var(--moss)]";

function normalizeReferralCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

function isReferralCode(value: string) {
  return /^[A-Z0-9_-]{3,32}$/.test(value);
}

function getInitialReferral(searchParams: URLSearchParams) {
  const legacyPriceCodeKey = "pro" + "mo";
  const keys = ["referralCode", "ref", legacyPriceCodeKey, "sponsor", "customerCode"];
  for (const key of keys) {
    const value = searchParams.get(key);
    if (value) return normalizeReferralCode(value);
  }
  if (typeof window !== "undefined") {
    const saved = window.localStorage.getItem("adn_referral_code");
    if (saved) return normalizeReferralCode(saved);
  }
  return "";
}

/* growth art per tier: a plant from sprout to flowering — the member's journey */
function Leaf({ x, y, rot, s = 1 }: { x: number; y: number; rot: number; s?: number }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${rot}) scale(${s})`}>
      <path d="M0,0 C18,-12 42,-9 54,5 C40,18 14,16 0,0 Z" fill="var(--leaf-fill)" stroke="var(--leaf)" strokeWidth={3} strokeLinejoin="round" />
      <path d="M6,2 C22,3 38,5 47,7" fill="none" stroke="var(--leaf)" strokeWidth={1.5} strokeOpacity={0.65} strokeLinecap="round" />
    </g>
  );
}

function PlanArt({ tier }: { tier: string }) {
  if (tier === "base") {
    return (
      <svg viewBox="0 0 200 210" className="h-[150px] w-auto" fill="none" aria-hidden>
        <path d="M46 184 Q100 172 154 184" stroke="var(--ground)" strokeWidth={4} strokeLinecap="round" />
        <path d="M100 182 C97 152 103 122 100 86" stroke="var(--stem)" strokeWidth={6} strokeLinecap="round" />
        <circle cx={100} cy={182} r={6} fill="var(--stem)" />
        <circle cx={100} cy={84} r={7.5} fill="var(--stem)" />
        <Leaf x={99} y={128} rot={202} />
        <Leaf x={101} y={140} rot={-22} />
      </svg>
    );
  }
  if (tier === "vip") {
    return (
      <svg viewBox="0 0 200 234" className="h-[186px] w-auto" fill="none" aria-hidden>
        <path d="M52 206 Q100 196 148 206" stroke="var(--ground)" strokeWidth={4} strokeLinecap="round" />
        <path d="M100 204 C98 160 102 110 100 56" stroke="var(--stem)" strokeWidth={6} strokeLinecap="round" />
        <circle cx={100} cy={204} r={5.5} fill="var(--stem)" />
        <Leaf x={100} y={168} rot={200} />
        <Leaf x={100} y={150} rot={-20} />
        <Leaf x={100} y={126} rot={202} s={0.92} />
        <Leaf x={100} y={108} rot={-22} s={0.92} />
        <Leaf x={100} y={86} rot={204} s={0.8} />
        <Leaf x={100} y={70} rot={-24} s={0.8} />
        <circle cx={100} cy={54} r={6.5} fill="var(--stem)" />
      </svg>
    );
  }
  const petals = [0, 60, 120, 180, 240, 300].map((a) => {
    const rad = (a * Math.PI) / 180;
    return <circle key={a} cx={100 + Math.cos(rad) * 15} cy={86 + Math.sin(rad) * 15} r={11} fill="var(--flower)" />;
  });
  return (
    <svg viewBox="0 0 200 244" className="h-[198px] w-auto" fill="none" aria-hidden>
      <circle cx={100} cy={92} r={66} stroke="var(--halo)" strokeWidth={1.5} />
      <path d="M52 216 Q100 206 148 216" stroke="var(--ground)" strokeWidth={4} strokeLinecap="round" />
      <path d="M100 214 C98 176 102 132 100 98" stroke="var(--stem)" strokeWidth={6} strokeLinecap="round" />
      <circle cx={100} cy={214} r={5.5} fill="var(--stem)" />
      <Leaf x={100} y={182} rot={200} s={0.95} />
      <Leaf x={100} y={164} rot={-20} s={0.95} />
      <Leaf x={100} y={142} rot={202} s={0.85} />
      <Leaf x={100} y={124} rot={-22} s={0.85} />
      {petals}
      <circle cx={100} cy={86} r={10} fill="var(--flower-center)" />
    </svg>
  );
}

export default function PricingClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [referralCode, setReferralCode] = useState("");
  const [referralNotice, setReferralNotice] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [loadingPlanId, setLoadingPlanId] = useState<PlanId | null>(null);

  useEffect(() => {
    const initial = getInitialReferral(searchParams);
    if (initial) {
      setReferralCode(initial);
      setReferralNotice(
        "Mã giới thiệu đã được giữ lại để ADN đối chiếu quyền lợi cộng thêm thời gian. Giá gói vẫn giữ nguyên.",
      );
    }
  }, [searchParams]);

  const normalizedReferral = normalizeReferralCode(referralCode);

  const saveReferralForLater = () => {
    if (!normalizedReferral) return true;
    if (!isReferralCode(normalizedReferral)) {
      setReferralNotice("Mã giới thiệu chưa đúng định dạng. Anh/chị vui lòng kiểm tra lại.");
      return false;
    }
    window.localStorage.setItem("adn_referral_code", normalizedReferral);
    setReferralNotice(
      "Mã giới thiệu đã được ghi nhận để đối chiếu quyền lợi cộng thêm thời gian. Giá gói không thay đổi.",
    );
    return true;
  };

  const createPayment = async (plan: PricingPlan) => {
    setLoadingPlanId(plan.id);
    setPaymentError("");
    try {
      if (!saveReferralForLater()) return;

      const response = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id }),
      });

      const data = await response.json();
      if (!response.ok || !data?.checkoutUrl) {
        throw new Error(data?.error || "Không tạo được thanh toán. Anh/chị thử lại sau.");
      }

      if (typeof data.amount === "number" && data.amount !== plan.price) {
        throw new Error("Số tiền thanh toán không khớp giá gốc của gói. ADN đã chặn giao dịch này.");
      }

      window.location.href = data.checkoutUrl;
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "Không tạo được thanh toán.");
    } finally {
      setLoadingPlanId(null);
    }
  };

  const handleSelectPlan = async (plan: PricingPlan) => {
    setPaymentError("");
    if (!session?.user?.id) {
      if (!saveReferralForLater()) return;
      router.push(`/auth?mode=register&plan=${plan.id}`);
      return;
    }
    await createPayment(plan);
  };

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-3">
        {plans.map((p) => (
          <div key={p.id} className={`dp-flip ${p.featured ? "dp-flip-feat" : ""}`}>
            <div className="dp-flip-inner">
              {/* front cover */}
              <div className={`dp-flip-front dp-cover-${p.tier}`}>
                <div className="flex items-start justify-between">
                  <span className="dp-mono text-[12px] tracking-[0.18em] opacity-60">/ {p.num}</span>
                  <span className="dp-mono rounded-md border border-current px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] opacity-90">{p.tag}</span>
                </div>
                <div className="flex grow items-center justify-center py-2">
                  <PlanArt tier={p.tier} />
                </div>
                <div className="text-center">
                  <p className="dp-mono text-[11.5px] uppercase tracking-[0.18em] opacity-55">{p.focus}</p>
                  <p className="dp-display text-[15px] font-medium leading-none opacity-65">ADN</p>
                  <h2 className="dp-display text-[42px] font-bold leading-[1.0]">{p.short}</h2>
                  <p className="mt-2 text-[15px] leading-snug">
                    <span className="dp-display text-[19px] italic text-[var(--gold)]">{p.period}</span>
                    <span className="opacity-40"> · </span>
                    <span className="opacity-70">{p.tagline}</span>
                  </p>
                </div>
              </div>
              {/* back detail */}
              <div className="dp-flip-back">
                <p className="dp-mono text-[11.5px] font-semibold uppercase tracking-[0.16em] text-[var(--gold)]">{p.name} gồm</p>
                <ul className="mt-5 grow space-y-3">
                  {p.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2.5 text-[15px] font-light leading-[1.5] text-[var(--ink-muted)]">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--moss)]" strokeWidth={2.25} /> {b}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => handleSelectPlan(p)}
                  disabled={loadingPlanId === p.id}
                  className="dp-btn dp-btn-solid dp-btn-lg w-full justify-center disabled:opacity-60"
                >
                  {loadingPlanId === p.id ? (
                    <><Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> Đang mở thanh toán...</>
                  ) : (
                    `Thanh toán · ${dong(p.price)}`
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* referral + status */}
      <div className="dp-panel mx-auto mt-10 max-w-[680px] p-6 sm:p-7">
        <div className="flex items-center gap-2">
          <Sparkles className="h-[18px] w-[18px] text-[var(--gold)]" strokeWidth={1.75} />
          <p className="dp-mono text-[11.5px] font-semibold uppercase tracking-[0.14em] text-[var(--gold)]">Mã giới thiệu</p>
        </div>
        <p className="mt-3 text-[14.5px] font-light leading-[1.55] text-[var(--ink-muted)]">
          Mở tài khoản chứng khoán DNSE qua link giới thiệu của ADN được ưu đãi tới 40%. Nhập mã ở đây để ADN ghi nhận và đối chiếu; giá gói hiển thị vẫn giữ nguyên.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            id="referralCode"
            value={referralCode}
            onChange={(event) => {
              setReferralCode(event.target.value);
              setReferralNotice("");
            }}
            placeholder="VD: ADN2026"
            className={inputCls}
          />
          <button type="button" onClick={saveReferralForLater} className="dp-btn dp-btn-ghost dp-btn-lg shrink-0 justify-center">
            Ghi nhận
          </button>
        </div>
        {referralNotice ? (
          <p className="mt-3 rounded-[10px] bg-[var(--mint)] px-4 py-3 text-[13.5px] font-light leading-[1.55] text-[var(--moss)]">{referralNotice}</p>
        ) : null}
        {paymentError ? (
          <p className="mt-3 rounded-[10px] border border-[var(--hairline)] px-4 py-3 text-[13.5px] font-light leading-[1.55] text-[var(--down)]">{paymentError}</p>
        ) : null}
      </div>
    </>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bot,
  Check,
  LineChart,
  NotebookPen,
  Radar,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";

type PlanId = "3m" | "6m" | "12m";

type PricingPlan = {
  id: PlanId;
  name: string;
  duration: string;
  days: number;
  price: number;
  label: string;
  description: string;
  note: string;
  highlighted?: boolean;
};

const plans: PricingPlan[] = [
  {
    id: "3m",
    name: "ADN Base",
    duration: "3 tháng",
    days: 90,
    price: 649000,
    label: "Bắt đầu có hệ thống",
    description:
      "Phù hợp khi anh/chị muốn làm quen với cách đọc thị trường, tra cứu cổ phiếu và ghi lại giao dịch trong một chu kỳ đủ dài.",
    note: "Dùng đủ 3 tháng để hình thành thói quen theo dõi.",
  },
  {
    id: "6m",
    name: "ADN VIP",
    duration: "6 tháng",
    days: 180,
    price: 1199000,
    label: "Lựa chọn cân bằng",
    description:
      "Dành cho người muốn dùng ADN đều đặn hơn: theo dõi nhịp thị trường, lọc cổ phiếu, kiểm tra từng mã và giữ nhật ký giao dịch.",
    note: "Thời gian vừa đủ để quan sát nhiều nhịp thị trường.",
    highlighted: true,
  },
  {
    id: "12m",
    name: "ADN Premium",
    duration: "12 tháng",
    days: 365,
    price: 1999000,
    label: "Đồng hành dài hạn",
    description:
      "Phù hợp khi anh/chị xem ADN như bộ công cụ đồng hành cả năm, cần đủ thời gian để đo lại phương pháp và kỷ luật giao dịch.",
    note: "Tối ưu cho người muốn xây dựng quy trình đầu tư nghiêm túc.",
  },
];

const publicTools = [
  {
    name: "ADN Pulse",
    icon: Activity,
    description:
      "Nơi tham khảo nhịp đập thị trường: chỉ số, độ rộng, thanh khoản, dòng tiền và mức rủi ro trong ngày.",
  },
  {
    name: "ADN Stock",
    icon: Bot,
    description:
      "Tra cứu từng cổ phiếu cùng AIDEN: kỹ thuật, định giá, thanh khoản và vùng giá cần chú ý.",
  },
  {
    name: "ADN Radar",
    icon: Radar,
    description:
      "Theo dõi tín hiệu đã được hệ thống xác nhận, giúp anh/chị biết mã nào đáng đưa vào danh sách quan sát.",
  },
  {
    name: "ADN Rank",
    icon: BarChart3,
    description:
      "Bảng xếp hạng sức mạnh cổ phiếu và nhóm ngành, hỗ trợ lọc mã khỏe hơn mặt bằng chung.",
  },
  {
    name: "ADN ART",
    icon: TrendingUp,
    description:
      "Theo dõi vùng đảo chiều để bớt mua theo cảm xúc và có điểm quản trị rõ hơn.",
  },
  {
    name: "ADN Diary",
    icon: NotebookPen,
    description:
      "Ghi lại từng giao dịch, lý do vào lệnh và cảm xúc để rút kinh nghiệm sau mỗi lần mua bán.",
  },
];

const sharedBenefits = [
  "Truy cập hệ sinh thái công cụ ADN trong thời hạn gói.",
  "Theo dõi thị trường, cổ phiếu, tín hiệu và nhật ký trong cùng một tài khoản.",
  "Quyền sử dụng được quản lý rõ ràng theo tài khoản ADN.",
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

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

export default function PricingClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("6m");
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

  const activePlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlan) ?? plans[1],
    [selectedPlan],
  );

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
    setSelectedPlan(plan.id);
    setPaymentError("");

    if (!session?.user?.id) {
      if (!saveReferralForLater()) return;
      router.push(`/auth?mode=register&plan=${plan.id}`);
      return;
    }

    await createPayment(plan);
  };

  return (
    <div className="space-y-16">
      <section className="grid gap-5 lg:grid-cols-3">
        {plans.map((plan) => (
          <article
            key={plan.id}
            className={`group relative flex min-h-[520px] flex-col rounded-[32px] border p-7 transition duration-300 ${
              plan.highlighted
                ? "border-[#FFD166]/60 bg-[#2B261D] shadow-[0_28px_90px_rgba(255,209,102,0.16)]"
                : "border-white/12 bg-[#141519] hover:border-[#FFD166]/45"
            }`}
          >
            {plan.highlighted ? (
              <div className="absolute right-6 top-6 rounded-full bg-[#FFD166] px-4 py-2 text-sm font-semibold text-[#101114]">
                Cân bằng
              </div>
            ) : null}
            <ShieldCheck className="mb-8 h-7 w-7 text-[#FFD166]" />
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#FFD166]">
              {plan.label}
            </p>
            <h2 className="text-4xl font-black leading-[1.15] tracking-tight text-[#F8F1E6]">
              {plan.name}
            </h2>
            <p className="mt-2 text-lg text-[#BFB8AE]">{plan.duration}</p>
            <div className="mt-8">
              <p className="text-5xl font-black leading-[1.15] tracking-tight text-[#F8F1E6]">
                {formatCurrency(plan.price)}
              </p>
              <p className="mt-2 text-sm text-[#A8A096]">Giá gốc cho {plan.days} ngày sử dụng.</p>
            </div>
            <p className="mt-7 text-base leading-[1.7] text-[#CFC7BA]">{plan.description}</p>
            <ul className="mt-8 space-y-4">
              {sharedBenefits.map((benefit) => (
                <li key={benefit} className="flex gap-3 text-sm leading-[1.7] text-[#E8DED0]">
                  <Check className="mt-1 h-4 w-4 flex-none text-[#FFD166]" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-[1.7] text-[#BFB8AE]">
              {plan.note}
            </p>
            <button
              type="button"
              onClick={() => handleSelectPlan(plan)}
              disabled={loadingPlanId === plan.id}
              className={`mt-auto inline-flex items-center justify-center gap-3 rounded-full px-6 py-4 text-base font-bold transition ${
                plan.highlighted
                  ? "bg-[#FFD166] text-[#101114] hover:bg-[#FFE09A]"
                  : "border border-white/15 bg-white/5 text-[#F8F1E6] hover:border-[#FFD166]/60 hover:text-[#FFD166]"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {loadingPlanId === plan.id ? "Đang mở thanh toán..." : `Chọn ${plan.name}`}
              <ArrowRight className="h-5 w-5" />
            </button>
          </article>
        ))}
      </section>

      <section className="grid gap-6 rounded-[36px] border border-white/12 bg-[#141519] p-6 lg:grid-cols-[0.9fr_1.1fr] lg:p-8">
        <div className="rounded-[28px] border border-[#FFD166]/35 bg-[#211E19] p-7">
          <Sparkles className="mb-6 h-8 w-8 text-[#FFD166]" />
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#FFD166]">
            Mã giới thiệu
          </p>
          <h2 className="mt-4 text-3xl font-black leading-[1.15] tracking-tight text-[#F8F1E6]">
            Ghi nhận quyền lợi thêm thời gian, không làm thay đổi giá gói.
          </h2>
          <p className="mt-5 text-base leading-[1.7] text-[#CFC7BA]">
            Mã giới thiệu giúp ADN đối chiếu quyền lợi cộng thêm thời gian sử dụng khi đủ điều kiện.
            Số tiền thanh toán vẫn là giá gốc của gói.
          </p>
        </div>
        <div className="flex flex-col justify-center rounded-[28px] border border-white/10 bg-black/20 p-6">
          <label htmlFor="referralCode" className="text-sm font-semibold text-[#F8F1E6]">
            Nhập mã giới thiệu nếu có
          </label>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              id="referralCode"
              value={referralCode}
              onChange={(event) => {
                setReferralCode(event.target.value);
                setReferralNotice("");
              }}
              placeholder="VD: ADN2026"
              className="min-h-14 flex-1 rounded-2xl border border-white/12 bg-[#0E0F12] px-5 text-base text-[#F8F1E6] outline-none transition placeholder:text-[#746E66] focus:border-[#FFD166]/70"
            />
            <button
              type="button"
              onClick={saveReferralForLater}
              className="min-h-14 rounded-2xl bg-[#FFD166] px-6 text-base font-bold text-[#101114] transition hover:bg-[#FFE09A]"
            >
              Ghi nhận
            </button>
          </div>
          {referralNotice ? (
            <p className="mt-4 rounded-2xl border border-[#FFD166]/20 bg-[#FFD166]/10 p-4 text-sm leading-[1.7] text-[#F8E0A2]">
              {referralNotice}
            </p>
          ) : null}
          {paymentError ? (
            <p className="mt-4 rounded-2xl border border-[#FF7A7A]/25 bg-[#FF4D4D]/10 p-4 text-sm leading-[1.7] text-[#FFB8B8]">
              {paymentError}
            </p>
          ) : null}
          <div className="mt-6 rounded-2xl border border-white/10 bg-[#101114] p-4 text-sm leading-[1.7] text-[#BFB8AE]">
            Gói đang xem: <span className="font-semibold text-[#F8F1E6]">{activePlan.name}</span> ·{" "}
            {activePlan.duration} · Giá gốc{" "}
            <span className="font-semibold text-[#FFD166]">{formatCurrency(activePlan.price)}</span>
          </div>
        </div>
      </section>

      <section className="rounded-[36px] border border-white/12 bg-[#141519] p-6 lg:p-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#FFD166]">
            Công cụ trong hệ sinh thái
          </p>
          <h2 className="mt-4 text-4xl font-black leading-[1.15] tracking-tight text-[#F8F1E6]">
            Một tài khoản, sáu công cụ public đang vận hành.
          </h2>
          <p className="mt-4 text-base leading-[1.7] text-[#BFB8AE]">
            Các gói khác nhau chủ yếu ở thời hạn sử dụng. Quyền truy cập công cụ được quản lý theo
            trạng thái tài khoản và các điều kiện đang áp dụng trong hệ thống.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {publicTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <div
                key={tool.name}
                className="rounded-[24px] border border-white/10 bg-[#0E0F12] p-5 transition hover:border-[#FFD166]/45"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFD166]/12 text-[#FFD166]">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-black leading-[1.25] text-[#F8F1E6]">{tool.name}</h3>
                <p className="mt-3 text-sm leading-[1.7] text-[#BFB8AE]">{tool.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-[36px] border border-[#FFD166]/30 bg-[#211E19] p-7 lg:p-9">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <LineChart className="mb-5 h-8 w-8 text-[#FFD166]" />
            <h2 className="text-3xl font-black leading-[1.15] tracking-tight text-[#F8F1E6]">
              Thanh toán theo giá gốc, quyền lợi được đối chiếu sau.
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-[1.7] text-[#CFC7BA]">
              Khi anh/chị chọn gói, hệ thống mở thanh toán theo đúng giá hiển thị. Nếu có mã giới
              thiệu, ADN ghi nhận để kiểm tra quyền lợi cộng thêm thời gian sử dụng khi đủ điều kiện.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleSelectPlan(activePlan)}
            disabled={loadingPlanId === activePlan.id}
            className="inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-[#FFD166] px-7 text-base font-bold text-[#101114] transition hover:bg-[#FFE09A] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Tiếp tục với {activePlan.name}
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </section>
    </div>
  );
}

"use client";

import { PRODUCT_NAMES } from "@/lib/brand/productNames";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bell,
  Bot,
  Check,
  Crown,
  Headphones,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  TicketPercent,
} from "lucide-react";

interface Plan {
  id: "3m" | "6m" | "12m";
  name: string;
  price: number;
  period: string;
  badge?: string;
  bestFor: string;
  description: string;
  discountPercent: number;
  ai: string;
  alerts: string;
  tools: string;
  support: string;
  features: string[];
  highlight?: boolean;
}

const plans: Plan[] = [
  {
    id: "3m",
    name: "3 tháng",
    price: 649_000,
    period: "/3 tháng",
    bestFor: "Bắt đầu theo dõi có kỷ luật",
    description: "Phù hợp cho khách hàng muốn trải nghiệm hệ sinh thái ADN trong một quý.",
    discountPercent: 20,
    ai: "Mở rộng lượt hỏi",
    alerts: "Ưu tiên thông báo",
    tools: `${PRODUCT_NAMES.dashboard}, ${PRODUCT_NAMES.brokerWorkflow}, ${PRODUCT_NAMES.art}`,
    support: "Hỗ trợ ưu tiên",
    features: [
      `${PRODUCT_NAMES.dashboard} cho thị trường và bản tin hằng ngày`,
      `${PRODUCT_NAMES.brokerWorkflow} ở mức theo dõi cơ hội`,
      `${PRODUCT_NAMES.art} cho thị trường và nhóm mã phổ biến`,
      "Mã khách hàng được duyệt giảm 20%",
    ],
  },
  {
    id: "6m",
    name: "6 tháng",
    price: 1_199_000,
    period: "/6 tháng",
    badge: "Khuyến nghị",
    bestFor: "Dùng nghiêm túc",
    description: "Gói cân bằng cho khách hàng dùng ADN Capital như hệ thống vận hành hằng ngày.",
    discountPercent: 30,
    ai: "Chuyên sâu hơn",
    alerts: "Đầy đủ cảnh báo",
    tools: `${PRODUCT_NAMES.brokerWorkflow}, ${PRODUCT_NAMES.art}, ${PRODUCT_NAMES.backtest}`,
    support: "Ưu tiên cao",
    highlight: true,
    features: [
      "Toàn bộ quyền của gói 3 tháng",
      "Theo dõi cơ hội, trạng thái và cảnh báo rủi ro",
      `${PRODUCT_NAMES.art} cho mã riêng lẻ và lịch sử theo dõi`,
      "Mã khách hàng được duyệt giảm 30%",
    ],
  },
  {
    id: "12m",
    name: "12 tháng",
    price: 1_999_000,
    period: "/năm",
    badge: "Tối ưu chi phí",
    bestFor: "Đồng hành dài hạn",
    description: "Phù hợp với khách hàng dùng ADN Capital cả năm và cần hỗ trợ onboarding kỹ hơn.",
    discountPercent: 40,
    ai: "Chuyên sâu, giới hạn hợp lý",
    alerts: "Đầy đủ cảnh báo",
    tools: "Toàn bộ bộ công cụ hiện có",
    support: "Hỗ trợ 1-1 theo lịch",
    features: [
      "Toàn bộ quyền của gói 6 tháng",
      "Ưu tiên hỗ trợ khi sản phẩm có cập nhật",
      "Onboarding quy trình sử dụng và review định kỳ",
      "Mã khách hàng được duyệt giảm 40%",
    ],
  },
];

const valueAxes = [
  {
    icon: Sparkles,
    title: "Trải nghiệm VIP 1 tuần",
    body: "Mở tài khoản mới để dùng thử VIP trong 7 ngày trước khi quyết định nâng cấp.",
  },
  {
    icon: TicketPercent,
    title: "Promo DNSE tới 40%",
    body: "Mở tài khoản DNSE và bắt đầu giao dịch để được xét mã khách hàng giảm giá.",
  },
  {
    icon: Bot,
    title: "AIDEN tư vấn dễ hiểu",
    body: "Hỏi về thị trường, cổ phiếu, rủi ro và kịch bản hành động bằng tiếng Việt có dấu.",
  },
  {
    icon: ShieldCheck,
    title: "Giảm giá cần admin duyệt",
    body: "Mã khách hàng chỉ áp dụng khi được xác nhận server-side, không tin dữ liệu từ trình duyệt.",
  },
];

const comparisonRows: { label: string; key: keyof Pick<Plan, "ai" | "alerts" | "tools" | "support"> }[] = [
  { label: "AIDEN tư vấn", key: "ai" },
  { label: "Cảnh báo", key: "alerts" },
  { label: "Công cụ", key: "tools" },
  { label: "Hỗ trợ", key: "support" },
];

function formatVnd(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value) + "đ";
}

function PlanCard({
  plan,
  customerCode,
  onSelect,
  isLoading,
}: {
  plan: Plan;
  customerCode: string;
  onSelect: (plan: Plan) => void;
  isLoading: boolean;
}) {
  const discountedPrice = Math.round((plan.price * (100 - plan.discountPercent)) / 100);

  return (
    <article
      className={`relative flex h-full flex-col rounded-[1.75rem] border p-5 transition hover:-translate-y-1 ${
        plan.highlight ? "lg:scale-[1.03]" : ""
      }`}
      style={{
        background: "var(--surface)",
        borderColor: plan.highlight ? "var(--primary)" : "var(--border)",
        boxShadow: plan.highlight ? "0 20px 60px rgba(46,77,61,0.16)" : "none",
      }}
    >
      {plan.badge ? (
        <div
          className="mb-4 inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
          style={{ background: "var(--primary)", color: "#EBE2CF" }}
        >
          <Crown className="h-3.5 w-3.5" />
          {plan.badge}
        </div>
      ) : null}

      <div className="mb-5">
        <p className="text-sm font-bold uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
          {plan.bestFor}
        </p>
        <h3 className="mt-2 text-2xl font-black">{plan.name}</h3>
        <p className="mt-2 min-h-[72px] text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
          {plan.description}
        </p>
      </div>

      <div className="mb-5 space-y-1">
        <div>
          <span className="text-3xl font-black">{formatVnd(plan.price)}</span>
          <span className="ml-1 text-sm" style={{ color: "var(--text-muted)" }}>
            {plan.period}
          </span>
        </div>
        <p className="text-sm font-bold" style={{ color: "var(--primary)" }}>
          Có mã được duyệt: {formatVnd(discountedPrice)} (-{plan.discountPercent}%)
        </p>
      </div>

      <ul className="mb-6 flex-1 space-y-3">
        {plan.features.map((feature) => (
          <li key={feature} className="flex gap-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
            <Check className="mt-1 h-4 w-4 shrink-0" style={{ color: "var(--primary)" }} />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => onSelect(plan)}
        disabled={isLoading}
        className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition"
        style={{
          background: plan.highlight ? "var(--primary)" : "var(--surface-2)",
          border: plan.highlight ? "1px solid var(--primary)" : "1px solid var(--border)",
          color: plan.highlight ? "#EBE2CF" : "var(--text-primary)",
          opacity: isLoading ? 0.72 : 1,
          cursor: isLoading ? "wait" : "pointer",
        }}
      >
        {isLoading
          ? "Đang xử lý..."
          : customerCode.trim()
            ? `Gửi duyệt mã và chọn ${plan.name}`
            : `Chọn gói ${plan.name}`}
        <ArrowRight className="h-4 w-4" />
      </button>
    </article>
  );
}

export function PricingClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [customerCode, setCustomerCode] = useState("");
  const [customerCodeMessage, setCustomerCodeMessage] = useState<string | null>(null);

  useEffect(() => {
    const queryCode = searchParams.get("customerCode");
    const storedCode =
      typeof window !== "undefined" ? window.localStorage.getItem("adn_customer_code") : null;
    const initialCode = queryCode || storedCode || "";

    if (initialCode) {
      setCustomerCode(initialCode.toUpperCase());
    }
  }, [searchParams]);

  const normalizedCode = useMemo(() => customerCode.trim().toUpperCase(), [customerCode]);

  async function requestCustomerCodeApproval(plan: Plan) {
    const response = await fetch("/api/pricing/customer-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerCode: normalizedCode, planId: plan.id }),
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      throw new Error("Cần đăng nhập trước khi gửi mã khách hàng.");
    }

    if (!response.ok) {
      throw new Error(data?.error || "Không thể kiểm tra mã khách hàng.");
    }

    return data as { status: "PENDING" | "APPROVED"; discountPercent?: number; message?: string };
  }

  async function createPayment(plan: Plan, codeForPayment?: string) {
    const response = await fetch("/api/payment/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: plan.id, customerCode: codeForPayment }),
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      router.push(`/auth?mode=login&plan=${encodeURIComponent(plan.id)}`);
      return;
    }

    if (!response.ok) {
      throw new Error(data?.error || "Không thể tạo phiên thanh toán PayOS.");
    }

    if (!data?.checkoutUrl) {
      throw new Error("PayOS không trả về đường dẫn thanh toán.");
    }

    window.location.href = data.checkoutUrl;
  }

  async function handleSelectPlan(plan: Plan) {
    setPaymentError(null);
    setCustomerCodeMessage(null);

    if (!session?.user) {
      if (normalizedCode && typeof window !== "undefined") {
        window.localStorage.setItem("adn_customer_code", normalizedCode);
      }

      const params = new URLSearchParams({
        mode: "register",
        plan: plan.id,
      });
      if (normalizedCode) params.set("customerCode", normalizedCode);

      router.push(`/auth?${params.toString()}`);
      return;
    }

    setLoadingPlanId(plan.id);
    try {
      if (normalizedCode) {
        const approval = await requestCustomerCodeApproval(plan);

        if (approval.status !== "APPROVED") {
          setCustomerCodeMessage(approval.message || "Mã đang chờ admin duyệt.");
          return;
        }
      }

      await createPayment(plan, normalizedCode || undefined);
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "Không thể tạo phiên thanh toán PayOS.");
    } finally {
      setLoadingPlanId(null);
    }
  }

  return (
    <div className="space-y-10">
      <section className="grid gap-4 md:grid-cols-2">
        <div
          className="rounded-[1.75rem] border p-5"
          style={{ background: "var(--primary-light)", borderColor: "var(--border)" }}
        >
          <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: "var(--primary)" }}>
            Dùng thử VIP
          </p>
          <h2 className="mt-2 text-2xl font-black">Mở tài khoản ngay để được trải nghiệm VIP 1 tuần</h2>
          <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
            Áp dụng cho tài khoản mới hoặc khách hàng chưa từng kích hoạt VIP/payment.
          </p>
        </div>
        <div
          className="rounded-[1.75rem] border p-5"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: "var(--primary)" }}>
            Promo DNSE
          </p>
          <h2 className="mt-2 text-2xl font-black">Mở tài khoản DNSE bắt đầu giao dịch để nhận Promo lên tới 40%</h2>
          <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
            Nhập mã khách hàng bên dưới. Giá ưu đãi chỉ được áp dụng sau khi admin duyệt.
          </p>
        </div>
      </section>

      <section
        className="rounded-[1.75rem] border p-5"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <label htmlFor="customerCode" className="text-sm font-black">
              Mã khách hàng
            </label>
            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              Mã cần được admin duyệt trước khi PayOS tạo giá giảm 20% / 30% / 40%.
            </p>
            <input
              id="customerCode"
              value={customerCode}
              onChange={(event) => {
                setCustomerCode(event.target.value.toUpperCase());
                setCustomerCodeMessage(null);
                setPaymentError(null);
              }}
              placeholder="Nhập mã khách hàng"
              className="mt-3 w-full rounded-2xl border px-4 py-3 text-sm font-bold outline-none"
              style={{
                background: "var(--surface-2)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </div>
          <div className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "var(--border)" }}>
            <p className="font-black">Mức giảm khi được duyệt</p>
            <p style={{ color: "var(--text-secondary)" }}>3 tháng -20% · 6 tháng -30% · 12 tháng -40%</p>
          </div>
        </div>

        {customerCodeMessage ? (
          <div
            className="mt-4 rounded-2xl border px-4 py-3 text-sm font-bold"
            style={{ borderColor: "#fed7aa", background: "#fff7ed", color: "#c2410c" }}
          >
            {customerCodeMessage}
          </div>
        ) : null}
      </section>

      {paymentError ? (
        <div
          className="rounded-2xl border px-4 py-3 text-sm font-bold"
          style={{ borderColor: "#fecaca", background: "#fef2f2", color: "#b91c1c" }}
        >
          {paymentError}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {valueAxes.map((axis) => {
          const Icon = axis.icon;
          return (
            <div
              key={axis.title}
              className="rounded-3xl border p-5"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            >
              <span
                className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl"
                style={{ background: "var(--primary-light)", color: "var(--primary)" }}
              >
                <Icon className="h-5 w-5" />
              </span>
              <h2 className="font-black">{axis.title}</h2>
              <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
                {axis.body}
              </p>
            </div>
          );
        })}
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            customerCode={normalizedCode}
            onSelect={handleSelectPlan}
            isLoading={loadingPlanId === plan.id}
          />
        ))}
      </section>

      <section
        className="overflow-hidden rounded-[1.75rem] border"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="border-b p-5" style={{ borderColor: "var(--border)" }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">So sánh nhanh</h2>
              <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                Bảng này giúp khách hàng chọn theo nhu cầu sử dụng, không dùng thuật ngữ broker nội bộ.
              </p>
            </div>
            <span
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold"
              style={{ background: "var(--primary-light)", borderColor: "var(--border)", color: "var(--primary)" }}
            >
              <Bell className="h-3.5 w-3.5" />
              Dễ hiểu
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr style={{ background: "var(--surface-2)" }}>
                <th className="p-4 font-black">Nhu cầu</th>
                {plans.map((plan) => (
                  <th key={plan.id} className="p-4 font-black">
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.key} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="p-4 font-bold" style={{ color: "var(--text-primary)" }}>
                    {row.label}
                  </td>
                  {plans.map((plan) => (
                    <td key={`${plan.id}-${row.key}`} className="p-4" style={{ color: "var(--text-secondary)" }}>
                      {plan[row.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <LayoutDashboard className="mb-4 h-6 w-6" style={{ color: "var(--primary)" }} />
          <h2 className="font-black">Gói dài hạn rõ ràng</h2>
          <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
            Bảng giá tập trung vào các chu kỳ 3, 6 và 12 tháng để khách hàng theo dõi đủ một nhịp thị trường.
          </p>
        </div>
        <div className="rounded-3xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <Headphones className="mb-4 h-6 w-6" style={{ color: "var(--primary)" }} />
          <h2 className="font-black">Cần duyệt trước khi giảm giá</h2>
          <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
            Nếu mã chưa được duyệt, hệ thống chỉ ghi nhận yêu cầu và không tạo giá giảm giả.
          </p>
        </div>
      </section>
    </div>
  );
}

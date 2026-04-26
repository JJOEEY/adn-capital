"use client";

import { useState } from "react";
import { PRODUCT_NAMES } from "@/lib/brand/productNames";
import {
  ArrowRight,
  Bell,
  Bot,
  Check,
  Crown,
  Headphones,
  LayoutDashboard,
  Sparkles,
} from "lucide-react";

interface Plan {
  id: string;
  name: string;
  price: string;
  period: string;
  badge?: string;
  bestFor: string;
  description: string;
  ai: string;
  alerts: string;
  tools: string;
  support: string;
  features: string[];
  highlight?: boolean;
}

const plans: Plan[] = [
  {
    id: "1m",
    name: "1 tháng",
    price: "249.000đ",
    period: "/tháng",
    bestFor: "Dùng thử hệ thống",
    description: `Phù hợp để xem ${PRODUCT_NAMES.dashboard}, bản tin và cách ${PRODUCT_NAMES.brokerWorkflow} trình bày cơ hội đầu tư.`,
    ai: "Giới hạn theo ngày",
    alerts: "Cập nhật cơ bản",
    tools: `${PRODUCT_NAMES.dashboard}, Tin tức, ${PRODUCT_NAMES.art} thị trường`,
    support: "Hỗ trợ tiêu chuẩn",
    features: [
      `${PRODUCT_NAMES.dashboard} thị trường và bản tin hằng ngày`,
      `${PRODUCT_NAMES.brokerWorkflow} ở mức theo dõi cơ bản`,
      `${PRODUCT_NAMES.art} cho thị trường và nhóm mã phổ biến`,
      "Tin tức và thông báo hệ thống",
    ],
  },
  {
    id: "3m",
    name: "3 tháng",
    price: "649.000đ",
    period: "/3 tháng",
    bestFor: "Xây thói quen theo dõi",
    description: "Dành cho khách hàng muốn theo dõi thị trường đều đặn trong một quý.",
    ai: "Mở rộng lượt hỏi",
    alerts: "Ưu tiên thông báo",
    tools: `${PRODUCT_NAMES.brokerWorkflow}, ${PRODUCT_NAMES.art}, Tin tức, Nhật ký`,
    support: "Hỗ trợ ưu tiên",
    features: [
      "Toàn bộ quyền của gói 1 tháng",
      `Tăng lượt tư vấn bằng ${PRODUCT_NAMES.advisory}`,
      "Thông báo cơ hội và cập nhật thị trường ưu tiên",
      `Theo dõi trạng thái cơ hội trong ${PRODUCT_NAMES.brokerWorkflow}`,
    ],
  },
  {
    id: "6m",
    name: "6 tháng",
    price: "1.199.000đ",
    period: "/6 tháng",
    badge: "Khuyến nghị",
    bestFor: "Dùng nghiêm túc",
    description: "Gói cân bằng nhất cho người dùng xem ADNexus như hệ thống vận hành hằng ngày.",
    ai: "Chuyên sâu hơn",
    alerts: "Đầy đủ cảnh báo",
    tools: `${PRODUCT_NAMES.brokerWorkflow}, ${PRODUCT_NAMES.art} mã riêng, ${PRODUCT_NAMES.backtest}`,
    support: "Ưu tiên cao",
    highlight: true,
    features: [
      "Toàn bộ quyền của gói 3 tháng",
      "Theo dõi mã đang quan sát, đang nắm giữ và đã kết thúc",
      `${PRODUCT_NAMES.art} cho mã riêng lẻ và lịch sử theo dõi`,
      "Weekly review và cảnh báo rủi ro danh mục",
    ],
  },
  {
    id: "12m",
    name: "12 tháng",
    price: "1.999.000đ",
    period: "/năm",
    badge: "Tối ưu chi phí",
    bestFor: "Đồng hành dài hạn",
    description: "Phù hợp với khách hàng dùng ADNexus cả năm và cần hỗ trợ onboarding kỹ hơn.",
    ai: "Chuyên sâu, giới hạn hợp lý",
    alerts: "Đầy đủ cảnh báo",
    tools: "Toàn bộ bộ công cụ hiện có",
    support: "Hỗ trợ 1-1 theo lịch",
    features: [
      "Toàn bộ quyền của gói 6 tháng",
      "Ưu tiên hỗ trợ khi sản phẩm có cập nhật",
      "Onboarding quy trình sử dụng và review định kỳ",
      "Phù hợp cho khách hàng theo dõi nhiều nhóm mã",
    ],
  },
];

const valueAxes = [
  {
    icon: Bot,
    title: "AIDEN tư vấn dễ hiểu",
    body: "Hỏi về cổ phiếu, xu hướng, rủi ro và kịch bản hành động bằng tiếng Việt có dấu.",
  },
  {
    icon: Bell,
    title: `${PRODUCT_NAMES.notifications} cảnh báo đúng lúc`,
    body: "Cơ hội, bản tin và thông báo đọc từ cùng nguồn dữ liệu để hạn chế lệch giữa web, app và Telegram.",
  },
  {
    icon: LayoutDashboard,
    title: "Theo dõi trong một nơi",
    body: `${PRODUCT_NAMES.dashboard}, ${PRODUCT_NAMES.brokerWorkflow}, ${PRODUCT_NAMES.art}, Tin tức và ${PRODUCT_NAMES.backtest} được gom theo cùng hành trình sử dụng.`,
  },
  {
    icon: Headphones,
    title: "Hỗ trợ vận hành",
    body: "Có hướng dẫn kích hoạt, onboarding và hỗ trợ khi dữ liệu hoặc quyền truy cập gặp lỗi.",
  },
];

const comparisonRows: { label: string; key: keyof Pick<Plan, "ai" | "alerts" | "tools" | "support"> }[] = [
  { label: "AIDEN tư vấn", key: "ai" },
  { label: "Cảnh báo", key: "alerts" },
  { label: "Công cụ", key: "tools" },
  { label: "Hỗ trợ", key: "support" },
];

function PlanCard({ plan }: { plan: Plan }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout() {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id }),
      });
      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        const callbackUrl = encodeURIComponent(`/pricing?plan=${plan.id}`);
        window.location.href = `/auth?mode=login&callbackUrl=${callbackUrl}`;
        return;
      }

      if (!response.ok || !data.checkoutUrl) {
        throw new Error(data.error || "Không tạo được liên kết thanh toán PayOS.");
      }

      window.location.href = data.checkoutUrl;
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Không tạo được liên kết thanh toán PayOS.");
    } finally {
      setIsLoading(false);
    }
  }

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

      <div className="mb-5">
        <span className="text-3xl font-black">{plan.price}</span>
        <span className="ml-1 text-sm" style={{ color: "var(--text-muted)" }}>
          {plan.period}
        </span>
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
        onClick={handleCheckout}
        disabled={isLoading}
        className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition"
        style={{
          background: plan.highlight ? "var(--primary)" : "var(--surface-2)",
          border: plan.highlight ? "1px solid var(--primary)" : "1px solid var(--border)",
          color: plan.highlight ? "#EBE2CF" : "var(--text-primary)",
          opacity: isLoading ? 0.7 : 1,
          cursor: isLoading ? "wait" : "pointer",
        }}
      >
        {isLoading ? "Đang tạo thanh toán..." : `Chọn gói ${plan.name}`}
        <ArrowRight className="h-4 w-4" />
      </button>

      {error ? (
        <p className="mt-3 rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "rgba(192,57,43,0.25)", color: "#C0392B" }}>
          {error}
        </p>
      ) : null}
    </article>
  );
}

export function PricingClient() {
  return (
    <div className="space-y-10">
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

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-4">
        {plans.map((plan) => (
          <PlanCard key={plan.id} plan={plan} />
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
              <Sparkles className="h-3.5 w-3.5" />
              Dễ hiểu
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
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
    </div>
  );
}

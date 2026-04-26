import { MainLayout } from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/Card";
import { BRAND, PRODUCT_NAMES } from "@/lib/brand/productNames";
import { DollarSign, ShieldCheck } from "lucide-react";
import { PricingClient } from "./PricingClient";

export const metadata = { title: `Bảng giá - ${BRAND.name}` };

export default function PricingPage() {
  return (
    <MainLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-10 grid gap-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-end">
          <div>
            <div
              className="mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em]"
              style={{ background: "var(--primary-light)", borderColor: "var(--border)", color: "var(--primary)" }}
            >
              <DollarSign className="h-3.5 w-3.5" />
              Bảng giá dịch vụ
            </div>
            <h1 className="max-w-3xl text-3xl font-black leading-tight tracking-[-0.04em] sm:text-5xl">
              Chọn gói theo cách bạn dùng {BRAND.name} mỗi ngày
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7" style={{ color: "var(--text-secondary)" }}>
              {BRAND.name} gom {PRODUCT_NAMES.dashboard}, {PRODUCT_NAMES.brokerWorkflow}, {PRODUCT_NAMES.art}, tin tức,{" "}
              {PRODUCT_NAMES.brief} và cảnh báo vào một bộ công cụ dễ dùng. Bảng giá này chỉ áp dụng cho các tính năng
              đang mở công khai.
            </p>
          </div>

          <Card className="p-5">
            <div className="flex gap-3">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                style={{ background: "var(--primary-light)", color: "var(--primary)" }}
              >
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-bold">Nguyên tắc an toàn</h2>
                <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
                  {BRAND.persona} chỉ hỗ trợ giải thích và tóm tắt. Tín hiệu, quản trị rủi ro và dữ liệu vận hành đi theo
                  nguồn dữ liệu kiểm soát của {BRAND.name}.
                </p>
              </div>
            </div>
          </Card>
        </section>

        <PricingClient />

        <Card className="mt-8 p-6">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <h2 className="text-lg font-black">Cần kích hoạt hoặc xuất hóa đơn?</h2>
              <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
                Liên hệ admin ADN Capital sau khi thanh toán để kích hoạt gói, cập nhật quyền truy cập và hỗ trợ
                onboarding.
              </p>
            </div>
            <div className="rounded-2xl border px-4 py-3 text-sm font-bold" style={{ borderColor: "var(--border)" }}>
              Hỗ trợ qua Zalo / Telegram chính thức
            </div>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}

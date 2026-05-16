import { Suspense } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/Card";
import { BRAND } from "@/lib/brand/productNames";
import { Gift, ShieldCheck, TicketPercent } from "lucide-react";
import { PricingClient } from "./PricingClient";

export const metadata = {
  title: `Bảng giá - ${BRAND.name}`,
  description: "Chọn gói ADN Capital, gửi promo code để duyệt ưu đãi và thanh toán qua PayOS.",
};

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
              <TicketPercent className="h-3.5 w-3.5" />
              Bảng giá dịch vụ
            </div>
            <h1 className="max-w-3xl text-3xl font-black leading-tight tracking-[-0.04em] sm:text-5xl">
              Chọn gói ADN Capital theo chu kỳ đầu tư của bạn
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7" style={{ color: "var(--text-secondary)" }}>
              Mở tài khoản để được trải nghiệm VIP 1 tuần. Nếu có promo code, hệ thống sẽ gửi yêu cầu duyệt trước khi áp dụng ưu đãi vào PayOS.
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
                <h2 className="font-bold">Điều kiện ưu đãi</h2>
                <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
                  Giá ưu đãi chỉ áp dụng dành cho khách hàng đã mở thành công tài khoản tại DNSE. Sau khi mở tài khoản và được duyệt, ưu đãi sẽ áp dụng cho từng gói riêng biệt. Promo code là số lưu ký của khách hàng, ví dụ: <span className="font-mono font-bold" style={{ color: "var(--text-primary)" }}>064COZ8EU7</span>.
                </p>
              </div>
            </div>
          </Card>
        </section>

        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <Card className="p-5">
            <div className="flex gap-3">
              <Gift className="h-6 w-6 text-[var(--primary)]" />
              <div>
                <h2 className="font-black">Mở tài khoản ngay để được trải nghiệm VIP 1 tuần</h2>
                <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
                  Trial VIP chỉ áp dụng một lần cho tài khoản mới/chưa từng kích hoạt VIP.
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex gap-3">
              <TicketPercent className="h-6 w-6 text-[var(--primary)]" />
              <div>
                <h2 className="font-black">Mở tài khoản DNSE bắt đầu giao dịch để nhận Promo lên tới 40%</h2>
                <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
                  Promo code là số lưu ký của khách hàng sau khi mở thành công tài khoản DNSE và được duyệt.
                </p>
              </div>
            </div>
          </Card>
        </div>

        <Suspense fallback={<Card className="p-6">Đang tải bảng giá...</Card>}>
          <PricingClient />
        </Suspense>

        <Card className="mt-8 p-6">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <h2 className="text-lg font-black">Cần kích hoạt hoặc xuất hóa đơn?</h2>
              <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
                Liên hệ admin ADN Capital sau khi thanh toán để kích hoạt gói, cập nhật quyền truy cập và hỗ trợ onboarding.
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

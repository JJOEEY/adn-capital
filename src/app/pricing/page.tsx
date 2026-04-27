import { Suspense } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/Card";
import { BRAND } from "@/lib/brand/productNames";
import { Gift, ShieldCheck, TicketPercent } from "lucide-react";
import { PricingClient } from "./PricingClient";

export const metadata = {
  title: `Bảng giá - ${BRAND.name}`,
  description: "Chọn gói ADN Capital, gửi mã khách hàng để admin duyệt ưu đãi và thanh toán qua PayOS.",
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
              Mở tài khoản để được trải nghiệm VIP 1 tuần. Nếu có mã khách hàng, hệ thống sẽ gửi yêu cầu admin duyệt trước khi áp dụng ưu đãi vào PayOS.
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
                <h2 className="font-bold">Nguyên tắc thanh toán an toàn</h2>
                <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
                  Giá giảm chỉ được tính ở máy chủ khi mã khách hàng đã được admin duyệt. Client không tự quyết định mức giảm.
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
                  Promo cần có mã khách hàng được admin duyệt: 20% cho 3 tháng, 30% cho 6 tháng, 40% cho 12 tháng.
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

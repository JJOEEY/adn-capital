import { Suspense } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/Card";
import { BRAND } from "@/lib/brand/productNames";
import { Gift, ShieldCheck, TicketPercent } from "lucide-react";
import { PricingClient } from "./PricingClient";

export const metadata = {
  title: `Bang gia - ${BRAND.name}`,
  description: "Chon goi ADN Capital, gui ma khach hang de admin duyet uu dai va thanh toan qua PayOS.",
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
              Bang gia dich vu
            </div>
            <h1 className="max-w-3xl text-3xl font-black leading-tight tracking-[-0.04em] sm:text-5xl">
              Chon goi ADN Capital theo chu ky dau tu cua ban
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7" style={{ color: "var(--text-secondary)" }}>
              Mo tai khoan de duoc trai nghiem VIP 1 tuan. Neu co ma khach hang, he thong se gui yeu cau admin duyet truoc khi ap dung uu dai vao PayOS.
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
                <h2 className="font-bold">Nguyen tac thanh toan an toan</h2>
                <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
                  Gia giam chi duoc tinh o may chu khi ma khach hang da duoc admin duyet. Client khong tu quyet dinh muc giam.
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
                <h2 className="font-black">Mo tai khoan ngay de duoc trai nghiem VIP 1 tuan</h2>
                <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
                  Trial VIP chi ap dung mot lan cho tai khoan moi/chua tung kich hoat VIP.
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex gap-3">
              <TicketPercent className="h-6 w-6 text-[var(--primary)]" />
              <div>
                <h2 className="font-black">Mo tai khoan DNSE bat dau giao dich de nhan Promo len toi 40%</h2>
                <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
                  Promo can co ma khach hang duoc admin duyet: 20% cho 3 thang, 30% cho 6 thang, 40% cho 12 thang.
                </p>
              </div>
            </div>
          </Card>
        </div>

        <Suspense fallback={<Card className="p-6">Dang tai bang gia...</Card>}>
          <PricingClient />
        </Suspense>

        <Card className="mt-8 p-6">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <h2 className="text-lg font-black">Can kich hoat hoac xuat hoa don?</h2>
              <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
                Lien he admin ADN Capital sau khi thanh toan de kich hoat goi, cap nhat quyen truy cap va ho tro onboarding.
              </p>
            </div>
            <div className="rounded-2xl border px-4 py-3 text-sm font-bold" style={{ borderColor: "var(--border)" }}>
              Ho tro qua Zalo / Telegram chinh thuc
            </div>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}

import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { PublicSiteFooter } from "@/components/adnexus/PublicSiteFooter";
import { PublicSiteHeader } from "@/components/adnexus/PublicSiteHeader";
import { ProductModuleCard } from "@/components/adnexus/ProductModuleCard";
import { BRAND, PRODUCT_NAMES } from "@/lib/brand/productNames";
import { PRODUCT_MODULES } from "@/lib/brand/nexsuite";

const visibleProducts = PRODUCT_MODULES.filter((product) => product.status !== "Admin");

export default function ProductsPage() {
  return (
    <main className="min-h-screen" style={{ background: "var(--page-surface)", color: "var(--text-primary)" }}>
      <PublicSiteHeader />

      <section className="flex min-h-[100svh] w-full items-center px-5 py-24 sm:px-8 lg:px-12 xl:px-16">
        <div className="grid w-full gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.32em]" style={{ color: "var(--primary)" }}>
              {BRAND.name} - {PRODUCT_NAMES.suite}
            </p>
            <h1 className="mt-6 max-w-5xl text-5xl font-black leading-[0.96] tracking-[-0.06em] sm:text-7xl lg:text-8xl">
              Một hệ sinh thái cho toàn bộ hành trình đầu tư.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8" style={{ color: "var(--text-secondary)" }}>
              Từ đọc thị trường, soi cổ phiếu, theo dõi cơ hội đến giữ kỷ luật hành động, mọi công cụ trong ADN Capital được đặt trong một workflow dễ hiểu và dễ kiểm soát.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/#products"
                className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-black"
                style={{ background: "var(--primary)", color: "white" }}
              >
                Xem trên trang chủ <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 rounded-2xl border px-5 py-3 font-black"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              >
                Xem bảng giá
              </Link>
            </div>
          </div>

          <div className="rounded-[2.5rem] border bg-white/80 p-5 shadow-2xl shadow-black/10 dark:bg-white/5" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs font-black uppercase tracking-[0.24em]" style={{ color: "var(--text-muted)" }}>
              ADN Capital workflow
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                ["Đọc thị trường", PRODUCT_NAMES.market],
                ["Soi cổ phiếu", PRODUCT_NAMES.stock],
                ["Theo dõi cơ hội", PRODUCT_NAMES.signals],
                ["Giữ kỷ luật", PRODUCT_NAMES.risk],
              ].map(([title, value]) => (
                <div key={title} className="rounded-3xl border bg-[var(--surface-2)] p-5" style={{ borderColor: "var(--border)" }}>
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <p className="mt-5 text-sm font-bold" style={{ color: "var(--text-muted)" }}>{title}</p>
                  <p className="mt-2 text-2xl font-black" style={{ color: "var(--text-primary)" }}>{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-3xl border p-5" style={{ borderColor: "var(--border)" }}>
              <p className="text-sm leading-7" style={{ color: "var(--text-secondary)" }}>
                Các tính năng broker chỉ hiển thị theo chế độ pilot/safe-mode khi đủ điều kiện. Trang public không gọi DNSE runtime và không tự động đặt lệnh.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 pb-24 sm:px-8 lg:px-12 xl:px-16">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em]" style={{ color: "var(--primary)" }}>
              Bộ công cụ
            </p>
            <h2 className="mt-3 text-4xl font-black tracking-[-0.04em] lg:text-6xl">
              Các module trong hệ sinh thái ADN
            </h2>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visibleProducts.map((product) => (
            <ProductModuleCard key={product.slug} product={product} />
          ))}
        </div>
      </section>

      <PublicSiteFooter />
    </main>
  );
}

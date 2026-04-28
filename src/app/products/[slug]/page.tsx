import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { PublicSiteFooter } from "@/components/adnexus/PublicSiteFooter";
import { PublicSiteHeader } from "@/components/adnexus/PublicSiteHeader";
import { ProductSceneVisual } from "@/components/adnexus/ProductScenes";
import { BRAND } from "@/lib/brand/productNames";
import { getProductModule, PRODUCT_MODULES } from "@/lib/brand/nexsuite";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return PRODUCT_MODULES.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const product = getProductModule(slug);
  if (!product) return {};

  return {
    title: `${product.shortName ?? product.name} | ${BRAND.name}`,
    description: product.outcome,
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const product = getProductModule(slug);
  if (!product) notFound();

  const safeRoute = product.status === "Admin" ? "/products/nexlink" : product.route;

  return (
    <main className="min-h-screen" style={{ background: "var(--page-surface)", color: "var(--text-primary)" }}>
      <PublicSiteHeader />
      <section className="flex min-h-[calc(100svh-76px)] w-full items-center px-5 py-12 sm:px-8 lg:px-12 lg:py-10 xl:px-16">
        <div className="grid w-full items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.32em]" style={{ color: "var(--primary)" }}>
              {product.pillar} - {product.status}
            </p>
            <h1 className="mt-7 text-6xl font-black leading-[0.95] tracking-[-0.07em] lg:text-8xl">
              {product.shortName ?? product.name}
            </h1>
            <p className="mt-7 max-w-3xl text-2xl font-black leading-tight" style={{ color: "var(--text-primary)" }}>
              {product.outcome}
            </p>
            <p className="mt-6 max-w-2xl text-lg leading-8" style={{ color: "var(--text-secondary)" }}>
              {product.tagline}
            </p>
            <div className="mt-8 grid gap-3">
              {product.bullets.map((bullet) => (
                <p key={bullet} className="flex items-center gap-3 font-bold" style={{ color: "var(--text-secondary)" }}>
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" /> {bullet}
                </p>
              ))}
            </div>
            {product.safetyNote ? (
              <div className="mt-8 rounded-2xl border p-5 leading-8" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                {product.safetyNote}
              </div>
            ) : null}
            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                href={safeRoute}
                className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-black"
                style={{ background: "var(--primary)", color: "white" }}
              >
                {product.status === "Admin" ? "Xem trạng thái pilot" : `Mở ${product.shortName ?? product.name}`} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/products"
                className="inline-flex items-center gap-2 rounded-2xl border px-5 py-3 font-black"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              >
                Quay lại hệ sinh thái ADN
              </Link>
            </div>
          </div>
          <ProductSceneVisual scene={product.scene} />
        </div>
      </section>

      <section className="px-5 pb-20 sm:px-8 lg:px-12 xl:px-16">
        <div className="rounded-[2rem] border p-8" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
          <p className="text-xs font-black uppercase tracking-[0.24em]" style={{ color: "var(--text-muted)" }}>
            Nguyên tắc hiển thị
          </p>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {[
              "Không dùng KPI giả hoặc cam kết lợi nhuận.",
              "Tên sản phẩm, mô tả và CTA hiển thị theo chuẩn ADN Capital.",
              product.slug === "nexlink" || product.slug === "nexpilot"
                ? "Broker workflow chỉ là preview/pilot-safe trên public, không tự động đặt lệnh."
                : "Dữ liệu sản phẩm đi theo nguồn canonical của hệ thống khi vào app.",
            ].map((item) => (
              <div key={item} className="rounded-2xl bg-[var(--surface-2)] p-5 font-bold" style={{ color: "var(--text-secondary)" }}>
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
      <PublicSiteFooter />
    </main>
  );
}

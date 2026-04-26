import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PublicSiteFooter } from "@/components/adnexus/PublicSiteFooter";
import { PublicSiteHeader } from "@/components/adnexus/PublicSiteHeader";
import { ProductModuleCard } from "@/components/adnexus/ProductModuleCard";
import { ProductSceneVisual } from "@/components/adnexus/ProductScenes";
import { BRAND } from "@/lib/brand/productNames";
import { PUBLIC_PRODUCT_MODULES } from "@/lib/brand/nexsuite";

export const metadata: Metadata = {
  title: "NexSuite - Bộ công cụ ADNexus",
  description:
    "Khám phá NexSuite: NexPulse, NexLens, NexRadar, NexRank, NexART, NexPilot, NexLab và AIDEN Advisory trong hệ điều hành đầu tư ADNexus.",
  alternates: {
    canonical: "/products",
  },
  openGraph: {
    title: "NexSuite - Bộ công cụ ADNexus",
    description: "Một product universe cho phân tích, kỷ luật và kết nối danh mục đầu tư.",
    url: "/products",
    images: ["/brand/logo-light.jpg"],
  },
};

export default function ProductsPage() {
  const softwareJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "ADNexus NexSuite",
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web, PWA",
    provider: {
      "@type": "Organization",
      name: BRAND.company,
      url: "https://adncapital.com.vn",
    },
    description: "Bộ công cụ đầu tư AI cho chứng khoán Việt Nam.",
  };

  return (
    <main className="min-h-screen" style={{ background: "var(--page-surface)", color: "var(--text-primary)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }} />
      <PublicSiteHeader />
      <section className="flex min-h-[100svh] w-full items-center px-5 pt-32 pb-20 sm:px-8 lg:px-12 xl:px-16">
        <div className="grid w-full gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.32em]" style={{ color: "var(--primary)" }}>
              {BRAND.platform} - NexSuite
            </p>
            <h1 className="mt-6 text-6xl font-black leading-[0.95] tracking-[-0.07em] lg:text-8xl">
              Bộ công cụ đầu tư được kể như một workflow.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8" style={{ color: "var(--text-secondary)" }}>
              Mỗi module có vai trò riêng trong hành trình: đọc dữ liệu, soi cổ phiếu, theo dõi cơ hội,
              kiểm tra rủi ro, quản trị danh mục và hỏi AIDEN.
            </p>
            <Link
              href="/#products"
              className="mt-8 inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-black"
              style={{ background: "var(--primary)", color: "white" }}
            >
              Xem câu chuyện trên trang chủ <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <ProductSceneVisual scene="pulse" />
        </div>
      </section>

      <section className="w-full px-5 pb-20 sm:px-8 lg:px-12 xl:px-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em]" style={{ color: "var(--text-muted)" }}>
              Product universe
            </p>
            <h2 className="mt-3 text-4xl font-black tracking-[-0.05em]">
              NexSuite theo 3 lớp: Analyst, Discipline, Network.
            </h2>
          </div>
          <p className="max-w-xl leading-7" style={{ color: "var(--text-secondary)" }}>
            NexLink vẫn ở trạng thái pilot/admin và không hiển thị như chức năng public cho khách hàng thường.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {PUBLIC_PRODUCT_MODULES.map((product) => (
            <ProductModuleCard key={product.slug} product={product} />
          ))}
        </div>
      </section>
      <PublicSiteFooter />
    </main>
  );
}

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PublicSiteFooter } from "@/components/adnexus/PublicSiteFooter";
import { PublicSiteHeader } from "@/components/adnexus/PublicSiteHeader";
import { ProductModuleCard } from "@/components/adnexus/ProductModuleCard";
import { ProductSceneVisual } from "@/components/adnexus/ProductScenes";
import { BRAND } from "@/lib/brand/productNames";
import { PRODUCT_MODULES } from "@/lib/brand/nexsuite";

export default function ProductsPage() {
  return (
    <main className="min-h-screen" style={{ background: "var(--page-surface)", color: "var(--text-primary)" }}>
      <PublicSiteHeader />
      <section className="px-5 py-20 sm:px-8 lg:px-12 xl:px-16">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.32em]" style={{ color: "var(--primary)" }}>
              {BRAND.platform} · NexSuite
            </p>
            <h1 className="mt-6 text-6xl font-black leading-[0.95] tracking-[-0.07em] lg:text-8xl">
              Bộ công cụ đầu tư được kể như một workflow.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8" style={{ color: "var(--text-secondary)" }}>
              Mỗi module có vai trò riêng trong hành trình: đọc dữ liệu, soi cổ phiếu, theo dõi cơ hội, kiểm tra rủi ro, quản trị danh mục và hỏi AIDEN.
            </p>
            <Link href="/#products" className="mt-8 inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-black" style={{ background: "var(--primary)", color: "white" }}>
              Xem câu chuyện trên trang chủ <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <ProductSceneVisual scene="pulse" />
        </div>
      </section>

      <section className="px-5 pb-20 sm:px-8 lg:px-12 xl:px-16">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {PRODUCT_MODULES.map((product) => (
            <ProductModuleCard key={product.slug} product={product} />
          ))}
        </div>
      </section>
      <PublicSiteFooter />
    </main>
  );
}

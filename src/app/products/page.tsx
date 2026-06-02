import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { PublicSiteFooter } from "@/components/adnexus/PublicSiteFooter";
import { PublicSiteHeader } from "@/components/adnexus/PublicSiteHeader";
import { ProductModuleCard } from "@/components/adnexus/ProductModuleCard";
import { publicBodyFont, publicSerifFont } from "@/components/adnexus/publicFonts";
import { PUBLIC_PRODUCT_MODULES } from "@/lib/brand/nexsuite";

const visibleProducts = PUBLIC_PRODUCT_MODULES;

export const metadata = {
  title: "Công cụ ADN Capital",
  description: "Danh sách công cụ ADN Capital dành cho nhà đầu tư Việt Nam.",
};

export default function ProductsPage() {
  return (
    <main className={`${publicBodyFont.variable} ${publicSerifFont.variable} ${publicBodyFont.className} adn-public-type min-h-screen`}>
      <PublicSiteHeader />

      <section
        className="relative overflow-hidden px-5 py-20 sm:px-8 lg:px-12 xl:px-16"
        style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(circle_at_18%_12%,color-mix(in_srgb,var(--primary)_18%,transparent),transparent_30%),radial-gradient(circle_at_78%_10%,rgba(255,255,255,0.08),transparent_24%)]" />
        <div className="relative mx-auto max-w-[1500px]">
          <div className="max-w-4xl animate-adn-rise">
            <p className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.18em]" style={{ borderColor: "var(--border)", color: "var(--primary)" }}>
              <Sparkles className="h-4 w-4" /> Hệ sinh thái ADN Capital
            </p>
            <h1 className="mt-8 text-[clamp(3.4rem,8vw,9rem)] font-black leading-[1.15] tracking-tight">
              Mỗi công cụ giải một việc cụ thể trong hành trình đầu tư.
            </h1>
            <p className="mt-7 max-w-3xl text-xl font-normal leading-[1.7]" style={{ color: "var(--text-secondary)" }}>
              Anh/chị không cần mở tất cả cùng lúc. Hãy bắt đầu từ vấn đề đang gặp: đọc thị trường, lọc cổ phiếu,
              theo dõi tín hiệu, tra cứu từng mã hoặc ghi lại quyết định của chính mình.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/#journey"
                className="inline-flex items-center gap-2 rounded-full px-6 py-4 text-sm font-black"
                style={{ background: "var(--primary)", color: "var(--on-primary)" }}
              >
                Làm bài test <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/#membership"
                className="inline-flex items-center gap-2 rounded-full border px-6 py-4 text-sm font-black"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              >
                Xem gói dịch vụ <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="mt-14 grid gap-8">
            {visibleProducts.map((product, index) => (
              <div key={product.slug} className="animate-adn-rise" style={{ animationDelay: `${index * 70}ms` }}>
                <ProductModuleCard product={product} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <PublicSiteFooter />
    </main>
  );
}

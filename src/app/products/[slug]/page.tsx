import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { PublicSiteFooter } from "@/components/adnexus/PublicSiteFooter";
import { PublicSiteHeader } from "@/components/adnexus/PublicSiteHeader";
import { ProductDemoImage } from "@/components/adnexus/ProductDemoImage";
import { publicBodyFont, publicSerifFont } from "@/components/adnexus/publicFonts";
import { PUBLIC_PRODUCT_MODULES } from "@/lib/brand/nexsuite";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return PUBLIC_PRODUCT_MODULES.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const product = PUBLIC_PRODUCT_MODULES.find((module) => module.slug === slug);

  if (!product) {
    return {
      title: "Không tìm thấy công cụ",
    };
  }

  return {
    title: `${product.shortName ?? product.name} | ADN Capital`,
    description: product.outcome,
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const product = PUBLIC_PRODUCT_MODULES.find((module) => module.slug === slug);

  if (!product) {
    notFound();
  }

  const productName = product.shortName ?? product.name;

  return (
    <main className={`${publicBodyFont.variable} ${publicSerifFont.variable} ${publicBodyFont.className} adn-public-type min-h-screen`}>
      <PublicSiteHeader />

      <section
        className="relative overflow-hidden px-5 py-20 sm:px-8 lg:px-12 xl:px-16"
        style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(circle_at_18%_8%,color-mix(in_srgb,var(--primary)_18%,transparent),transparent_28%),radial-gradient(circle_at_78%_18%,rgba(255,255,255,0.08),transparent_24%)]" />
        <div className="relative mx-auto grid max-w-[1560px] gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="animate-adn-rise">
            <p className="text-xs font-black uppercase tracking-[0.24em]" style={{ color: "var(--primary)" }}>
              {productName}
            </p>
            <h1 className="mt-5 text-[clamp(3.2rem,7vw,8rem)] font-black leading-[1.15] tracking-tight">
              {product.outcome}
            </h1>
            <p className="mt-7 max-w-2xl text-xl font-normal leading-[1.7]" style={{ color: "var(--text-secondary)" }}>
              {product.tagline}
            </p>

            <div className="mt-8 grid gap-3">
              {product.bullets.map((bullet) => (
                <div key={bullet} className="flex items-start gap-3 text-base font-normal leading-7" style={{ color: "var(--text-secondary)" }}>
                  <CheckCircle2 className="mt-1 h-5 w-5 shrink-0" style={{ color: "var(--primary)" }} />
                  <span>{bullet}</span>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                href={product.route}
                className="inline-flex items-center gap-2 rounded-full px-6 py-4 text-sm font-black"
                style={{ background: "var(--primary)", color: "var(--on-primary)" }}
              >
                Trải nghiệm {productName} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/products"
                className="inline-flex items-center gap-2 rounded-full border px-6 py-4 text-sm font-black"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              >
                Xem công cụ khác <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="animate-adn-rise rounded-[2.4rem] border p-4" style={{ borderColor: "var(--border-strong)", background: "var(--bg-elevated)" }}>
            <div className="relative min-h-[440px] overflow-hidden rounded-[1.8rem] border" style={{ borderColor: "var(--border)", background: "#090B0F" }}>
              <ProductDemoImage
                src={product.demoImage}
                alt={`Ảnh demo ${productName}`}
                productName={productName}
                sizes="(min-width: 1024px) 54vw, 100vw"
                className="object-cover object-top"
                priority
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,10,0.02),rgba(5,7,10,0.1)_52%,rgba(5,7,10,0.72))]" />
              <div className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full border border-white/30 bg-black/55 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-[var(--primary)] backdrop-blur">
                <Sparkles className="h-4 w-4" /> Ảnh demo thật
              </div>
              <div className="absolute inset-x-5 bottom-5 rounded-2xl border border-white/15 bg-black/70 p-5 backdrop-blur-md">
                <p className="text-sm font-normal leading-7 text-white/88">
                  Ảnh demo chỉ giúp anh/chị hiểu cách công cụ hoạt động. Dữ liệu đầy đủ, thao tác thật và quyền sử dụng
                  nằm trong khu vực đăng nhập theo gói đang còn hạn.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-14 sm:px-8 lg:px-12 xl:px-16" style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}>
        <div className="mx-auto grid max-w-[1500px] gap-5 md:grid-cols-3">
          {[
            ["Dùng để nhìn rõ vấn đề", "Mỗi công cụ chỉ tập trung vào một việc, giúp anh/chị bớt bị nhiễu khi thị trường chạy nhanh."],
            ["Không thay anh/chị quyết định", "ADN cung cấp dữ liệu, nhịp theo dõi và cảnh báo rủi ro. Quyết định cuối cùng vẫn thuộc về anh/chị."],
            ["Nên dùng cùng nhật ký", "ADN Diary giúp ghi lại lý do mua bán để biết mình đang tiến bộ hay chỉ đang phản ứng theo cảm xúc."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-[1.6rem] border p-6" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
              <p className="text-lg font-black">{title}</p>
              <p className="mt-3 text-sm font-normal leading-7" style={{ color: "var(--text-secondary)" }}>
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <PublicSiteFooter />
    </main>
  );
}

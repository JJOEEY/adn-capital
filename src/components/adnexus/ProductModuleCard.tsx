import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ProductModule } from "@/lib/brand/nexsuite";
import { ProductDemoImage } from "./ProductDemoImage";

export function ProductModuleCard({ product, hrefPrefix = "/products" }: { product: ProductModule; hrefPrefix?: string }) {
  const href = `${hrefPrefix}/${product.slug}`;
  const image = product.demoImage ?? "/hero-showcase/app-adn-pulse-real.png";

  return (
    <Link
      href={href}
      className="group grid overflow-hidden rounded-[2.2rem] border transition duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/15 lg:grid-cols-[0.86fr_1.14fr]"
      style={{ background: "var(--bg-surface)", borderColor: "var(--border-strong)" }}
    >
      <div className="flex min-h-[360px] flex-col justify-between p-6 sm:p-8">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className="rounded-full border px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em]"
              style={{ borderColor: "var(--border)", color: "var(--primary)" }}
            >
              Bản giới thiệu
            </span>
            <span className="text-xs font-bold uppercase tracking-[0.24em]" style={{ color: "var(--text-muted)" }}>
              {product.pillar}
            </span>
          </div>

          <h3
            className="mt-7 text-[clamp(2.1rem,3vw,3.6rem)] font-black leading-[1.15] tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {product.shortName ?? product.name}
          </h3>
          <p className="mt-4 text-lg font-normal leading-8" style={{ color: "var(--text-secondary)" }}>
            {product.outcome}
          </p>
          <p className="mt-5 text-base font-normal leading-8" style={{ color: "var(--text-muted)" }}>
            {product.tagline}
          </p>
        </div>

        <div className="mt-8">
          <div className="grid gap-2">
            {product.bullets.slice(0, 3).map((bullet) => (
              <p key={bullet} className="text-sm font-normal leading-6" style={{ color: "var(--text-secondary)" }}>
                {bullet}
              </p>
            ))}
          </div>
          <div
            className="mt-6 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-black"
            style={{ background: "var(--primary)", color: "var(--on-primary)" }}
          >
            Xem giới thiệu <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </div>
        </div>
      </div>

      <div
        className="relative min-h-[360px] overflow-hidden border-t lg:min-h-[460px] lg:border-l lg:border-t-0"
        style={{ borderColor: "var(--border)", background: "#090B0F" }}
      >
        <ProductDemoImage
          src={image}
          alt={`Ảnh demo ${product.shortName ?? product.name}`}
          productName={product.shortName ?? product.name}
          sizes="(min-width: 1024px) 52vw, 100vw"
          className="object-cover object-top transition duration-700 group-hover:scale-[1.025]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,10,0.02),rgba(5,7,10,0.18)_46%,rgba(5,7,10,0.82))]" />
        <div className="absolute left-5 top-5 rounded-full border border-white/30 bg-black/55 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-[var(--primary)] backdrop-blur">
          Ảnh demo sản phẩm
        </div>
        <div className="absolute inset-x-5 bottom-5 rounded-2xl border border-white/15 bg-black/70 p-5 backdrop-blur-md">
          <p className="text-sm font-normal leading-7 text-white/88">
            Ảnh demo dựa trên giao diện thật, chỉ để anh/chị hình dung cách công cụ hoạt động. Dữ liệu đầy đủ và thao tác thật nằm trong khu vực đăng nhập.
          </p>
        </div>
      </div>
    </Link>
  );
}

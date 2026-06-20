/**
 * /products/[slug] — product detail, restyled to the marketing design.
 * DATA + ROUTING PRESERVED: catalog = PUBLIC_PRODUCT_MODULES, generateStaticParams,
 * generateMetadata, notFound(), primary CTA -> product.route (real tool).
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowUpRight, Check, Activity, Bot, Radar, BarChart3, Gauge, NotebookPen, type LucideIcon } from "lucide-react";
import { Shell, Reveal, Frame } from "@/components/marketing/theme";
import { PUBLIC_PRODUCT_MODULES } from "@/lib/brand/nexsuite";

type PageProps = { params: Promise<{ slug: string }> };

const META: Record<string, { icon: LucideIcon; kicker: string }> = {
  "adn-pulse": { icon: Activity, kicker: "Toàn cảnh" },
  "adn-stock": { icon: Bot, kicker: "Tra cứu cùng AIDEN" },
  "adn-radar": { icon: Radar, kicker: "Bản đồ tín hiệu" },
  "adn-rank": { icon: BarChart3, kicker: "Xếp hạng" },
  "adn-art": { icon: Gauge, kicker: "Chỉ báo" },
  "adn-diary": { icon: NotebookPen, kicker: "Nhật ký" },
};
const iconFor = (slug: string): LucideIcon => META[slug]?.icon ?? Activity;
const kickerFor = (slug: string) => META[slug]?.kicker ?? "Công cụ";

export function generateStaticParams() {
  return PUBLIC_PRODUCT_MODULES.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = PUBLIC_PRODUCT_MODULES.find((module) => module.slug === slug);
  if (!product) return { title: "Không tìm thấy công cụ" };
  return { title: `${product.shortName ?? product.name} | ADN Capital`, description: product.outcome };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const product = PUBLIC_PRODUCT_MODULES.find((module) => module.slug === slug);
  if (!product) notFound();

  const productName = product.shortName ?? product.name;
  const Icon = iconFor(slug);
  const related = PUBLIC_PRODUCT_MODULES.filter((m) => m.slug !== slug).slice(0, 3);

  return (
    <Shell>
      {/* ── hero ── */}
      <section className="relative overflow-hidden border-b border-[var(--hairline)]">
        <div className="mx-auto max-w-[1180px] px-5 pb-16 pt-12 sm:px-8 lg:pb-20 lg:pt-16">
          <Reveal>
            <a href="/products" className="dp-mono inline-flex items-center gap-1.5 text-[12px] uppercase tracking-[0.14em] text-[var(--ink-faint)] transition-colors hover:text-[var(--moss)]">
              <span aria-hidden>←</span> Công cụ
            </a>
          </Reveal>
          <div className="mt-7 grid items-center gap-x-12 gap-y-10 lg:grid-cols-12">
            <div className="min-w-0 lg:col-span-6">
              <Reveal>
                <span className="inline-flex items-center gap-2 rounded-full bg-[var(--mint)] px-3.5 py-1.5">
                  <Icon className="h-4 w-4 text-[var(--moss)]" strokeWidth={1.75} />
                  <span className="dp-mono text-[11.5px] font-semibold uppercase tracking-[0.16em] text-[var(--moss)]">{kickerFor(slug)}</span>
                </span>
              </Reveal>
              <Reveal delay={0.05}>
                <h1 className="dp-display mt-5 text-[clamp(2.6rem,4.8vw,4rem)] font-bold leading-[1.04] tracking-[-0.015em]">{productName}</h1>
              </Reveal>
              <Reveal delay={0.1}>
                <p className="dp-display mt-3 text-[clamp(1.3rem,2.4vw,1.7rem)] font-medium italic text-[var(--gold)]">{product.outcome}</p>
              </Reveal>
              <Reveal delay={0.14}>
                <p className="mt-6 max-w-[48ch] text-[17px] font-light leading-[1.6] text-[var(--ink-muted)]">{product.tagline}</p>
              </Reveal>
              <Reveal delay={0.16}>
                <ul className="mt-6 space-y-2.5">
                  {product.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2.5 text-[15px] text-[var(--ink)]">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--moss)]" strokeWidth={2.5} /> {b}
                    </li>
                  ))}
                </ul>
              </Reveal>
              <Reveal delay={0.2}>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <a href={product.route} className="dp-btn dp-btn-solid dp-btn-lg">Trải nghiệm {productName} <ArrowRight className="h-4 w-4" strokeWidth={1.75} /></a>
                  <a href="/auth?mode=register" className="dp-btn dp-btn-ghost dp-btn-lg">Mở tài khoản miễn phí</a>
                </div>
              </Reveal>
            </div>
            <Reveal delay={0.12} className="min-w-0 lg:col-span-6">
              {product.demoImage ? (
                <Frame src={product.demoImage} alt={productName} ratio="1.7" eager />
              ) : (
                <div className="dp-frame flex items-center justify-center bg-[var(--mint)]" style={{ aspectRatio: "1.7" }}>
                  <Icon className="h-20 w-20 text-[var(--moss)]" strokeWidth={1.25} />
                </div>
              )}
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── related ── */}
      <section className="border-b border-[var(--hairline)] bg-[var(--cream)]">
        <div className="mx-auto max-w-[1180px] px-5 py-20 sm:px-8 lg:py-24">
          <Reveal>
            <h2 className="dp-display text-[clamp(1.7rem,3.2vw,2.4rem)] font-bold leading-[1.1] tracking-[-0.015em]">Công cụ <span className="italic text-[var(--gold)]">đi cùng.</span></h2>
          </Reveal>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {related.map((r, i) => {
              const RIcon = iconFor(r.slug);
              return (
                <Reveal key={r.slug} delay={i * 0.07}>
                  <a href={`/products/${r.slug}`} className="dp-tool group flex h-full flex-col rounded-[16px] border border-[var(--hairline)] bg-[var(--surface)] p-6">
                    <div className="flex items-start justify-between">
                      <span className="grid h-11 w-11 place-items-center rounded-[12px] bg-[var(--mint)] text-[var(--moss)]"><RIcon className="h-5 w-5" strokeWidth={1.6} /></span>
                      <ArrowUpRight className="h-5 w-5 text-[var(--ink-faint)] transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--moss)]" strokeWidth={1.75} />
                    </div>
                    <h3 className="dp-display mt-5 text-[19px] font-semibold tracking-tight">{r.shortName ?? r.name}</h3>
                    <p className="mt-2 text-[14px] font-light leading-[1.5] text-[var(--ink-muted)]">{r.outcome}</p>
                  </a>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── cta ── */}
      <section>
        <div className="mx-auto max-w-[1180px] px-5 py-24 sm:px-8">
          <Reveal>
            <div className="dp-cta relative overflow-hidden rounded-[28px] px-8 py-20 text-center sm:px-16">
              <h2 className="dp-display mx-auto max-w-[20ch] text-[clamp(2rem,4.2vw,3.2rem)] font-bold leading-[1.06] tracking-[-0.02em] text-[var(--cream)]">
                Đừng vội tin. <span className="italic text-[var(--gold)]">Thử một phiên đi.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-[46ch] text-[17px] font-light leading-[1.55] text-white/75">Mở tài khoản không mất phí, dùng {productName} cùng cả bộ công cụ trong vài phiên rồi tự thấy có hợp hay không.</p>
              <a href="/auth?mode=register" className="dp-btn dp-btn-on-dark dp-btn-lg mt-9">Mở tài khoản ADN <ArrowRight className="h-4 w-4" strokeWidth={1.75} /></a>
            </div>
          </Reveal>
        </div>
      </section>
    </Shell>
  );
}

/**
 * /products — tool catalog index, restyled to the marketing design.
 * DATA PRESERVED: catalog = PUBLIC_PRODUCT_MODULES (each card -> /products/{slug}).
 */

import type { Metadata } from "next";
import { ArrowRight, ArrowUpRight, Activity, Bot, Radar, BarChart3, Gauge, NotebookPen, type LucideIcon } from "lucide-react";
import { Shell, Reveal } from "@/components/marketing/theme";
import { PUBLIC_PRODUCT_MODULES } from "@/lib/brand/nexsuite";

export const metadata: Metadata = {
  title: "Công cụ ADN Capital",
  description: "Danh sách công cụ ADN Capital dành cho nhà đầu tư Việt Nam.",
};

const ICONS: Record<string, LucideIcon> = {
  "adn-pulse": Activity,
  "adn-stock": Bot,
  "adn-radar": Radar,
  "adn-rank": BarChart3,
  "adn-art": Gauge,
  "adn-diary": NotebookPen,
};

export default function ProductsPage() {
  return (
    <Shell>
      {/* ── hero ── */}
      <section className="relative overflow-hidden border-b border-[var(--hairline)]">
        <div className="mx-auto max-w-[1180px] px-5 pb-12 pt-16 sm:px-8 lg:pt-20">
          <Reveal>
            <p className="dp-mono text-[12px] font-semibold uppercase tracking-[0.2em] text-[var(--gold)]">Bộ công cụ</p>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="dp-display mt-5 max-w-[20ch] text-[clamp(2.5rem,5vw,4rem)] font-bold leading-[1.04] tracking-[-0.02em]">
              Mỗi công cụ giải một <span className="italic text-[var(--gold)]">việc cụ thể.</span>
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 max-w-[58ch] text-[18px] font-light leading-[1.6] text-[var(--ink-muted)]">
              Không cần mở tất cả cùng lúc. Bắt đầu từ việc đang cần: đọc thị trường, lọc cổ phiếu, theo dõi tín hiệu, tra cứu từng mã hay ghi lại quyết định của chính mình.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── grid ── */}
      <section className="border-b border-[var(--hairline)] bg-[var(--cream)]">
        <div className="mx-auto max-w-[1180px] px-5 py-20 sm:px-8 lg:py-24">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {PUBLIC_PRODUCT_MODULES.map((p, i) => {
              const Icon = ICONS[p.slug] ?? Activity;
              const name = p.shortName ?? p.name;
              return (
                <Reveal key={p.slug} delay={i * 0.06}>
                  <a href={`/products/${p.slug}`} className="dp-tool group flex h-full flex-col rounded-[16px] border border-[var(--hairline)] bg-[var(--surface)] p-6">
                    <div className="flex items-start justify-between">
                      <span className="grid h-11 w-11 place-items-center rounded-[12px] bg-[var(--mint)] text-[var(--moss)]"><Icon className="h-5 w-5" strokeWidth={1.6} /></span>
                      <ArrowUpRight className="h-5 w-5 text-[var(--ink-faint)] transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--moss)]" strokeWidth={1.75} />
                    </div>
                    <h2 className="dp-display mt-5 text-[20px] font-semibold tracking-tight">{name}</h2>
                    <p className="mt-2 text-[14.5px] font-light leading-[1.55] text-[var(--ink-muted)]">{p.outcome}</p>
                    <ul className="mt-4 space-y-1.5">
                      {p.bullets.slice(0, 3).map((b) => (
                        <li key={b} className="dp-mono text-[12px] uppercase tracking-[0.06em] text-[var(--ink-faint)]">— {b}</li>
                      ))}
                    </ul>
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
                Bắt đầu từ <span className="italic text-[var(--gold)]">phong cách của bạn.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-[44ch] text-[17px] font-light leading-[1.55] text-white/75">Làm bài test một phút để biết hợp công cụ nào, rồi mở tài khoản dùng thử miễn phí.</p>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                <a href="/#quiz" className="dp-btn dp-btn-on-dark dp-btn-lg">Làm bài test phong cách <ArrowRight className="h-4 w-4" strokeWidth={1.75} /></a>
                <a href="/auth?mode=register" className="dp-btn dp-btn-lg border border-white/30 text-[var(--cream)] hover:bg-white/10">Mở tài khoản</a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </Shell>
  );
}

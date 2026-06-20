/**
 * /design-preview/contact — Liên hệ ADN. Contact methods + form (ContactForm island).
 */

import { Mail, MessageCircle, Clock, ArrowUpRight } from "lucide-react";
import { Shell, Reveal } from "../theme";
import { ContactForm } from "../ContactForm";

const METHODS = [
  { icon: Mail, label: "Email", value: "support@adncapital.com.vn", href: "mailto:support@adncapital.com.vn" },
  { icon: MessageCircle, label: "Chat trực tiếp", value: "Zalo · Telegram · Facebook", href: "#" },
  { icon: Clock, label: "Giờ hỗ trợ", value: "8:00 đến 17:00, Thứ Hai đến Thứ Sáu", href: null },
];

export default function ContactPage() {
  return (
    <Shell>
      {/* ── hero ── */}
      <section className="border-b border-[var(--hairline)]">
        <div className="mx-auto max-w-[1180px] px-5 pb-12 pt-16 sm:px-8 lg:pt-20">
          <Reveal>
            <p className="dp-mono text-[12px] font-semibold uppercase tracking-[0.2em] text-[var(--gold)]">Liên hệ</p>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="dp-display mt-5 max-w-[18ch] text-[clamp(2.5rem,5vw,4rem)] font-bold leading-[1.04] tracking-[-0.02em]">
              Cần hỗ trợ? <span className="italic text-[var(--gold)]">ADN ở đây.</span>
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 max-w-[52ch] text-[18px] font-light leading-[1.6] text-[var(--ink-muted)]">
              Câu hỏi về gói, về công cụ, hay cần tư vấn phong cách đầu tư: cứ để lại lời nhắn, ADN sẽ liên hệ lại sớm.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── methods + form ── */}
      <section className="border-b border-[var(--hairline)] bg-[var(--cream)]">
        <div className="mx-auto grid max-w-[1180px] gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:py-24">
          <Reveal className="min-w-0">
            <h2 className="dp-display text-[clamp(1.7rem,3.2vw,2.3rem)] font-bold leading-[1.1] tracking-[-0.015em]">Cách nhanh nhất.</h2>
            <div className="mt-8 space-y-4">
              {METHODS.map((m) => {
                const Icon = m.icon;
                const inner = (
                  <>
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-[var(--mint)] text-[var(--moss)]">
                      <Icon className="h-5 w-5" strokeWidth={1.6} />
                    </span>
                    <span className="min-w-0">
                      <span className="dp-mono block text-[11.5px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]">{m.label}</span>
                      <span className="mt-0.5 block text-[16px] font-medium">{m.value}</span>
                    </span>
                    {m.href && <ArrowUpRight className="ml-auto h-5 w-5 shrink-0 text-[var(--ink-faint)] transition-colors group-hover:text-[var(--moss)]" strokeWidth={1.75} />}
                  </>
                );
                return m.href ? (
                  <a key={m.label} href={m.href} className="dp-panel group flex items-center gap-4 p-5 transition-colors hover:border-[var(--moss)]">{inner}</a>
                ) : (
                  <div key={m.label} className="dp-panel flex items-center gap-4 p-5">{inner}</div>
                );
              })}
            </div>
          </Reveal>
          <Reveal delay={0.08} className="min-w-0">
            <ContactForm />
          </Reveal>
        </div>
      </section>

      {/* ── cta ── */}
      <section>
        <div className="mx-auto max-w-[1180px] px-5 py-24 sm:px-8">
          <Reveal>
            <div className="dp-cta relative overflow-hidden rounded-[28px] px-8 py-20 text-center sm:px-16">
              <h2 className="dp-display mx-auto max-w-[20ch] text-[clamp(2rem,4.2vw,3.2rem)] font-bold leading-[1.06] tracking-[-0.02em] text-[var(--cream)]">
                Hoặc cứ <span className="italic text-[var(--gold)]">thử một phiên.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-[44ch] text-[17px] font-light leading-[1.55] text-white/75">Mở tài khoản miễn phí, dùng thử công cụ rồi nhắn ADN nếu có gì chưa rõ.</p>
              <a href="/design-preview/auth?mode=register" className="dp-btn dp-btn-on-dark dp-btn-lg mt-9">Mở tài khoản miễn phí</a>
            </div>
          </Reveal>
        </div>
      </section>
    </Shell>
  );
}

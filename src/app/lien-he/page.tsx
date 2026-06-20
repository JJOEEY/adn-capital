/**
 * /lien-he — Liên hệ ADN Capital. Kênh liên hệ thật (điện thoại / Zalo / địa chỉ).
 * Chưa nối form backend nên không dùng form demo; khi nối email/endpoint sẽ thêm lại.
 */

import { Phone, MessageCircle, MapPin, Clock, ArrowUpRight, ArrowRight } from "lucide-react";
import { Shell, Reveal } from "@/components/marketing/theme";

const METHODS = [
  { icon: Phone, label: "Điện thoại", value: "0962 977 179", href: "tel:0962977179" },
  { icon: MessageCircle, label: "Zalo", value: "Zalo ADN Capital", href: "https://zalo.me/0962977179" },
  { icon: MapPin, label: "Văn phòng", value: "62 Hoàng Thế Thiện, P. An Khánh, TP. Hồ Chí Minh", href: null },
  { icon: Clock, label: "Giờ làm việc", value: "8:00 đến 17:00, Thứ Hai đến Thứ Sáu", href: null },
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
              Câu hỏi về gói, về công cụ, hay cần tư vấn phong cách đầu tư: gọi trực tiếp hoặc nhắn Zalo, ADN trả lời trong giờ làm việc.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── methods ── */}
      <section className="border-b border-[var(--hairline)] bg-[var(--cream)]">
        <div className="mx-auto max-w-[1180px] px-5 py-20 sm:px-8 lg:py-24">
          <Reveal>
            <h2 className="dp-display text-[clamp(1.7rem,3.2vw,2.3rem)] font-bold leading-[1.1] tracking-[-0.015em]">Cách nhanh nhất.</h2>
          </Reveal>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {METHODS.map((m, i) => {
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
              return (
                <Reveal key={m.label} delay={i * 0.06} className="min-w-0">
                  {m.href ? (
                    <a href={m.href} target={m.href.startsWith("http") ? "_blank" : undefined} rel={m.href.startsWith("http") ? "noopener noreferrer" : undefined} className="dp-panel group flex h-full items-center gap-4 p-5 transition-colors hover:border-[var(--moss)]">{inner}</a>
                  ) : (
                    <div className="dp-panel flex h-full items-center gap-4 p-5">{inner}</div>
                  )}
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
                Hoặc cứ <span className="italic text-[var(--gold)]">thử một phiên.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-[44ch] text-[17px] font-light leading-[1.55] text-white/75">Mở tài khoản miễn phí, dùng thử công cụ rồi gọi ADN nếu có gì chưa rõ.</p>
              <a href="/auth?mode=register" className="dp-btn dp-btn-on-dark dp-btn-lg mt-9">Mở tài khoản miễn phí <ArrowRight className="h-4 w-4" strokeWidth={1.75} /></a>
            </div>
          </Reveal>
        </div>
      </section>
    </Shell>
  );
}

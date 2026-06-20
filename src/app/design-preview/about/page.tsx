/**
 * /design-preview/about — Giới thiệu ADN Capital. Same warm-editorial UX (Shell/theme).
 */

import { ArrowRight, Compass, Activity, ShieldCheck } from "lucide-react";
import { Shell, Reveal, Frame } from "../theme";

const METHOD = [
  { icon: Compass, title: "Bắt đầu từ phong cách của bạn", desc: "Làm bài test một phút để biết bạn hợp nắm giữ theo doanh nghiệp, giao dịch theo nhịp hay cần một lộ trình, rồi mới chọn công cụ." },
  { icon: Activity, title: "Dữ liệu thật, không tin đồn", desc: "ADN quét toàn sàn mỗi phiên và phân tích trên số liệu thị trường thật, thay cho việc nghe room hô hào hay phím hàng." },
  { icon: ShieldCheck, title: "Tín hiệu có kỷ luật", desc: "Mỗi tín hiệu kèm điểm vào, mục tiêu và mức cắt lỗ; cộng nhật ký giao dịch để bạn nhìn lại mình thường sai ở đâu." },
];

const TOOLS = [
  { name: "AIDEN", href: "/design-preview/products/aiden" },
  { name: "ADN Radar", href: "/design-preview/products/radar" },
  { name: "Chỉ báo ART", href: "/design-preview/products/art" },
  { name: "Cổ phiếu & RS", href: "/design-preview/products/co-phieu" },
  { name: "Xếp hạng RANK", href: "/design-preview/products/rank" },
  { name: "Nhịp thị trường", href: "/design-preview/products/pulse" },
];

export default function AboutPage() {
  return (
    <Shell>
      {/* ── hero ── */}
      <section className="relative overflow-hidden border-b border-[var(--hairline)]">
        <div className="mx-auto max-w-[1180px] px-5 pb-16 pt-16 sm:px-8 lg:pb-20 lg:pt-20">
          <Reveal>
            <p className="dp-mono text-[12px] font-semibold uppercase tracking-[0.2em] text-[var(--gold)]">Về ADN Capital</p>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="dp-display mt-5 max-w-[20ch] text-[clamp(2.5rem,5vw,4rem)] font-bold leading-[1.04] tracking-[-0.02em]">
              Đầu tư là quyết định của bạn. ADN lo phần <span className="italic text-[var(--gold)]">dữ liệu</span>.
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 max-w-[58ch] text-[18px] font-light leading-[1.6] text-[var(--ink-muted)]">
              ADN Capital xây bộ công cụ để nhà đầu tư cá nhân Việt Nam tự đọc thị trường bằng dữ liệu, thay vì phụ thuộc vào tin đồn.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── story + screenshot ── */}
      <section className="border-b border-[var(--hairline)] bg-[var(--cream)]">
        <div className="mx-auto grid max-w-[1180px] items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:py-24">
          <Reveal className="min-w-0">
            <h2 className="dp-display max-w-[16ch] text-[clamp(1.9rem,3.6vw,2.7rem)] font-bold leading-[1.1] tracking-[-0.015em]">
              Vì sao có <span className="italic text-[var(--gold)]">ADN.</span>
            </h2>
            <p className="mt-6 max-w-[52ch] text-[16.5px] font-light leading-[1.65] text-[var(--ink-muted)]">
              Phần lớn người mới vào chứng khoán không thiếu mã để mua. Thứ họ thiếu là một khung quan sát của riêng mình: giữ bao lâu, chịu lỗ tới đâu, theo dõi thị trường bằng cái gì. Chưa có khung đó thì rất dễ trôi theo room hô hào và phím hàng.
            </p>
            <p className="mt-4 max-w-[52ch] text-[16.5px] font-light leading-[1.65] text-[var(--ink-muted)]">
              ADN ra đời để lấp đúng khoảng trống đó. Chúng tôi không đưa bạn một danh sách mã, mà đưa dữ liệu toàn thị trường, công cụ phân tích và một lộ trình có kỷ luật, để mỗi quyết định mua bán đều có cơ sở.
            </p>
          </Reveal>
          <Reveal delay={0.08} className="min-w-0">
            <Frame src="/hero-showcase/app-adn-pulse-real.png" alt="Bảng điều khiển ADN" ratio="1.7" eager />
          </Reveal>
        </div>
      </section>

      {/* ── method ── */}
      <section className="border-b border-[var(--hairline)]">
        <div className="mx-auto max-w-[1180px] px-5 py-20 sm:px-8 lg:py-24">
          <Reveal>
            <h2 className="dp-display max-w-[20ch] text-[clamp(1.9rem,3.6vw,2.7rem)] font-bold leading-[1.1] tracking-[-0.015em]">
              Cách ADN <span className="italic text-[var(--gold)]">làm việc.</span>
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-x-10 gap-y-10 md:grid-cols-3">
            {METHOD.map((m, i) => {
              const Icon = m.icon;
              return (
                <Reveal key={m.title} delay={i * 0.08}>
                  <div className="border-t border-[var(--gold)] pt-5">
                    <Icon className="h-6 w-6 text-[var(--moss)]" strokeWidth={1.6} />
                    <h3 className="dp-display mt-4 text-[21px] font-semibold tracking-[-0.01em]">{m.title}</h3>
                    <p className="mt-2.5 max-w-[36ch] text-[15px] font-light leading-[1.6] text-[var(--ink-muted)]">{m.desc}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── tools recap ── */}
      <section className="border-b border-[var(--hairline)] bg-[var(--cream)]">
        <div className="mx-auto max-w-[1180px] px-5 py-16 sm:px-8 lg:py-20">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="dp-display text-[clamp(1.7rem,3.2vw,2.3rem)] font-bold leading-[1.1] tracking-[-0.015em]">Bộ công cụ đứng sau.</h2>
              <a href="/design-preview#features" className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-[var(--moss)]">Xem tất cả <ArrowRight className="h-4 w-4" strokeWidth={2} /></a>
            </div>
          </Reveal>
          <Reveal delay={0.06}>
            <div className="mt-7 flex flex-wrap gap-3">
              {TOOLS.map((t) => (
                <a key={t.name} href={t.href} className="rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-4 py-2 text-[14.5px] font-medium transition-colors hover:border-[var(--moss)] hover:text-[var(--moss)]">{t.name}</a>
              ))}
            </div>
          </Reveal>
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
              <p className="mx-auto mt-5 max-w-[44ch] text-[17px] font-light leading-[1.55] text-white/75">Làm bài test một phút để biết bạn hợp gói nào và công cụ nào, rồi mở tài khoản dùng thử miễn phí.</p>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                <a href="/design-preview#quiz" className="dp-btn dp-btn-on-dark dp-btn-lg">Làm bài test phong cách <ArrowRight className="h-4 w-4" strokeWidth={1.75} /></a>
                <a href="/design-preview/auth?mode=register" className="dp-btn dp-btn-lg border border-white/30 text-[var(--cream)] hover:bg-white/10">Mở tài khoản</a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </Shell>
  );
}

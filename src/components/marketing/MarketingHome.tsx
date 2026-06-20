/**
 * Marketing homepage (/) — warm editorial UX (inspired by the
 * 9bizclaw.com reference the user liked): cream/paper canvas, Playfair Display serif
 * headlines + Be Vietnam Pro body + JetBrains Mono labels, moss brand + gold accent.
 * Hero centerpiece = an animated "GIF-like" dashboard (window-chrome frame auto-cycling
 * REAL ADN product screenshots, pure CSS). Structure kept (per user) + a values section
 * and the investor quiz as its own section.
 * Data = real snapshot from prod (adncapital.com.vn), 2026-06-20 15:30.
 * Server component + CSS only; Quiz is an isolated client island.
 */

import { ArrowRight, ArrowUpRight, Check, TrendingUp, BarChart3, Wallet, Radar, Compass, Activity, ShieldCheck } from "lucide-react";
import { Quiz } from "./Quiz";
import { Shell, Reveal, Frame, vnum } from "./theme";

/* ───────────── real data snapshot (prod, 2026-06-20 15:30) ───────────── */

const MARKET = {
  vnindex: 1824.53,
  changePct: -0.32,
  macroScore: 9.5,
  liquidity: "15,4K",
  breadth: { up: 84, down: 205 },
  topSectors: [
    { name: "Ngân hàng", rs: 73.5 },
    { name: "Cao su", rs: 69 },
    { name: "Năng lượng", rs: 61.3 },
  ],
};

const DASH = [
  { src: "/hero-showcase/app-adn-pulse-real.png", label: "Nhịp thị trường" },
  { src: "/hero-showcase/app-adn-radar-real.png", label: "Bản đồ tín hiệu" },
  { src: "/hero-showcase/app-adn-art-real.png", label: "Chỉ báo ART" },
  { src: "/hero-showcase/app-adn-stock-real.png", label: "Cổ phiếu & RS" },
];

const VALUES = [
  { icon: Compass, title: "Biết mình hợp kiểu gì đã", desc: "Làm bài test phong cách trước. Hợp nắm giữ hay hợp lướt sóng thì hãy chọn công cụ, đừng làm ngược lại." },
  { icon: Activity, title: "Quét hết mã mỗi phiên", desc: "ADN rà toàn bộ HOSE và HNX sau mỗi phiên, chấm điểm dòng tiền từng ngành, không sót mã nào." },
  { icon: ShieldCheck, title: "Có điểm vào, có cắt lỗ", desc: "Mỗi tín hiệu đi kèm vùng mua, mục tiêu và mức cắt lỗ cụ thể, không phải kiểu cứ ôm là thắng." },
];

const FEATURES = [
  {
    kicker: "Trợ lý AI",
    title: "Hỏi một mã, AIDEN phân tích ngay.",
    desc: "AIDEN đọc dữ liệu thật rồi đưa nhận định thẳng, có dẫn chứng. Hỏi đáp tự do qua webchat, hoặc xem báo cáo chuẩn hoá ngay trong trang một mã ở ADN Stock.",
    bullets: ["Webchat hỏi đáp tự do", "Báo cáo theo mã trong ADN Stock", "Số liệu thật, không bịa"],
    href: "/products/adn-stock",
    img: "/hero-showcase/app-aiden.png",
    flip: false,
  },
  {
    kicker: "Điểm đảo chiều",
    title: "Nhận ra lúc xu hướng sắp đuối.",
    desc: "Chỉ báo ART chấm mức cạn kiệt của xu hướng trên thước 0 đến 5, để bạn thấy vùng đảo chiều trước khi giá quay đầu, thay vì mua đúng đỉnh.",
    bullets: ["Thước đo 0 đến 5 điểm", "Vùng đảo chiều của trend", "Áp dụng cho mọi mã"],
    href: "/products/adn-art",
    img: "/hero-showcase/app-adn-art-real.png",
    flip: true,
  },
];

const TOOLS = [
  { icon: Radar, title: "ADN Radar", desc: "Bản đồ tín hiệu cả thị trường, mã nào Mua mã nào Bán.", href: "/products/adn-radar", img: "/hero-showcase/app-adn-radar-real.png" },
  { icon: TrendingUp, title: "Xếp hạng RANK", desc: "Xếp cổ phiếu theo sức mạnh tương đối, thấy ngay nhóm dẫn dắt.", href: "/products/adn-rank", img: "/hero-showcase/app-adn-rank-real.png" },
  { icon: BarChart3, title: "Cổ phiếu & RS", desc: "Tra cứu từng mã với sức mạnh tương đối và dòng tiền.", href: "/products/adn-stock", img: "/hero-showcase/app-adn-stock-real.png" },
  { icon: Wallet, title: "Ký quỹ Margin", desc: "Đòn bẩy linh hoạt, lãi suất từ 5,99% một năm, minh bạch.", href: "/margin", img: null },
];

const STEPS = [
  { title: "Đăng ký", desc: "Mở tài khoản chứng khoán miễn phí qua link giới thiệu, nhận ưu đãi tới 40%." },
  { title: "Kết nối", desc: "Đăng nhập bằng Google, hệ thống tự kích hoạt gói VIP 7 ngày." },
  { title: "Theo dõi", desc: "Nhận tín hiệu Mua / Bán và dùng trọn bộ công cụ phân tích." },
];

/* ───────────── page ───────────── */

export function MarketingHome() {
  const b = MARKET.breadth;
  const down = MARKET.changePct < 0;

  return (
    <Shell>
      {/* ── hero (copy + animated dashboard) ── */}
      <section id="top" className="relative overflow-hidden">
        <div className="dp-hero-grid mx-auto grid max-w-[1180px] items-center gap-x-12 gap-y-12 px-5 pb-20 pt-14 sm:px-8 lg:pb-28 lg:pt-20">
          <div className="min-w-0 lg:col-span-5">
            <Reveal>
              <p className="dp-mono text-[12px] font-semibold uppercase tracking-[0.2em] text-[var(--gold)]">Cho nhà đầu tư chứng khoán Việt Nam</p>
            </Reveal>
            <Reveal delay={0.05}>
              <h1 className="dp-display mt-5 text-[clamp(2.6rem,4.6vw,4rem)] font-bold leading-[1.05] tracking-[-0.015em]">
                Cả thị trường, gọn trong <span className="italic text-[var(--gold)]">một màn hình.</span>
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-6 max-w-[44ch] text-[18px] font-light leading-[1.55] text-[var(--ink-muted)]">
                ADN quét toàn sàn sau mỗi phiên, chỉ ra mã nào đang có tín hiệu mua hay bán, kèm dòng tiền từng ngành và nhịp chung của thị trường.
              </p>
            </Reveal>
            <Reveal delay={0.15}>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <a href="/auth?mode=register" className="dp-btn dp-btn-solid dp-btn-lg">Mở tài khoản miễn phí <ArrowRight className="h-4 w-4" strokeWidth={1.75} /></a>
                <a href="#quiz" className="dp-btn dp-btn-ghost dp-btn-lg">Làm bài test phong cách</a>
              </div>
            </Reveal>
          </div>

          {/* animated dashboard = the "GIF" */}
          <Reveal delay={0.12} className="min-w-0 lg:col-span-7">
            <div className="dp-dash">
              <div className="dp-dash-bar">
                <div className="flex items-center gap-1.5">
                  <span className="dp-dot" /><span className="dp-dot" /><span className="dp-dot" />
                </div>
                <span className="dp-mono text-[10.5px] uppercase tracking-[0.2em] text-white/55">ADN / market.live</span>
                <span className="dp-mono flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.15em] text-white/55"><span className="dp-live" /> Trực tiếp</span>
              </div>
              <div className="dp-dash-body">
                {DASH.map((s, i) => (
                  <img key={s.src} src={s.src} alt={s.label} loading={i === 0 ? "eager" : "lazy"} className="dp-slide" />
                ))}
                <div className="dp-dash-caps" aria-hidden>
                  {DASH.map((s) => (<span key={s.label} className="dp-dash-cap dp-mono">{s.label}</span>))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── market strip ── */}
      <section className="border-y border-[var(--hairline)] bg-[var(--cream)]">
        <div className="mx-auto max-w-[1180px] px-5 py-6 sm:px-8">
          <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3 sm:justify-between">
            <div className="flex items-baseline gap-2.5">
              <span className="dp-mono text-[11px] uppercase tracking-[0.1em] text-[var(--ink-faint)]">VN-Index</span>
              <span className="dp-num text-[22px] font-semibold">{vnum(MARKET.vnindex)}</span>
              <span className="dp-num text-[14px] font-bold" style={{ color: down ? "var(--down)" : "var(--up)" }}>▾ {Math.abs(MARKET.changePct).toFixed(2)}%</span>
            </div>
            <Stat k="Thanh khoản" v={`${MARKET.liquidity} tỷ`} />
            <Stat k="Độ rộng" v={<><span style={{ color: "var(--up)" }}>{b.up}▲</span> / <span style={{ color: "var(--down)" }}>{b.down}▼</span></>} />
            <Stat k="Vĩ mô" v={`${vnum(MARKET.macroScore, 1)}/10`} />
            <div className="hidden items-center gap-2 lg:flex">
              {MARKET.topSectors.map((s) => (<span key={s.name} className="rounded-full bg-[var(--mint)] px-2.5 py-1 text-[12.5px] font-medium text-[var(--moss)]">{s.name} <span className="dp-num">{s.rs.toFixed(0)}</span></span>))}
            </div>
          </div>
        </div>
      </section>

      {/* ── quiz section ── */}
      <section id="quiz" className="border-b border-[var(--hairline)]">
        <div className="mx-auto max-w-[1180px] px-5 py-20 sm:px-8 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-12 lg:items-center lg:gap-14">
            <Reveal className="min-w-0 lg:col-span-5">
              <p className="dp-mono text-[12px] font-semibold uppercase tracking-[0.2em] text-[var(--gold)]">Bài test 4 câu · 1 phút</p>
              <h2 className="dp-display mt-4 text-[clamp(2rem,3.8vw,3rem)] font-bold leading-[1.08] tracking-[-0.015em]">
                Bạn là nhà đầu tư <span className="italic text-[var(--gold)]">kiểu nào?</span>
              </h2>
              <p className="mt-5 max-w-[42ch] text-[17px] font-light leading-[1.55] text-[var(--ink-muted)]">
                Bốn câu hỏi để biết bạn hợp kiểu nắm giữ theo doanh nghiệp, giao dịch theo nhịp, hay cần một lộ trình từng bước. Cuối bài có gợi ý công cụ.
              </p>
            </Reveal>
            <Reveal delay={0.08} className="min-w-0 lg:col-span-7">
              <Quiz />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── values (thêm tí) ── */}
      <section className="border-b border-[var(--hairline)] bg-[var(--cream)]">
        <div className="mx-auto max-w-[1180px] px-5 py-20 sm:px-8 lg:py-24">
          <Reveal>
            <h2 className="dp-display max-w-[20ch] text-[clamp(1.9rem,3.6vw,2.7rem)] font-bold leading-[1.1] tracking-[-0.015em]">
              ADN không phím mã. <span className="italic text-[var(--gold)]">ADN đưa bạn công cụ để tự quyết.</span>
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-x-10 gap-y-10 md:grid-cols-3">
            {VALUES.map((v, i) => {
              const Icon = v.icon;
              return (
                <Reveal key={v.title} delay={i * 0.08}>
                  <div className="border-t border-[var(--gold)] pt-5">
                    <Icon className="h-6 w-6 text-[var(--moss)]" strokeWidth={1.6} />
                    <h3 className="dp-display mt-4 text-[21px] font-semibold tracking-[-0.01em]">{v.title}</h3>
                    <p className="mt-2.5 max-w-[34ch] text-[15px] font-light leading-[1.55] text-[var(--ink-muted)]">{v.desc}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── feature rows (real screenshots) ── */}
      <section id="features" className="border-b border-[var(--hairline)]">
        <div className="mx-auto max-w-[1180px] space-y-24 px-5 py-24 sm:px-8 lg:space-y-32 lg:py-32">
          {FEATURES.map((f) => (
            <Reveal key={f.title}>
              <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
                <div className={`min-w-0 ${f.flip ? "lg:order-2" : ""}`}>
                  <p className="dp-mono text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--gold)]">{f.kicker}</p>
                  <h2 className="dp-display mt-3 max-w-[18ch] text-[clamp(1.9rem,3.6vw,2.8rem)] font-bold leading-[1.1] tracking-[-0.02em]">{f.title}</h2>
                  <p className="mt-5 max-w-[48ch] text-[17px] font-light leading-[1.55] text-[var(--ink-muted)]">{f.desc}</p>
                  <ul className="mt-6 space-y-2.5">
                    {f.bullets.map((bl) => (<li key={bl} className="flex items-start gap-2.5 text-[15px] text-[var(--ink)]"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--moss)]" strokeWidth={2.5} /> {bl}</li>))}
                  </ul>
                  <a href={f.href} className="mt-7 inline-flex items-center gap-1.5 text-[15px] font-semibold text-[var(--moss)]">Tìm hiểu thêm <ArrowRight className="h-4 w-4" strokeWidth={2} /></a>
                </div>
                <div className={`min-w-0 ${f.flip ? "lg:order-1" : ""}`}><Frame src={f.img} alt={f.title} /></div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── tools ── */}
      <section className="border-b border-[var(--hairline)] bg-[var(--cream)]">
        <div className="mx-auto max-w-[1180px] px-5 py-20 sm:px-8 lg:py-24">
          <Reveal>
            <h2 className="dp-display max-w-[20ch] text-[clamp(1.9rem,3.6vw,2.7rem)] font-bold leading-[1.1] tracking-[-0.015em]">Còn vài công cụ <span className="italic text-[var(--gold)]">nữa.</span></h2>
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {TOOLS.map((t, i) => {
              const Icon = t.icon;
              return (
                <Reveal key={t.title} delay={i * 0.07}>
                  <a href={t.href} className="dp-tool group block overflow-hidden rounded-[16px] border border-[var(--hairline)] bg-[var(--surface)]">
                    {t.img ? (
                      <img src={t.img} alt={t.title} loading="lazy" className="block aspect-[1.7] w-full border-b border-[var(--hairline)] object-cover object-top" />
                    ) : (
                      <div className="flex aspect-[1.7] w-full items-center justify-center border-b border-[var(--hairline)] bg-[var(--mint)]"><Icon className="h-10 w-10 text-[var(--moss)]" strokeWidth={1.5} /></div>
                    )}
                    <div className="p-6">
                      <div className="flex items-center justify-between">
                        <h3 className="dp-display text-[19px] font-semibold tracking-tight">{t.title}</h3>
                        <ArrowUpRight className="h-5 w-5 text-[var(--ink-faint)] transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--moss)]" strokeWidth={1.75} />
                      </div>
                      <p className="mt-2 text-[14px] font-light leading-[1.5] text-[var(--ink-muted)]">{t.desc}</p>
                    </div>
                  </a>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── steps ── */}
      <section id="start" className="border-b border-[var(--hairline)]">
        <div className="mx-auto max-w-[1180px] px-5 py-20 sm:px-8 lg:py-24">
          <Reveal>
            <h2 className="dp-display max-w-[22ch] text-[clamp(1.8rem,3.4vw,2.6rem)] font-bold leading-[1.1] tracking-[-0.015em]">Bắt đầu trong ba bước.</h2>
          </Reveal>
          <div className="mt-12 grid gap-x-10 gap-y-9 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.08}>
                <div className="flex gap-4">
                  <span className="dp-display text-[24px] font-bold text-[var(--gold)]">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h3 className="dp-display text-[20px] font-semibold tracking-[-0.01em]">{s.title}</h3>
                    <p className="mt-2 max-w-[34ch] text-[15px] font-light leading-[1.55] text-[var(--ink-muted)]">{s.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── cta ── */}
      <section>
        <div className="mx-auto max-w-[1180px] px-5 py-24 sm:px-8">
          <Reveal>
            <div className="dp-cta relative overflow-hidden rounded-[28px] px-8 py-20 text-center sm:px-16">
              <h2 className="dp-display mx-auto max-w-[20ch] text-[clamp(2.1rem,4.4vw,3.4rem)] font-bold leading-[1.06] tracking-[-0.02em] text-[var(--cream)]">
                Đừng vội tin. <span className="italic text-[var(--gold)]">Thử một phiên đi.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-[46ch] text-[17px] font-light leading-[1.55] text-white/75">Mở tài khoản không mất phí, dùng hết công cụ trong vài phiên rồi tự thấy có hợp hay không.</p>
              <a href="/auth?mode=register" className="dp-btn dp-btn-on-dark dp-btn-lg mt-9">Mở tài khoản ADN <ArrowRight className="h-4 w-4" strokeWidth={1.75} /></a>
            </div>
          </Reveal>
        </div>
      </section>

    </Shell>
  );
}

function Stat({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="dp-mono text-[11px] uppercase tracking-[0.08em] text-[var(--ink-faint)]">{k}</span>
      <span className="dp-num text-[15px] font-semibold">{v}</span>
    </div>
  );
}

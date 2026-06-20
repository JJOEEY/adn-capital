/**
 * Shared theme for the /design-preview surface: fonts, scoped CSS, nav, footer, Shell.
 * Used by the landing (page.tsx) and the product intro pages (products/[slug]).
 * Editorial UX (9bizclaw-inspired): Playfair headlines, Be Vietnam Pro body,
 * JetBrains Mono labels. Palette = "Sylvan Logic": Neutral #F8F7F2 canvas,
 * forest-green brand #2E4D3D, tan #D6CDBB + sage #7D8471 supporting (no gold).
 */

import { Playfair_Display, Be_Vietnam_Pro, JetBrains_Mono } from "next/font/google";
import { ThemeToggle } from "./ThemeToggle";

const display = Playfair_Display({ subsets: ["latin", "vietnamese"], weight: ["500", "600", "700", "800"], style: ["normal", "italic"], variable: "--f-display", display: "swap" });
const sans = Be_Vietnam_Pro({ subsets: ["latin", "vietnamese"], weight: ["300", "400", "500", "600", "700"], variable: "--f-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--f-mono", display: "swap" });

export const fontVars = `${display.variable} ${sans.variable} ${mono.variable}`;

export const vnum = (n: number, d = 2) => n.toLocaleString("vi-VN", { minimumFractionDigits: d, maximumFractionDigits: d });

export function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return <div className={`dp-reveal ${className}`} style={{ animationDelay: `${delay}s` }}>{children}</div>;
}

export function Frame({ src, alt, ratio = "1.8", eager = false }: { src: string; alt: string; ratio?: string; eager?: boolean }) {
  return (
    <div className="dp-frame">
      <img src={src} alt={alt} loading={eager ? "eager" : "lazy"} className="block w-full object-cover object-top" style={{ aspectRatio: ratio }} />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--hairline)] bg-[color-mix(in_srgb,var(--canvas)_90%,transparent)] backdrop-blur-sm">
      <div className="mx-auto flex h-[66px] max-w-[1180px] items-center justify-between px-5 sm:px-8">
        <a href="/design-preview" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-[var(--moss)] text-sm font-bold text-white">A</span>
          <span className="text-[16px] font-semibold tracking-tight">ADN Capital</span>
        </a>
        <nav className="dp-mono hidden items-center gap-8 text-[12.5px] uppercase tracking-[0.12em] text-[var(--ink-muted)] md:flex">
          <a className="transition-colors hover:text-[var(--ink)]" href="/design-preview#features">Công cụ</a>
          <a className="transition-colors hover:text-[var(--ink)]" href="/design-preview/about">Giới thiệu</a>
          <a className="transition-colors hover:text-[var(--ink)]" href="/design-preview/pricing">Bảng giá</a>
          <a className="transition-colors hover:text-[var(--ink)]" href="/design-preview/contact">Liên hệ</a>
        </nav>
        <div className="flex items-center gap-2.5">
          <ThemeToggle />
          <a href="/design-preview/auth" className="hidden text-[15px] font-medium text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] sm:block">Đăng nhập</a>
          <a href="/design-preview/auth?mode=register" className="dp-btn dp-btn-solid">Mở tài khoản</a>
        </div>
      </div>
    </header>
  );
}

const FOOTER_COLS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Sản phẩm",
    links: [
      { label: "AIDEN", href: "/design-preview/products/aiden" },
      { label: "ADN Radar", href: "/design-preview/products/radar" },
      { label: "Chỉ báo ART", href: "/design-preview/products/art" },
      { label: "Cổ phiếu & RS", href: "/design-preview/products/co-phieu" },
      { label: "Xếp hạng RANK", href: "/design-preview/products/rank" },
      { label: "Nhịp thị trường", href: "/design-preview/products/pulse" },
    ],
  },
  {
    title: "Công ty",
    links: [
      { label: "Giới thiệu", href: "/design-preview/about" },
      { label: "Bảng giá", href: "/design-preview/pricing" },
      { label: "Liên hệ", href: "/design-preview/contact" },
    ],
  },
  {
    title: "Bắt đầu",
    links: [
      { label: "Làm bài test", href: "/design-preview#quiz" },
      { label: "Đăng nhập", href: "/auth" },
      { label: "Mở tài khoản", href: "/design-preview/auth?mode=register" },
    ],
  },
];

function Footer() {
  return (
    <footer className="border-t border-[var(--hairline)] bg-[var(--canvas)]">
      <div className="mx-auto max-w-[1180px] px-5 py-14 sm:px-8">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="max-w-[34ch]">
            <a href="/design-preview" className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-[var(--moss)] text-sm font-bold text-white">A</span>
              <span className="text-[16px] font-semibold tracking-tight">ADN Capital</span>
            </a>
            <p className="mt-4 text-[14px] font-light leading-[1.6] text-[var(--ink-muted)]">Đầu tư bằng dữ liệu, cho nhà đầu tư cá nhân Việt Nam.</p>
          </div>
          {FOOTER_COLS.map((col) => (
            <div key={col.title}>
              <p className="dp-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]">{col.title}</p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} className="text-[14.5px] text-[var(--ink-muted)] transition-colors hover:text-[var(--moss)]">{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col justify-between gap-3 border-t border-[var(--hairline)] pt-6 text-[13px] font-light text-[var(--ink-faint)] sm:flex-row">
          <span>© 2026 ADN Capital</span>
          <span>Thông tin chỉ mang tính tham khảo, không phải khuyến nghị đầu tư.</span>
        </div>
      </div>
    </footer>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${fontVars} dp-root min-h-screen antialiased`} style={{ fontFamily: "var(--f-sans)", background: "var(--canvas)", color: "var(--ink)" }}>
      <script dangerouslySetInnerHTML={{ __html: "try{if(localStorage.getItem('dp-theme')==='dark'){document.currentScript.parentElement.classList.add('dp-dark');document.documentElement.style.colorScheme='dark';}}catch(e){}" }} />
      <style>{dpCSS}</style>
      <Nav />
      {children}
      <Footer />
    </div>
  );
}

export const dpCSS = `
.dp-root{
  color-scheme:light;
  --canvas:#f8f7f2;
  --cream:#f0ece2;
  --surface:#ffffff;
  --surface-2:#e8e2d5;
  --ink:#1b211c;
  --ink-muted:#565d54;
  --ink-faint:#8b9085;
  --moss:#2e4d3d;
  --moss-deep:#1d3528;
  --moss-press:#274232;
  --gold:#41734f;
  --mint:#dde8e0;
  --hairline:#e5dfd1;
  --up:#1f8a4d;
  --down:#c0392b;
  --dash-bg:#10160f;
  --dash-chrome:#19211a;
  --shadow:24,32,26;
}
.dp-display{ font-family:var(--f-display); }
.dp-mono{ font-family:var(--f-mono); }
.dp-num{ font-variant-numeric:tabular-nums; letter-spacing:-0.01em; }

.dp-btn{ display:inline-flex; align-items:center; gap:.5rem; border-radius:999px; font-size:15px; font-weight:500; padding:.55rem 1.1rem;
  transition:transform .15s ease, background .2s ease, border-color .2s ease, filter .2s ease; }
.dp-btn:active{ transform:translateY(1px) scale(.99); }
.dp-btn-lg{ padding:.78rem 1.5rem; font-size:15.5px; }
.dp-btn-solid{ background:var(--moss); color:#fff; }
.dp-btn-solid:hover{ background:var(--moss-press); }
.dp-btn-ghost{ background:var(--surface); color:var(--ink); border:1px solid var(--hairline); }
.dp-btn-ghost:hover{ border-color:var(--moss); }
.dp-btn-on-dark{ background:var(--cream); color:var(--moss-deep); }
.dp-btn-on-dark:hover{ filter:brightness(.96); }

.dp-frame{ border:1px solid var(--hairline); border-radius:16px; overflow:hidden; background:var(--surface);
  box-shadow:0 2px 8px rgba(var(--shadow),.07), 0 30px 60px -24px rgba(var(--shadow),.24); }
.dp-tool{ transition:transform .3s cubic-bezier(.16,1,.3,1), box-shadow .3s ease, border-color .3s ease; }
.dp-tool:hover{ transform:translateY(-3px); border-color:var(--moss); box-shadow:0 20px 44px -18px rgba(var(--shadow),.24); }

/* flip cards (pricing): hover flips to detail + slight scale */
.dp-flip{ perspective:1400px; height:460px; }
.dp-flip-inner{ position:relative; width:100%; height:100%; transform-style:preserve-3d;
  transition:transform .6s cubic-bezier(.16,1,.3,1); }
.dp-flip-front, .dp-flip-back{ position:absolute; inset:0; display:flex; flex-direction:column;
  backface-visibility:hidden; -webkit-backface-visibility:hidden; border-radius:18px; overflow:hidden;
  border:1px solid var(--hairline); box-shadow:0 2px 8px rgba(var(--shadow),.06), 0 24px 50px -24px rgba(var(--shadow),.2); }
.dp-flip-front{ padding:1.6rem; }
.dp-flip-back{ transform:rotateY(180deg); background:var(--surface); padding:1.7rem; }
.dp-flip-feat .dp-flip-front, .dp-flip-feat .dp-flip-back{ border:2px solid var(--moss); }
@media (hover:hover){ .dp-flip:hover .dp-flip-inner{ transform:rotateY(180deg) scale(1.03); } }
.dp-cover-base{ color:var(--ink);
  background:radial-gradient(58% 46% at 50% 40%, rgba(125,132,113,.16), transparent 62%), linear-gradient(170deg,#fcfbf6,#eef0e9);
  --stem:#7d8471; --leaf:#5a8c68; --leaf-fill:rgba(90,140,104,.16); --ground:rgba(27,33,28,.16); --halo:rgba(125,132,113,.28); --flower:#7d8471; --flower-center:#f8f7f2; }
.dp-cover-vip{ color:var(--cream);
  background:radial-gradient(60% 50% at 50% 38%, rgba(150,210,170,.24), transparent 62%), linear-gradient(165deg,#2e4d3d,#1d3528);
  --stem:#d6cdbb; --leaf:#aed3b7; --leaf-fill:rgba(174,211,183,.14); --ground:rgba(255,255,255,.2); --halo:rgba(214,205,187,.32); --flower:#d6cdbb; --flower-center:#1d3528; }
.dp-cover-premium{ color:var(--cream);
  background:radial-gradient(54% 44% at 50% 34%, rgba(130,200,150,.2), transparent 62%), linear-gradient(165deg,#16291d,#0c1a12);
  --stem:#d6cdbb; --leaf:#aed3b7; --leaf-fill:rgba(174,211,183,.14); --ground:rgba(255,255,255,.16); --halo:rgba(214,205,187,.4); --flower:#d6cdbb; --flower-center:#10160f; }
@media (hover:none){
  .dp-flip{ height:auto; perspective:none; }
  .dp-flip-inner{ transform:none !important; }
  .dp-flip-front, .dp-flip-back{ position:relative; inset:auto; backface-visibility:visible; transform:none; }
  .dp-flip-front{ border-bottom-left-radius:0; border-bottom-right-radius:0; }
  .dp-flip-back{ border-top:none; border-top-left-radius:0; border-top-right-radius:0; }
}
@media (prefers-reduced-motion: reduce){ .dp-flip-inner{ transition-duration:.01ms; } }

/* animated dashboard (the GIF) */
.dp-dash{ border-radius:14px; overflow:hidden; border:1px solid rgba(20,20,15,.1); background:var(--dash-bg);
  box-shadow:0 2px 10px rgba(var(--shadow),.1), 0 48px 90px -34px rgba(var(--shadow),.4); }
.dp-dash-bar{ display:flex; align-items:center; justify-content:space-between; padding:.62rem .95rem; background:var(--dash-chrome); border-bottom:1px solid rgba(255,255,255,.07); }
.dp-dot{ width:8px; height:8px; border-radius:99px; background:rgba(255,255,255,.2); }
.dp-dash-body{ position:relative; aspect-ratio:1.8; background:var(--dash-bg); }
.dp-slide{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; object-position:top; opacity:0; animation:dp-cycle 18s infinite; }
.dp-slide:nth-child(1){ opacity:1; animation-delay:-1s; }
.dp-slide:nth-child(2){ animation-delay:3.5s; }
.dp-slide:nth-child(3){ animation-delay:8s; }
.dp-slide:nth-child(4){ animation-delay:12.5s; }
@keyframes dp-cycle{ 0%{opacity:0} 2%{opacity:1} 22%{opacity:1} 25%{opacity:0} 100%{opacity:0} }
.dp-dash-cap{ position:absolute; left:.95rem; bottom:.7rem; white-space:nowrap; font-size:11px; letter-spacing:.04em; color:#fff;
  background:rgba(0,0,0,.42); border:1px solid rgba(255,255,255,.14); border-radius:7px; padding:.2rem .55rem; opacity:0; animation:dp-cycle 18s infinite; }
.dp-dash-cap:nth-child(1){ opacity:1; animation-delay:-1s; }
.dp-dash-cap:nth-child(2){ animation-delay:3.5s; }
.dp-dash-cap:nth-child(3){ animation-delay:8s; }
.dp-dash-cap:nth-child(4){ animation-delay:12.5s; }

.dp-live{ display:inline-block; width:7px; height:7px; border-radius:99px; background:#5fd08a; animation:dp-pulse 2.4s infinite; }
@keyframes dp-pulse{ 0%{ box-shadow:0 0 0 0 rgba(95,208,138,.5); } 70%{ box-shadow:0 0 0 6px transparent; } 100%{ box-shadow:0 0 0 0 transparent; } }

/* quiz */
.dp-quiz{ background:var(--surface); border:1px solid var(--hairline); border-radius:20px; overflow:hidden;
  box-shadow:0 2px 8px rgba(var(--shadow),.07), 0 30px 60px -24px rgba(var(--shadow),.22); }
.dp-quiz-opt{ border:1px solid var(--hairline); border-radius:14px; background:var(--canvas); padding:.85rem 1rem;
  transition:border-color .2s ease, background .2s ease, transform .12s ease; }
.dp-quiz-opt:hover{ border-color:var(--moss); background:var(--surface); }
.dp-quiz-opt:active{ transform:scale(.99); }
.dp-quiz-num{ flex:none; display:grid; place-items:center; width:26px; height:26px; border-radius:8px; background:var(--mint); color:var(--moss); font-size:12.5px; font-weight:700; transition:background .2s ease, color .2s ease; }
.dp-quiz-opt:hover .dp-quiz-num{ background:var(--moss); color:#fff; }
.dp-quiz-tool{ border:1px solid var(--hairline); border-radius:12px; background:var(--canvas); padding:.7rem .9rem; transition:border-color .2s ease; }
.dp-quiz-tool:hover{ border-color:var(--moss); }

.dp-cta{ background:linear-gradient(150deg,var(--moss-deep) 0%,#2e4d3d 55%,#3a6249 100%); }

/* faq accordion */
.dp-faq > summary{ list-style:none; }
.dp-faq > summary::-webkit-details-marker{ display:none; }
.dp-faq-icon{ transition:transform .25s ease; }
.dp-faq[open] .dp-faq-icon{ transform:rotate(180deg); }

.dp-reveal{ opacity:1; animation:dp-rise .6s cubic-bezier(.16,1,.3,1) backwards; }
@keyframes dp-rise{ from{ transform:translateY(16px); } to{ transform:none; } }

.dp-hero-grid{ grid-template-columns:1fr; }
.dp-hero-grid > *{ min-width:0; }
@media (min-width:1024px){ .dp-hero-grid{ grid-template-columns:repeat(12,minmax(0,1fr)); } }

@media (prefers-reduced-motion: reduce){
  .dp-reveal{ animation:none; }
  .dp-slide, .dp-dash-cap, .dp-live{ animation:none; }
  .dp-slide:nth-child(1), .dp-dash-cap:nth-child(1){ opacity:1; }
  .dp-slide:not(:nth-child(1)), .dp-dash-cap:not(:nth-child(1)){ opacity:0; }
}

/* ── Dark mode — Sylvan Logic accents on a NEUTRAL grey-black canvas (toggled via .dp-dark) ── */
.dp-root.dp-dark{
  color-scheme:dark;
  --canvas:#0d0d0f;
  --cream:#151517;
  --surface:#1d1d20;
  --surface-2:#27272b;
  --ink:#ece7db;
  --ink-muted:#a6a39b;
  --ink-faint:#8a877e;
  --moss:#3f7d5b;
  --moss-deep:#2a5a3e;
  --moss-press:#356a4a;
  --gold:#8fc9a0;
  --mint:#26262b;
  --hairline:rgba(255,255,255,0.09);
  --up:#4cc97f;
  --down:#e7654f;
  --dash-bg:#0a0a0c;
  --dash-chrome:#141416;
  --shadow:0,0,0;
}
/* brand-green slabs stay green to pop against the neutral grey canvas; keep their edges drawn */
.dp-dark .dp-cta{ background:linear-gradient(150deg,#1c3527 0%,#284a37 55%,#356048 100%); border:1px solid rgba(143,201,160,0.20); box-shadow:0 28px 70px -34px rgba(0,0,0,0.8); }
.dp-dark .dp-cover-base{ color:var(--ink); background:radial-gradient(64% 52% at 50% 40%, rgba(143,201,160,0.10), transparent 62%), linear-gradient(170deg,#202024,#161618); --stem:#9a9890; --leaf:#8fc9a0; --leaf-fill:rgba(143,201,160,0.15); --ground:rgba(236,231,219,0.16); --halo:rgba(143,201,160,0.22); --flower:#cfe3d5; --flower-center:#161618; }
.dp-dark .dp-cover-vip{ background:radial-gradient(60% 50% at 50% 38%, rgba(150,210,170,0.22), transparent 62%), linear-gradient(165deg,#234a39,#16291d); }
.dp-dark .dp-cover-vip, .dp-dark .dp-cover-premium{ color:#ece7db; }
.dp-dark .dp-btn-on-dark{ background:#ece7db; color:#163325; }
.dp-dark .dp-quiz-num{ background:var(--mint); color:#8fc9a0; }
.dp-dark .dp-dash{ border-color:rgba(255,255,255,0.08); }
/* foregrounds that assumed light-mode var values (cream=light, moss=dark) need pinning in dark */
.dp-dark .text-\\[var\\(--cream\\)\\]{ color:#ece7db; }
.dp-dark .text-\\[var\\(--moss\\)\\]{ color:#8fc9a0; }
`;

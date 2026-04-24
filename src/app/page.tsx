"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import Pricing from "@/components/landing/Pricing";
import { Footer } from "@/components/layout/Footer";
import { PwaEntryRedirect } from "@/components/pwa/PwaEntryRedirect";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  Zap,
  ChevronRight,
  UserPlus,
  BarChart3,
  BookOpen,
  Rocket,
  CheckCircle2,
  ArrowRight,
  ArrowUpRight,
  MessageSquare,
  ChevronDown,
  Activity,
  Banknote,
  Star,
  Plus,
  Minus,
  Sun,
  Moon,
  Menu,
  X,
} from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";

/* ─────────────────────────────────────────────────────────────────────────────
   SCROLL-TRIGGERED FADE-IN WRAPPER
───────────────────────────────────────────────────────────────────────────── */
function FadeIn({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.23, 1, 0.32, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   ANIMATED COUNTER
───────────────────────────────────────────────────────────────────────────── */
function useCountUp(end: number, duration = 2000) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });

  useEffect(() => {
    if (!inView) return;
    let startTime: number | null = null;
    const step = (ts: number) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, end, duration]);

  return { count: count === 0 ? end : count, ref };
}

/* ─────────────────────────────────────────────────────────────────────────────
   SECTION LABEL COMPONENT
───────────────────────────────────────────────────────────────────────────── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-[12px] font-bold uppercase tracking-[0.12em] block mb-4"
      style={{ color: "var(--text-secondary)" }}
    >
      {children}
    </span>
  );
}

const LandingBacktestChart = dynamic(
  () => import("@/components/dashboard/DynamicBacktestChart").then((m) => m.DynamicBacktestChart),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border p-4 sm:p-6" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="h-[360px] sm:h-[420px] rounded-xl animate-pulse" style={{ background: "var(--surface-2)" }} />
      </div>
    ),
  },
);

/* ─────────────────────────────────────────────────────────────────────────────
   LANDING PAGE HEADER (Phase 1 spec)
───────────────────────────────────────────────────────────────────────────── */
function LandingHeader() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const [menuOpen, setMenuOpen] = useState(false);

  const navLinks = [
    { href: "/", label: "Trang Chủ" },
    { href: "/san-pham", label: "Sản phẩm" },
    { href: "/pricing", label: "Bảng giá" },
    { href: "#", label: "Về chúng tôi" },
  ];

  return (
    <header
      className="sticky top-0 z-50 h-16 px-5 md:px-12 flex items-center justify-between"
      style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}
    >
      <Link href="/" className="flex items-center gap-2.5">
        <Image src="/logo.jpg" alt="ADN" width={32} height={32} className="rounded-lg" />
        <span className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>ADN Capital</span>
      </Link>

      <nav className="hidden md:flex items-center gap-8">
        {navLinks.map((link) => (
          <Link key={link.href} href={link.href}
            className="text-[14px] font-medium transition-opacity hover:opacity-70"
            style={{ color: "var(--text-secondary)" }}>{link.label}</Link>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        <Link href="/auth"
          className="hidden sm:inline-flex items-center px-5 py-2 rounded-[10px] text-[14px] font-medium transition-all"
          style={{ color: "var(--text-primary)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--primary-light)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
          Đăng nhập
        </Link>
        <Link href="/auth"
          className="hidden sm:inline-flex items-center px-5 py-2 rounded-[10px] text-[14px] font-semibold transition-all"
          style={{ background: "var(--primary)", color: "var(--on-primary)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--primary-hover)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--primary)"; }}>
          Dùng thử
        </Link>
        <button onClick={toggleTheme}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
          style={{ color: "var(--text-secondary)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <button onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden p-2 rounded-lg" style={{ color: "var(--text-secondary)" }}>
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {menuOpen && (
        <div className="absolute top-16 left-0 right-0 md:hidden"
          style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
          <nav className="flex flex-col p-4 space-y-3">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)}
                className="text-[14px] font-medium" style={{ color: "var(--text-secondary)" }}>{link.label}</Link>
            ))}
            <div className="flex gap-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
              <Link href="/auth" onClick={() => setMenuOpen(false)}
                className="flex-1 text-center py-2 rounded-[10px] text-[14px] font-medium"
                style={{ color: "var(--text-primary)", border: "1px solid var(--border)" }}>Đăng nhập</Link>
              <Link href="/auth" onClick={() => setMenuOpen(false)}
                className="flex-1 text-center py-2 rounded-[10px] text-[14px] font-semibold"
                style={{ background: "var(--primary)", color: "var(--on-primary)" }}>Dùng thử</Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   PAGE SHELL
───────────────────────────────────────────────────────────────────────────── */
export default function HomePage() {
  return (
    <div style={{ background: "var(--bg-page)" }}>
      <PwaEntryRedirect />
      <LandingHeader />
      <div className="space-y-0">
        <HeroSectionV2 />
        <SocialProofTicker />
        <WorkflowProofSection />
        <FeaturesSection />
        <BrokerConnectedSection />
        <PerformanceSection />
        <ProcessSection />
        <TestimonialsSection />
        <Pricing />
        <FAQSection />
        <CTASection />
      </div>
      <Footer />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   1. HERO SECTION
───────────────────────────────────────────────────────────────────────────── */
const HERO_TRUST_CHIPS = [
  "Dashboard thị trường",
  "AI Broker workflow",
  "ART đảo chiều xu hướng",
  "Brief & tin tức",
  "Preview hành động an toàn",
];

function HeroSectionV2() {
  return (
    <section className="relative overflow-hidden px-5 md:px-12 py-20 md:py-28">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 18% 8%, rgba(46, 92, 69, 0.16), transparent 34%), radial-gradient(circle at 86% 22%, rgba(238, 169, 81, 0.12), transparent 30%)",
        }}
      />
      <div className="relative max-w-7xl mx-auto grid lg:grid-cols-[1fr_0.95fr] gap-12 lg:gap-16 items-center">
        <FadeIn>
          <SectionLabel>ADN Capital Broker-First Platform</SectionLabel>
          <h1
            className="max-w-4xl text-[44px] sm:text-[60px] lg:text-[74px] leading-[0.95] font-black tracking-[-0.06em]"
            style={{ color: "var(--text-primary)" }}
          >
            AI phân tích thị trường, broker workflow kiểm soát hành động.
          </h1>
          <p
            className="mt-7 max-w-2xl text-[18px] sm:text-[20px] leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            ADN gom tín hiệu, dữ liệu thị trường, brief, danh mục và trạng thái tài khoản vào một luồng vận hành thống nhất để nhà đầu tư ra quyết định có kiểm chứng hơn.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row gap-3">
            <Link
              href="/auth"
              className="group inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-[12px] font-semibold text-[15px] transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: "var(--primary)", color: "var(--on-primary)" }}
            >
              Dùng thử dashboard
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#broker-workflow"
              className="group inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-[12px] font-semibold text-[15px] transition-all"
              style={{ border: "1px solid var(--border-strong)", color: "var(--text-primary)", background: "var(--surface)" }}
            >
              Xem workflow broker
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </a>
          </div>
          <div className="mt-8 flex flex-wrap gap-2">
            {HERO_TRUST_CHIPS.map((chip) => (
              <span
                key={chip}
                className="rounded-full px-3.5 py-2 text-[13px] font-semibold"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              >
                {chip}
              </span>
            ))}
          </div>
        </FadeIn>

        <FadeIn delay={0.12}>
          <BrokerHeroPreview />
        </FadeIn>
      </div>
    </section>
  );
}

function BrokerHeroPreview() {
  const rows = [
    { label: "Tín hiệu mới", value: "Upsert vào DataHub", tone: "var(--success)" },
    { label: "Danh mục", value: "Đọc cùng source broker", tone: "var(--primary)" },
    { label: "Phiếu lệnh", value: "Preview trước khi xác nhận", tone: "var(--warning)" },
  ];

  return (
    <div
      className="relative rounded-[28px] p-4 sm:p-5 shadow-2xl"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div
        className="absolute -top-6 -right-6 h-24 w-24 rounded-full blur-2xl"
        style={{ background: "rgba(46, 92, 69, 0.22)" }}
      />
      <div className="relative rounded-[22px] p-5" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>
              ADN AI Broker
            </p>
            <h3 className="mt-2 text-2xl font-black tracking-[-0.04em]" style={{ color: "var(--text-primary)" }}>
              Quyết định từ dữ liệu thật
            </h3>
          </div>
          <div className="rounded-2xl p-3" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
            <Activity className="w-6 h-6" />
          </div>
        </div>

        <div className="mt-6 grid gap-3">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between rounded-2xl px-4 py-3"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <span className="text-[14px]" style={{ color: "var(--text-secondary)" }}>{row.label}</span>
              <span className="text-[14px] font-bold" style={{ color: row.tone }}>{row.value}</span>
            </div>
          ))}
        </div>

        <div className="mt-5 grid sm:grid-cols-2 gap-3">
          <div className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <p className="text-[12px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>NAV khuyến nghị</p>
            <p className="mt-3 text-3xl font-black" style={{ color: "var(--text-primary)" }}>10%</p>
            <p className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>Liên kết với quy mô danh mục khi preview lệnh.</p>
          </div>
          <div className="rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <p className="text-[12px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>Guardrail</p>
            <p className="mt-3 text-3xl font-black" style={{ color: "var(--success)" }}>SAFE</p>
            <p className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>AI chỉ giải thích; lifecycle và rủi ro là deterministic.</p>
          </div>
        </div>

        <p className="mt-5 text-[12px]" style={{ color: "var(--text-muted)" }}>
          Minh họa public, không phải dữ liệu tài khoản thật và không tự động đặt lệnh.
        </p>
      </div>
    </div>
  );
}

const WORKFLOW_PROOFS = [
  {
    title: "Một nguồn sự thật",
    body: "Dashboard, ADN AI Broker, brief và notification đọc từ cùng record/topic thay vì mỗi nơi tự tính một kiểu.",
    Icon: BarChart3,
  },
  {
    title: "AI không sinh tín hiệu gốc",
    body: "Scanner, lifecycle, risk và broker truth chạy deterministic; AI chỉ giải thích, tóm tắt và cá nhân hóa.",
    Icon: CheckCircle2,
  },
  {
    title: "Broker workflow có kiểm soát",
    body: "Kết nối tài khoản, NAV, vị thế và preview hành động được đặt sau guardrails, không mở real submit đại trà.",
    Icon: Banknote,
  },
];

function WorkflowProofSection() {
  return (
    <section className="px-5 md:px-12 py-16">
      <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-4">
        {WORKFLOW_PROOFS.map(({ title, body, Icon }, idx) => (
          <FadeIn key={title} delay={idx * 0.08}>
            <div
              className="h-full rounded-[24px] p-6 transition-transform hover:-translate-y-1"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="mt-5 text-xl font-black tracking-[-0.03em]" style={{ color: "var(--text-primary)" }}>{title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{body}</p>
            </div>
          </FadeIn>
        ))}
      </div>
    </section>
  );
}

function BrokerConnectedSection() {
  return (
    <section id="broker-workflow" className="px-5 md:px-12 py-20">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-[0.9fr_1.1fr] gap-10 items-center">
        <FadeIn>
          <SectionLabel>Broker-Connected Workflow</SectionLabel>
          <h2 className="text-[34px] sm:text-[48px] font-black tracking-[-0.05em] leading-tight" style={{ color: "var(--text-primary)" }}>
            Không chỉ xem tín hiệu. ADN đặt tín hiệu vào bối cảnh danh mục.
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Khi tài khoản được kết nối, workflow có thể đối chiếu NAV, vị thế, sức mua và tỷ trọng khuyến nghị trước khi tạo phiếu preview. Người dùng vẫn là người xác nhận hành động cuối cùng.
          </p>
          <div className="mt-7 grid gap-3">
            {[
              "Đọc tín hiệu từ DataHub, không gửi Telegram từ raw scanner.",
              "Tính tỷ trọng theo NAV và làm tròn lô giao dịch theo rule thị trường.",
              "Tách preview, xác nhận thủ công và real-submit governance.",
            ].map((item) => (
              <div key={item} className="flex gap-3 text-[15px]" style={{ color: "var(--text-secondary)" }}>
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--success)" }} />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </FadeIn>

        <FadeIn delay={0.12}>
          <div className="rounded-[28px] p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-2xl p-5" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <p className="text-[12px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>Tài khoản liên kết</p>
                <p className="mt-4 text-2xl font-black" style={{ color: "var(--text-primary)" }}>NAV 450 triệu</p>
                <p className="mt-2 text-[14px]" style={{ color: "var(--text-secondary)" }}>Ví dụ minh họa: thẻ broker khuyến nghị 10% NAV.</p>
              </div>
              <div className="rounded-2xl p-5" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <p className="text-[12px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>Phiếu preview</p>
                <p className="mt-4 text-2xl font-black" style={{ color: "var(--text-primary)" }}>45 triệu</p>
                <p className="mt-2 text-[14px]" style={{ color: "var(--text-secondary)" }}>Khối lượng được làm tròn theo bội số 100 trước khi xác nhận.</p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl p-5" style={{ background: "var(--primary-light)", border: "1px solid var(--border)" }}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-[13px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--primary)" }}>Trạng thái thực thi</p>
                  <p className="mt-2 text-xl font-black" style={{ color: "var(--text-primary)" }}>Safe / Allowlist / Compliance-gated</p>
                </div>
                <span className="rounded-full px-4 py-2 text-[13px] font-bold" style={{ background: "var(--surface)", color: "var(--primary)", border: "1px solid var(--border)" }}>
                  Không public real submit
                </span>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

function HeroSection() {
  return (
    <section
      className="relative px-5 md:px-12 pt-28 pb-20 md:pt-36 md:pb-28 text-center overflow-hidden"
      style={{ background: "var(--bg-page)" }}
    >
      {/* Subtle background orb */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[92vw] max-w-[860px] h-[420px] sm:h-[500px] md:h-[560px] rounded-full pointer-events-none"
        style={{
          background: "var(--primary-light)",
          opacity: 0.55,
        }}
      />

      <div className="relative z-10 max-w-[820px] mx-auto">
        {/* Badge label */}
        <FadeIn>
          <div className="flex justify-center mb-8">
            <span
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[13px] font-medium tracking-[0.08em]"
              style={{
                background: "var(--primary-light)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border)",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: "var(--primary)" }}
              />
              Đầu tư cùng
            </span>
          </div>
        </FadeIn>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.23, 1, 0.32, 1] }}
          className="mb-8 leading-[1.04] text-center max-w-[92vw] sm:max-w-[760px] mx-auto"
        >
          <span
            className="block whitespace-nowrap font-black font-orbitron tracking-[0.05em] text-[20px] sm:text-[32px] lg:text-[42px] xl:text-[44px]"
            style={{ color: "var(--text-primary)" }}
          >
            QUANT TRADING SYSTEM
          </span>
          <span className="block mt-2 whitespace-nowrap font-black font-orbitron tracking-[0.04em] text-[40px] sm:text-[56px] lg:text-[72px] xl:text-[76px] text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600">
            ADN CAPITAL
          </span>
        </motion.h1>

        {/* Sub-headline */}
        <FadeIn delay={0.3}>
          <p
            className="text-[17px] md:text-[18px] leading-[1.7] max-w-[560px] mx-auto mb-9"
            style={{ color: "var(--text-secondary)" }}
          >
            Hệ thống giao dịch thuật toán kết hợp AI — Tự động quét tín hiệu,
            quản trị rủi ro và bảo vệ danh mục 24/7.
          </p>
        </FadeIn>

        {/* CTA Buttons */}
        <FadeIn delay={0.45}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="https://s.dnse.vn/AhkV3Y"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2 px-7 py-3.5 rounded-[10px] font-semibold text-[15px] transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: "var(--primary)",
                color: "var(--on-primary)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = "var(--primary-hover)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = "var(--primary)";
              }}
            >
              <UserPlus className="w-4 h-4" />
              Mở Tài Khoản Ngay
              <ArrowUpRight className="w-4 h-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>

            <Link
              href="/backtest"
              className="group flex items-center gap-2 px-7 py-3.5 rounded-[10px] font-medium text-[15px] border transition-all hover:scale-[1.01]"
              style={{
                borderColor: "var(--border-strong)",
                color: "var(--text-primary)",
                borderWidth: "1.5px",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--primary)";
                (e.currentTarget as HTMLAnchorElement).style.background = "var(--primary-light)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border-strong)";
                (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
              }}
            >
              <BarChart3 className="w-4 h-4" />
              Xem Lịch Sử Lợi Nhuận
              <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </FadeIn>

        {/* Hero backtest chart */}
        <FadeIn delay={0.6}>
          <div
            className="mt-16 rounded-2xl overflow-hidden mx-auto max-w-4xl"
            style={{
              border: "1px solid var(--border)",
              boxShadow: "0 24px 48px rgba(0,0,0,0.08)",
            }}
          >
            <LandingBacktestChart />
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   2. SOCIAL PROOF TICKER TAPE
───────────────────────────────────────────────────────────────────────────── */
const PARTNERS = [
  "Dashboard thị trường", "ADN AI Broker", "Chỉ báo ART",
  "Signal Map", "Morning Brief", "EOD Brief",
  "Broker preview", "DataHub canonical", "Guardrails",
  "Dashboard thị trường", "ADN AI Broker", "Chỉ báo ART",
  "Signal Map", "Morning Brief", "EOD Brief",
  "Broker preview", "DataHub canonical", "Guardrails",
];

function SocialProofTicker() {
  return (
    <div
      className="py-5 overflow-hidden"
      style={{
        borderTop: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-hover)",
      }}
    >
      <div className="flex gap-0 animate-marquee whitespace-nowrap">
        {PARTNERS.map((p, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-3 text-[13px] font-medium px-6"
            style={{ color: "var(--text-secondary)" }}
          >
            <span
              className="w-1 h-1 rounded-full flex-shrink-0"
              style={{ background: "var(--primary)" }}
            />
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   3. STATS SECTION
───────────────────────────────────────────────────────────────────────────── */
function StatsSection() {
  const c1 = useCountUp(210);
  const c2 = useCountUp(5);
  const c3 = useCountUp(97);

  const stats = [
    { ref: c1.ref, value: `${c1.count}+`, label: "Tín hiệu đã xác nhận thành công" },
    { ref: c2.ref, value: `${c2.count}K+`, label: "Lượt truy cập & sử dụng hệ thống" },
    { ref: c3.ref, value: `${c3.count}%`, label: "Tỷ lệ hài lòng từ khách hàng" },
  ];

  return (
    <section
      className="px-5 md:px-12 py-20"
      style={{ background: "var(--bg-page)" }}
    >
      <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((s, i) => (
          <div
            key={i}
            ref={s.ref}
            className="text-center px-8 py-10 rounded-[14px]"
            style={{
              border: "1px solid var(--border)",
              background: "var(--surface)",
            }}
          >
            <p
              className="text-[48px] font-bold leading-none mb-3"
              style={{ color: "var(--text-primary)" }}
            >
              {s.value}
            </p>
            <p className="text-[15px]" style={{ color: "var(--text-secondary)" }}>
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   4. FEATURES / SẢN PHẨM & TÍNH NĂNG
───────────────────────────────────────────────────────────────────────────── */
interface LandingProductCardUI {
  id: string;
  title: string;
  subtitle: string | null;
  description: string;
  bullets: string[];
  href: string;
  imageUrl: string;
  imageAlt: string | null;
  badge: string | null;
}

const DEFAULT_LANDING_PRODUCTS: LandingProductCardUI[] = [
  {
    id: "landing-art",
    title: "Chỉ báo ART",
    subtitle: "Analytical Reversal Tracker",
    description: "Xác định điểm đảo chiều xu hướng thị trường. Đo lường mức độ cạn kiệt để nhận biết khi nào nên vào/thoát lệnh.",
    bullets: ["Gauge trực quan 0–5 điểm", "Biểu đồ lịch sử ART + MA7", "Hỗ trợ mọi mã CK", "Cập nhật theo phiên giao dịch"],
    href: "/art",
    imageUrl: "/logo.jpg",
    imageAlt: "ART mockup",
    badge: "MỚI",
  },
  {
    id: "landing-terminal",
    title: "Tư vấn đầu tư",
    subtitle: "AI phân tích thông minh",
    description: "Hỏi đáp phân tích kỹ thuật, cơ bản, tâm lý với AI chuyên sâu về thị trường chứng khoán Việt Nam 24/7.",
    bullets: ["Phân tích kỹ thuật theo yêu cầu", "Tóm tắt báo cáo tài chính", "Market sentiment & vĩ mô", "Luận điểm Long / Short"],
    href: "/terminal",
    imageUrl: "/logo.jpg",
    imageAlt: "Investment advisor mockup",
    badge: null,
  },
  {
    id: "landing-broker",
    title: "ADN AI Broker",
    subtitle: "Tín hiệu mua/bán tự động",
    description: "Nhận tín hiệu Mua/Bán theo hệ thống Quant Trading của ADN Capital — bộ lọc đa chiều, tối ưu cho VN.",
    bullets: ["Tín hiệu mua/bán tự động", "Bộ lọc Volume & RS cùng lúc", "Lịch sử tín hiệu đầy đủ", "Thông báo Real-time"],
    href: "/dashboard/signal-map",
    imageUrl: "/logo.jpg",
    imageAlt: "AI Broker mockup",
    badge: null,
  },
  {
    id: "landing-margin",
    title: "Ký Quỹ Margin",
    subtitle: "Lãi suất từ 5.99%/năm",
    description: "Tư vấn miễn phí, phản hồi trong 2 giờ. Tối ưu đòn bẩy, quản lý tỷ lệ ký quỹ chuyên nghiệp.",
    bullets: ["Lãi suất từ 5.99%/năm", "Tư vấn miễn phí", "Phản hồi trong 2 giờ", "Quản lý ký quỹ chuyên nghiệp"],
    href: "/margin",
    imageUrl: "/logo.jpg",
    imageAlt: "Margin service mockup",
    badge: "HOT",
  },
];

function FeaturesSection() {
  const [cards, setCards] = useState<LandingProductCardUI[]>(DEFAULT_LANDING_PRODUCTS);
  const [isLoadingCards, setIsLoadingCards] = useState(true);

  useEffect(() => {
    let active = true;
    const loadCards = async () => {
      try {
        const res = await fetch("/api/landing-products", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { cards?: LandingProductCardUI[] };
        const nextCards = Array.isArray(data.cards) ? data.cards : [];
        if (active && nextCards.length > 0) {
          setCards(nextCards);
        }
      } catch {
        // fallback defaults already in state
      } finally {
        if (active) setIsLoadingCards(false);
      }
    };
    void loadCards();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section
      className="px-5 md:px-12 py-24"
      style={{
        borderTop: "1px solid var(--border)",
        background: "var(--bg-page)",
      }}
    >
      <div className="max-w-5xl mx-auto">
        <FadeIn>
          <div className="mb-12">
            <SectionLabel>Platform</SectionLabel>
            <h2
              className="text-[32px] sm:text-[40px] font-bold leading-[1.2] mb-3"
              style={{ color: "var(--text-primary)" }}
            >
              Bộ công cụ vận hành đầu tư
            </h2>
            <p
              className="text-[17px] max-w-[520px]"
              style={{ color: "var(--text-secondary)" }}
            >
              Các module chính được đặt trong cùng workflow: thị trường, tín hiệu,
              broker insight, ART, backtest và quản trị danh mục.
            </p>
          </div>
        </FadeIn>

        <div className="space-y-5">
          {cards.map((card, i) => (
            <FadeIn key={card.id ?? `${card.href}-${i}`} delay={i * 0.08}>
              <article
                className="border rounded-xl p-6 md:p-8 flex flex-col-reverse md:flex-row items-center gap-8 md:gap-12 transition-all md:[&:nth-child(even)]:flex-row-reverse"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--surface)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--border-strong)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                }}
              >
                <div className="w-full md:w-3/5 text-left">
                  {card.badge && (
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.08em] mb-3"
                      style={{ background: "var(--primary-light)", color: "var(--primary)" }}
                    >
                      {card.badge}
                    </span>
                  )}
                  <h3 className="text-[24px] md:text-[28px] font-black mb-1" style={{ color: "var(--text-primary)" }}>
                    {card.title}
                  </h3>
                  {card.subtitle && (
                    <p className="text-[14px] font-semibold mb-4" style={{ color: "var(--primary)" }}>
                      {card.subtitle}
                    </p>
                  )}
                  <p className="text-[15px] md:text-[16px] leading-[1.7] mb-4" style={{ color: "var(--text-secondary)" }}>
                    {card.description}
                  </p>
                  <ul className="space-y-1.5">
                    {card.bullets.map((bullet, bulletIndex) => (
                      <li
                        key={`${card.id}-bullet-${bulletIndex}`}
                        className="flex items-start gap-2 text-[14px]"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--primary)" }} />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={card.href}
                    className="text-emerald-400 hover:text-emerald-300 font-medium inline-flex items-center gap-1 mt-6"
                  >
                    Xem thêm <ArrowUpRight className="w-4 h-4" />
                  </Link>
                </div>

                <div className="w-full md:w-2/5 flex items-center justify-center">
                  <img
                    src={card.imageUrl || "/logo.jpg"}
                    alt={card.imageAlt || card.title}
                    className="w-full max-w-sm h-auto object-contain rounded-lg shadow-2xl"
                    loading={isLoadingCards ? "eager" : "lazy"}
                  />
                </div>
              </article>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   5. PERFORMANCE / TRACK RECORD
───────────────────────────────────────────────────────────────────────────── */
interface BacktestSnapshot {
  generated_at: string;
  period: string;
  start_year: number;
  end_year: number;
  kpi: {
    total_return: number;
    win_rate: number;
    max_drawdown: number;
    total_trades: number;
    multiplier: number;
  };
}

function PerformanceSection() {
  const [snapshot, setSnapshot] = useState<BacktestSnapshot | null>(null);

  useEffect(() => {
    fetch("/data/latest-backtest-snapshot.json")
      .then((r) => r.json())
      .then((d) => setSnapshot(d))
      .catch(() => {});
  }, []);

  const kpi = snapshot?.kpi;
  const period = snapshot ? `${snapshot.start_year}-${snapshot.end_year}` : "2015-2025";
  const years = snapshot ? snapshot.end_year - snapshot.start_year : 10;
  const baseline = {
    totalReturn: 260,
    multiplier: 3.6,
    winRate: 60,
  };

  const metrics = [
    {
      label: "Lợi Nhuận Tích Lũy",
      value: kpi ? `+${kpi.total_return.toFixed(0)}%` : `+${baseline.totalReturn}%`,
      sub: `Giai đoạn ${period}${years ? ` (${years} năm)` : ""}`,
      Icon: TrendingUp,
    },
    {
      label: "Nhân Vốn",
      value: kpi ? `x${kpi.multiplier.toFixed(1)}` : `x${baseline.multiplier.toFixed(1)}`,
      sub: "Số lần nhân tài khoản (lãi kép)",
      Icon: Rocket,
    },
    {
      label: "Win Rate",
      value: kpi ? `${kpi.win_rate.toFixed(0)}%` : `${baseline.winRate}%`,
      sub: "Tỷ lệ tín hiệu chính xác",
      Icon: Zap,
    },
  ];

  return (
    <section
      className="px-5 md:px-12 py-24"
      style={{
        borderTop: "1px solid var(--border)",
        background: "var(--bg-page)",
      }}
    >
      <div className="max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-start">
          {/* Left: Text */}
          <FadeIn>
            <SectionLabel>Track Record</SectionLabel>
            <h2
              className="text-[32px] sm:text-[40px] font-bold leading-[1.2] mb-4"
              style={{ color: "var(--text-primary)" }}
            >
              Hiệu suất{" "}
              <span style={{ color: "var(--primary)" }}>thực chiến</span>
            </h2>
            <p
              className="text-[16px] leading-[1.7] mb-6"
              style={{ color: "var(--text-secondary)" }}
            >
              Kết quả backtest từ 2015 đến 2025 theo công thức của ADN Capital.
              Mọi tín hiệu đều được kiểm chứng thực tế trước khi đưa vào hệ thống.
            </p>
            <Link
              href="/backtest"
              className="inline-flex items-center gap-2 text-[14px] font-semibold transition-opacity hover:opacity-70"
              style={{ color: "var(--primary)" }}
            >
              Trải nghiệm Backtest Động <ArrowRight className="w-4 h-4" />
            </Link>
          </FadeIn>

          {/* Right: Metric cards */}
          <div className="space-y-4">
            {metrics.map((m, i) => (
              <FadeIn key={m.label} delay={i * 0.1}>
                <div
                  className="flex items-center gap-5 p-6 rounded-[14px]"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0"
                    style={{ background: "var(--primary-light)" }}
                  >
                    <m.Icon className="w-5 h-5" style={{ color: "var(--primary)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[12px] uppercase tracking-[0.08em] font-semibold mb-1"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {m.label}
                    </p>
                    <p
                      className="text-[36px] font-bold leading-none mb-1"
                      style={{ color: "var(--primary)" }}
                    >
                      {m.value}
                    </p>
                    <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                      {m.sub}
                    </p>
                  </div>
                </div>
              </FadeIn>
            ))}
            {snapshot?.generated_at && (
              <p className="text-[11px] text-right" style={{ color: "var(--text-muted)" }}>
                Cập nhật lúc 00:00 ngày {snapshot.generated_at.split(" ")[0]}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   6. PROCESS — CMS STEPS
───────────────────────────────────────────────────────────────────────────── */
interface LandingProcessStepUI {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  imageAlt: string | null;
}

const DEFAULT_PROCESS_STEPS: LandingProcessStepUI[] = [
  {
    id: "landing-process-register",
    title: "Đăng ký tài khoản",
    description: "Mở tài khoản chứng khoán miễn phí qua link giới thiệu của ADN Capital. Phí giao dịch ưu đãi từ 0.15%.",
    imageUrl: "/logo.jpg",
    imageAlt: "Bước đăng ký tài khoản",
  },
  {
    id: "landing-process-connect",
    title: "Kết nối hệ thống",
    description: "Đăng nhập ADN Capital bằng Google. Hệ thống tự động kích hoạt gói VIP khi xác nhận tài khoản.",
    imageUrl: "/logo.jpg",
    imageAlt: "Bước kết nối hệ thống",
  },
  {
    id: "landing-process-follow",
    title: "Theo dõi tín hiệu",
    description: "Nhận tín hiệu Mua/Bán đã được AI lọc. Dashboard hiển thị RS Rating và Market Score realtime.",
    imageUrl: "/logo.jpg",
    imageAlt: "Bước theo dõi tín hiệu",
  },
];

function ProcessSection() {
  const [steps, setSteps] = useState<LandingProcessStepUI[]>(DEFAULT_PROCESS_STEPS);
  const [isLoadingSteps, setIsLoadingSteps] = useState(true);

  useEffect(() => {
    let active = true;
    const loadSteps = async () => {
      try {
        const res = await fetch("/api/landing-process-steps", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { steps?: LandingProcessStepUI[] };
        const nextSteps = Array.isArray(data.steps) ? data.steps : [];
        if (active) {
          setSteps(nextSteps);
        }
      } catch {
        // fallback defaults already in state
      } finally {
        if (active) setIsLoadingSteps(false);
      }
    };
    void loadSteps();
    return () => {
      active = false;
    };
  }, []);

  const gridClassName =
    steps.length >= 3
      ? "grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6"
      : "grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-6";

  return (
    <section
      className="px-5 md:px-12 py-24 text-center"
      style={{
        borderTop: "1px solid var(--border)",
        background: "var(--bg-page)",
      }}
    >
      <div className="max-w-5xl mx-auto">
        <FadeIn>
          <SectionLabel>Process</SectionLabel>
          <h2
            className="text-[32px] sm:text-[40px] font-bold leading-[1.2] mb-14"
            style={{ color: "var(--text-primary)" }}
          >
            Quy trình{" "}
            <span style={{ color: "var(--primary)" }}>triển khai</span>
          </h2>
        </FadeIn>

        {steps.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Nội dung quy trình đang được cập nhật.
          </p>
        ) : (
          <div className={gridClassName}>
          {steps.map((step, i) => (
            <FadeIn key={step.id ?? `${step.title}-${i}`} delay={i * 0.12}>
              <div
                className="rounded-2xl border p-6 h-full flex flex-col items-center"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                <div className="w-full rounded-xl overflow-hidden border mb-5" style={{ borderColor: "var(--border)" }}>
                  <img
                    src={step.imageUrl || "/logo.jpg"}
                    alt={step.imageAlt || step.title}
                    className="w-full h-40 object-cover"
                    loading={isLoadingSteps ? "eager" : "lazy"}
                  />
                </div>
                {/* Step number circle */}
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-[24px] font-bold mb-4"
                  style={{
                    background: "var(--primary-light)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3
                  className="text-[18px] font-semibold mb-2"
                  style={{ color: "var(--text-primary)" }}
                >
                  {step.title}
                </h3>
                <p
                  className="text-[15px] leading-[1.6] max-w-[280px]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {step.description}
                </p>
              </div>
            </FadeIn>
          ))}
          </div>
        )}

        <FadeIn delay={0.5}>
          <div className="mt-14">
            <a
              href="https://s.dnse.vn/AhkV3Y"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-[10px] font-semibold text-[15px] transition-all hover:scale-[1.02]"
              style={{
                background: "var(--primary)",
                color: "var(--on-primary)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = "var(--primary-hover)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = "var(--primary)";
              }}
            >
              <UserPlus className="w-4 h-4" />
              Mở Tài Khoản Ngay
            </a>
            <p className="text-[12px] mt-2" style={{ color: "var(--text-muted)" }}>
              * Link giới thiệu DNSE — Đối tác của ADN Capital
            </p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   7. TESTIMONIALS
───────────────────────────────────────────────────────────────────────────── */
const TESTIMONIALS = [
  {
    name: "Anh Tuấn",
    role: "Nhà đầu tư cá nhân",
    text: "Hệ thống ADN giúp tôi tiết kiệm hàng giờ phân tích mỗi ngày. Tín hiệu chính xác, giao diện dễ dùng.",
    rating: 5,
  },
  {
    name: "Minh Nhật",
    role: "Trader full-time",
    text: "RS Rating và bản đồ tín hiệu là hai công cụ tôi dùng hàng ngày. Tối ưu đáng kể hiệu suất đầu tư.",
    rating: 5,
  },
  {
    name: "Bảo Ân",
    role: "Nhân viên ngân hàng",
    text: "Chat AI rất ấn tượng — phân tích kỹ thuật nhanh, chính xác. Cảm giác như có một trợ lý chuyên nghiệp 24/7.",
    rating: 5,
  },
];

function TestimonialsSection() {
  return (
    <section
      className="px-5 md:px-12 py-24"
      style={{
        borderTop: "1px solid var(--border)",
        background: "var(--bg-page)",
      }}
    >
      <div className="max-w-5xl mx-auto">
        <FadeIn>
          <div className="text-center mb-12">
            <SectionLabel>Testimonials</SectionLabel>
            <h2
              className="text-[32px] sm:text-[40px] font-bold leading-[1.2]"
              style={{ color: "var(--text-primary)" }}
            >
              Khách hàng{" "}
              <span style={{ color: "var(--primary)" }}>nói gì</span>
            </h2>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TESTIMONIALS.map((t, i) => (
            <FadeIn key={t.name} delay={i * 0.1}>
              <div
                className="glow-card h-full p-7 rounded-[14px] flex flex-col"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                }}
              >
                {/* Stars */}
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>

                <p
                  className="text-[16px] italic leading-[1.7] mb-6 flex-1"
                  style={{ color: "var(--text-secondary)" }}
                >
                  &ldquo;{t.text}&rdquo;
                </p>

                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{
                      background: "var(--primary-light)",
                      color: "var(--primary)",
                    }}
                  >
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
                      {t.name}
                    </p>
                    <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
                      {t.role}
                    </p>
                  </div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   8. PRICING — delegated to existing Pricing component (already uses tokens)
───────────────────────────────────────────────────────────────────────────── */
// Imported above as <Pricing />

/* ─────────────────────────────────────────────────────────────────────────────
   9. FAQ
───────────────────────────────────────────────────────────────────────────── */
const FAQS = [
  {
    q: "ADN Capital là gì?",
    a: "ADN Capital là hệ thống giao dịch thuật toán kết hợp AI, tự động quét tín hiệu mua/bán, phân tích kỹ thuật & quản trị rủi ro cho nhà đầu tư chứng khoán Việt Nam.",
  },
  {
    q: "Làm thế nào để sử dụng hệ thống?",
    a: "Bạn chỉ cần mở tài khoản chứng khoán qua link giới thiệu từ ADN Capital, đăng nhập bằng Google và hệ thống sẽ tự kích hoạt.",
  },
  {
    q: "Phí sử dụng hệ thống như thế nào?",
    a: "ADN Capital có cả gói miễn phí (FREE) và các gói VIP / Premium với nhiều tính năng nâng cao hơn. Xem chi tiết ở phần Bảng giá phía trên.",
  },
  {
    q: "Tín hiệu có chính xác không?",
    a: "Hệ thống được kiểm chứng qua backtest từ 2015–2025 với win rate trên 60%. Tuy nhiên, đầu tư chứng khoán luôn có rủi ro — kết quả quá khứ không đảm bảo tương lai.",
  },
  {
    q: "Tôi có thể hủy đăng ký bất cứ lúc nào không?",
    a: "Hoàn toàn có thể. Bạn có thể hủy gói VIP bất cứ lúc nào và chuyển về gói FREE mà không bị tính phí thêm.",
  },
];

function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section
      className="px-5 md:px-12 py-20"
      style={{
        borderTop: "1px solid var(--border)",
        background: "var(--bg-page)",
      }}
    >
      <div className="max-w-[720px] mx-auto">
        <FadeIn>
          <div className="text-center mb-10">
            <SectionLabel>FAQ</SectionLabel>
            <h2
              className="text-[32px] sm:text-[40px] font-bold leading-[1.2]"
              style={{ color: "var(--text-primary)" }}
            >
              Câu hỏi{" "}
              <span style={{ color: "var(--text-secondary)" }}>thường gặp</span>
            </h2>
          </div>
        </FadeIn>

        <div>
          {FAQS.map((faq, i) => (
            <FadeIn key={i} delay={i * 0.05}>
              <div
                style={{
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  className="w-full flex items-center justify-between py-5 text-left"
                >
                  <span
                    className="text-[16px] font-semibold pr-4"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {faq.q}
                  </span>
                  <span
                    className="flex-shrink-0 w-6 h-6 flex items-center justify-center"
                    style={{ color: "var(--primary)" }}
                  >
                    {open === i ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </span>
                </button>

                <AnimatePresence>
                  {open === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22 }}
                      className="overflow-hidden"
                    >
                      <p
                        className="pb-5 text-[15px] leading-[1.7]"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {faq.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   10. CTA CUỐI
───────────────────────────────────────────────────────────────────────────── */
function CTASection() {
  return (
    <section
      className="px-5 md:px-12 pb-20"
      style={{
        borderTop: "1px solid var(--border)",
        background: "var(--bg-page)",
      }}
    >
      <div className="max-w-5xl mx-auto">
        <FadeIn>
          <div
            className="rounded-[20px] px-8 py-20 md:px-20 text-center"
            style={{ background: "var(--primary)" }}
          >
            <h2 className="text-[32px] sm:text-[40px] font-bold leading-[1.2] text-white mb-4">
              Bắt đầu ngay hôm nay
            </h2>
            <p className="text-[17px] mb-8" style={{ color: "rgba(255,255,255,0.7)" }}>
              Đầu tư thông minh hơn với hệ thống ADN Capital.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href="https://s.dnse.vn/AhkV3Y"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-7 py-3.5 rounded-[10px] font-semibold text-[15px] transition-all hover:scale-[1.02] bg-white"
                style={{ color: "var(--primary)" }}
              >
                <UserPlus className="w-4 h-4" />
                Mở Tài Khoản Miễn Phí
                <ArrowUpRight className="w-4 h-4" />
              </a>
              <Link
                href="/auth"
                className="flex items-center gap-2 px-7 py-3.5 rounded-[10px] font-medium text-[15px] border border-white/25 text-white transition-all hover:bg-white/10"
              >
                Đăng nhập
              </Link>
            </div>

            <p className="text-[12px] mt-8" style={{ color: "rgba(255,255,255,0.5)" }}>
              Powered by <strong className="text-white">ADN CAPITAL</strong>
              {" · "}Hỗ trợ: admin@adncapital.vn
            </p>
            <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
              * Đầu tư chứng khoán luôn có rủi ro. Kết quả quá khứ không đảm bảo lợi nhuận tương lai.
            </p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

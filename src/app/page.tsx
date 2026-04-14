"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import Pricing from "@/components/landing/Pricing";
import { Footer } from "@/components/layout/Footer";
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

  return { count, ref };
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
        <a href="https://s.dnse.vn/AhkV3Y" target="_blank" rel="noopener noreferrer"
          className="hidden sm:inline-flex items-center px-5 py-2 rounded-[10px] text-[14px] font-semibold transition-all"
          style={{ background: "var(--primary)", color: "var(--text-primary)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--primary-hover)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--primary)"; }}>
          Mở TK
        </a>
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
              <a href="https://s.dnse.vn/AhkV3Y" target="_blank" rel="noopener noreferrer"
                className="flex-1 text-center py-2 rounded-[10px] text-[14px] font-semibold"
                style={{ background: "var(--primary)", color: "var(--text-primary)" }}>Mở TK</a>
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
      <LandingHeader />
      <div className="space-y-0">
        <HeroSection />
        <SocialProofTicker />
        <StatsSection />
        <FeaturesSection />
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
function HeroSection() {
  return (
    <section
      className="relative px-5 md:px-12 pt-28 pb-20 md:pt-36 md:pb-28 text-center overflow-hidden"
      style={{ background: "var(--bg-page)" }}
    >
      {/* Subtle background orb */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full pointer-events-none"
        style={{
          background: "var(--primary-light)",
          opacity: 0.55,
        }}
      />

      <div className="relative z-10 max-w-[820px] mx-auto">
        {/* Badge label */}
        <FadeIn>
          <div className="flex justify-center mb-7">
            <span
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[13px] font-medium uppercase tracking-[0.08em]"
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
              · ADN CAPITAL · QUANT TRADING SYSTEM
            </span>
          </div>
        </FadeIn>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.23, 1, 0.32, 1] }}
          className="text-[40px] sm:text-[56px] lg:text-[68px] font-bold leading-[1.1] tracking-tight mb-5"
        >
          <span style={{ color: "var(--text-primary)" }}>ĐẦU TƯ CÙNG</span>
          <br />
          <span style={{ color: "var(--primary)" }}>HỆ THỐNG ADN</span>
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
                color: "var(--text-primary)",
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

        {/* Hero dashboard image */}
        <FadeIn delay={0.6}>
          <div
            className="mt-16 rounded-2xl overflow-hidden mx-auto max-w-4xl"
            style={{
              border: "1px solid var(--border)",
              boxShadow: "0 24px 48px rgba(0,0,0,0.08)",
            }}
          >
            <Image
              src="/logo.jpg"
              alt="ADN Capital Dashboard"
              width={1200}
              height={675}
              className="w-full h-auto object-cover"
              priority
            />
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
  "DNSE Securities", "VN-Index 1,200+", "Market AI 24/7",
  "Backtest 2015→2025", "Win Rate 60%+", "ADN AI Broker",
  "Signal Map Real-time", "RS Rating System", "ART Indicator",
  "DNSE Securities", "VN-Index 1,200+", "Market AI 24/7",
  "Backtest 2015→2025", "Win Rate 60%+", "ADN AI Broker",
  "Signal Map Real-time", "RS Rating System", "ART Indicator",
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
const FEATURES = [
  {
    href: "/art",
    icon: Activity,
    badge: "MỚI",
    badgeStyle: "new" as const,
    title: "Chỉ báo ART",
    subtitle: "Analytical Reversal Tracker",
    desc: "Xác định điểm đảo chiều xu hướng thị trường. Đo lường mức độ cạn kiệt để nhận biết khi nào nên vào/thoát lệnh.",
    features: ["Gauge trực quan 0–5 điểm", "Biểu đồ lịch sử ART + MA7", "Hỗ trợ mọi mã CK", "Cập nhật theo phiên giao dịch"],
  },
  {
    href: "/terminal",
    icon: MessageSquare,
    badge: null,
    badgeStyle: null,
    title: "Tư vấn đầu tư",
    subtitle: "AI phân tích thông minh",
    desc: "Hỏi đáp phân tích kỹ thuật, cơ bản, tâm lý với AI chuyên sâu về thị trường chứng khoán Việt Nam 24/7.",
    features: ["Phân tích kỹ thuật theo yêu cầu", "Tóm tắt báo cáo tài chính", "Market sentiment & vĩ mô", "Luận điểm Long / Short"],
  },
  {
    href: "/dashboard/signal-map",
    icon: Zap,
    badge: null,
    badgeStyle: null,
    title: "ADN AI Broker",
    subtitle: "Tín hiệu mua/bán tự động",
    desc: "Nhận tín hiệu Mua/Bán theo hệ thống Quant Trading của ADN Capital — bộ lọc đa chiều, tối ưu cho VN.",
    features: ["Tín hiệu mua/bán tự động", "Bộ lọc Volume & RS cùng lúc", "Lịch sử tín hiệu đầy đủ", "Thông báo Real-time"],
  },
  {
    href: "/margin",
    icon: Banknote,
    badge: "HOT",
    badgeStyle: "hot" as const,
    title: "Ký Quỹ Margin",
    subtitle: "Lãi suất từ 5.99%/năm",
    desc: "Tư vấn miễn phí, phản hồi trong 2 giờ. Tối ưu đòn bẩy, quản lý tỷ lệ ký quỹ chuyên nghiệp.",
    features: ["Lãi suất từ 5.99%/năm", "Tư vấn miễn phí", "Phản hồi trong 2 giờ", "Quản lý ký quỹ chuyên nghiệp"],
  },
];

function FeatureBadge({ type }: { type: "new" | "hot" | null }) {
  if (!type) return null;
  const styles = {
    new: { background: "var(--primary-light)", color: "var(--primary)", border: "1px solid var(--border)" },
    hot: { background: "rgba(192,57,43,0.10)", color: "var(--danger)", border: "1px solid rgba(192,57,43,0.25)" },
  };
  return (
    <span
      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
      style={styles[type]}
    >
      {type === "new" ? "MỚI" : "HOT"}
    </span>
  );
}

function FeaturesSection() {
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
              Sản phẩm &amp; Dịch vụ
            </h2>
            <p
              className="text-[17px] max-w-[520px]"
              style={{ color: "var(--text-secondary)" }}
            >
              Hệ sinh thái công cụ đầu tư chứng khoán toàn diện — từ phân tích
              kỹ thuật, AI hỗ trợ đến tín hiệu giao dịch.
            </p>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <FadeIn key={f.href} delay={i * 0.08}>
                <Link href={f.href} className="block h-full">
                  <div
                    className="group h-full p-8 rounded-[14px] border transition-all duration-200 cursor-pointer"
                    style={{
                      background: "var(--surface)",
                      borderColor: "var(--border)",
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLDivElement;
                      el.style.borderColor = "var(--border-strong)";
                      el.style.transform = "translateY(-2px)";
                      el.style.boxShadow = "0 4px 16px rgba(46,77,61,0.08)";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLDivElement;
                      el.style.borderColor = "var(--border)";
                      el.style.transform = "translateY(0)";
                      el.style.boxShadow = "none";
                    }}
                  >
                    {/* Icon + badge */}
                    <div className="flex items-start justify-between mb-5">
                      <div
                        className="w-10 h-10 rounded-[10px] flex items-center justify-center"
                        style={{ background: "var(--primary-light)" }}
                      >
                        <Icon className="w-5 h-5" style={{ color: "var(--primary)" }} />
                      </div>
                      <FeatureBadge type={f.badgeStyle} />
                    </div>

                    {/* Title */}
                    <h3
                      className="text-[18px] font-semibold mb-1"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {f.title}
                    </h3>
                    <p
                      className="text-[13px] font-medium mb-3"
                      style={{ color: "var(--primary)" }}
                    >
                      {f.subtitle}
                    </p>

                    {/* Description */}
                    <p
                      className="text-[15px] leading-[1.6] mb-5"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {f.desc}
                    </p>

                    {/* Feature list */}
                    <ul className="space-y-1.5">
                      {f.features.map((feat) => (
                        <li
                          key={feat}
                          className="flex items-center gap-2 text-[13px]"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          <CheckCircle2
                            className="w-3.5 h-3.5 flex-shrink-0"
                            style={{ color: "var(--primary)" }}
                          />
                          {feat}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Link>
              </FadeIn>
            );
          })}
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
  const period = snapshot ? `${snapshot.start_year}–${snapshot.end_year}` : "...";
  const years = snapshot ? snapshot.end_year - snapshot.start_year : 0;

  const metrics = [
    {
      label: "Lợi Nhuận Tích Lũy",
      value: kpi ? `+${kpi.total_return.toFixed(0)}%` : "—",
      sub: `Giai đoạn ${period}${years ? ` (${years} năm)` : ""}`,
      Icon: TrendingUp,
    },
    {
      label: "Nhân Vốn",
      value: kpi ? `x${kpi.multiplier.toFixed(1)}` : "—",
      sub: "Số lần nhân tài khoản (lãi kép)",
      Icon: Rocket,
    },
    {
      label: "Win Rate",
      value: kpi ? `${kpi.win_rate.toFixed(0)}%` : "—",
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
   6. PROCESS — 3 BƯỚC
───────────────────────────────────────────────────────────────────────────── */
const STEPS = [
  {
    step: "01",
    title: "Đăng ký tài khoản",
    desc: "Mở tài khoản chứng khoán miễn phí qua link giới thiệu của ADN Capital. Phí giao dịch ưu đãi từ 0.15%.",
    Icon: UserPlus,
  },
  {
    step: "02",
    title: "Kết nối hệ thống",
    desc: "Đăng nhập ADN Capital bằng Google. Hệ thống tự động kích hoạt gói VIP khi xác nhận tài khoản.",
    Icon: Rocket,
  },
  {
    step: "03",
    title: "Theo dõi tín hiệu",
    desc: "Nhận tín hiệu Mua/Bán đã được AI lọc. Dashboard hiển thị RS Rating và Market Score realtime.",
    Icon: BarChart3,
  },
];

function ProcessSection() {
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
            <span style={{ color: "var(--primary)" }}>3 bước</span>
          </h2>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6 relative">
          {/* Connector line — desktop only */}
          <div className="hidden md:block absolute top-10 left-[20%] right-[20%] h-px"
            style={{ background: "var(--border)" }}
          />

          {STEPS.map((s, i) => (
            <FadeIn key={s.step} delay={i * 0.15}>
              <div className="flex flex-col items-center">
                {/* Step number circle */}
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-[32px] font-bold mb-6 relative z-10"
                  style={{
                    background: "var(--primary-light)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {s.step}
                </div>
                <h3
                  className="text-[18px] font-semibold mb-2"
                  style={{ color: "var(--text-primary)" }}
                >
                  {s.title}
                </h3>
                <p
                  className="text-[15px] leading-[1.6] max-w-[260px]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {s.desc}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.5}>
          <div className="mt-14">
            <a
              href="https://s.dnse.vn/AhkV3Y"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-[10px] font-semibold text-[15px] transition-all hover:scale-[1.02]"
              style={{
                background: "var(--primary)",
                color: "var(--text-primary)",
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

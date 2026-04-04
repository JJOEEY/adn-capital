"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { MainLayout } from "@/components/layout/MainLayout";
import Pricing from "@/components/landing/Pricing";
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
  BarChart2,
  ChevronDown,
  Shield,
  Target,
  Users,
  Award,
  Star,
} from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";

/* ═══════════════════════════════════════════════════════════════════════════
 *  LANDING PAGE — Ryza-inspired Full-scroll Sale Funnel
 *  Hero → Indicators → Performance → Services → Process → Testimonials →
 *  Pricing → Course → FAQ → CTA
 * ═══════════════════════════════════════════════════════════════════════════ */

export default function HomePage() {
  return (
    <MainLayout>
      <div className="space-y-0">
        <HeroSection />
        <IndicatorBanner />
        <PerformanceSection />
        <ServicesSection />
        <ProcessSection />
        <TestimonialSection />
        <Pricing />
        <CourseSection />
        <FAQSection />
        <FooterCTA />
      </div>
    </MainLayout>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Animated counter hook
 * ═══════════════════════════════════════════════════════════════════════════ */
function useCountUp(end: number, duration = 2000, start = 0) {
  const [count, setCount] = useState(start);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });

  useEffect(() => {
    if (!inView) return;
    let startTime: number | null = null;
    const step = (ts: number) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      setCount(Math.floor(progress * (end - start) + start));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, end, duration, start]);

  return { count, ref };
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  Section fade‑in wrapper
 * ═══════════════════════════════════════════════════════════════════════════ */
function FadeIn({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.23, 1, 0.32, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  HERO — Ryza-style bold typography + stats row
 * ═══════════════════════════════════════════════════════════════════════════ */
function HeroSection() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <section className="relative overflow-hidden py-24 sm:py-32 lg:py-40 px-4">
      {/* Big ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] bg-emerald-500/[0.04] rounded-full blur-[120px]" />
      <div className="absolute top-20 right-10 w-60 h-60 bg-cyan-500/[0.03] rounded-full blur-[100px]" />
      <div className="absolute bottom-10 left-10 w-40 h-40 bg-purple-500/[0.04] rounded-full blur-[80px]" />

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Badge */}
        <FadeIn>
          <div className="flex justify-center mb-6">
            <span className={`inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] px-4 py-1.5 rounded-full border ${
              isDark ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-emerald-600 bg-emerald-50 border-emerald-200"
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              ADN CAPITAL · Quant Trading System
            </span>
          </div>
        </FadeIn>

        {/* Main headline — Ryza bold split */}
        <FadeIn delay={0.1}>
          <h1 className="text-center">
            <span className={`block text-4xl sm:text-6xl lg:text-8xl font-black tracking-tight leading-[0.95] ${
              isDark ? "text-white" : "text-slate-900"
            }`}>
              ĐẦU TƯ CÙNG
            </span>
            <span className="block text-4xl sm:text-6xl lg:text-8xl font-black tracking-tight leading-[0.95] text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-400 mt-1">
              HỆ THỐNG ADN
            </span>
          </h1>
        </FadeIn>

        {/* Subheadline */}
        <FadeIn delay={0.2}>
          <p className={`text-center text-base sm:text-lg lg:text-xl max-w-2xl mx-auto mt-6 leading-relaxed ${
            isDark ? "text-white/50" : "text-slate-500"
          }`}>
            Hệ thống giao dịch thuật toán kết hợp AI — Tự động quét tín hiệu,
            quản trị rủi ro và bảo vệ danh mục 24/7.
          </p>
        </FadeIn>

        {/* CTA buttons */}
        <FadeIn delay={0.3}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-10">
            <a
              href="https://s.dnse.vn/HVxkDz"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-all hover:scale-[1.03] active:scale-[0.97] shadow-[0_0_30px_-5px_rgba(16,185,129,0.3)]"
            >
              <UserPlus className="w-4 h-4" />
              Mở Tài Khoản Ngay
              <ArrowUpRight className="w-4 h-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
            <Link
              href="/backtest"
              className={`group flex items-center gap-2 px-7 py-3.5 rounded-2xl border font-medium text-sm transition-all hover:scale-[1.02] ${
                isDark
                  ? "border-white/[0.1] text-white/70 hover:text-white hover:border-white/20 hover:bg-white/[0.04]"
                  : "border-slate-300 text-slate-600 hover:text-slate-900 hover:border-slate-400 hover:bg-slate-50"
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Xem Lịch Sử Lợi Nhuận
              <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  INDICATOR BANNER — Ryza-style animated counters
 * ═══════════════════════════════════════════════════════════════════════════ */
function IndicatorBanner() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const c1 = useCountUp(210, 2000);
  const c2 = useCountUp(29, 2000);
  const c3 = useCountUp(98, 2000);

  const stats = [
    { ref: c1.ref, val: `${c1.count}+`, label: "Tín hiệu đã xác nhận thành công" },
    { ref: c2.ref, val: `${c2.count}K`, label: "Lượt truy cập & sử dụng hệ thống" },
    { ref: c3.ref, val: `${c3.count}%`, label: "Tỷ lệ hài lòng từ khách hàng" },
  ];

  return (
    <section className={`py-10 px-4 border-y ${isDark ? "border-white/[0.06]" : "border-slate-200/60"}`}>
      <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-0 sm:divide-x sm:divide-white/[0.06]">
        {stats.map((s, i) => (
          <div key={i} ref={s.ref} className="text-center px-4">
            <p className="text-3xl sm:text-4xl lg:text-5xl font-black text-emerald-400">{s.val}</p>
            <p className={`text-xs sm:text-sm mt-1.5 ${isDark ? "text-white/40" : "text-slate-500"}`}>{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  PERFORMANCE — Track Record with backtest data (kept from original)
 * ═══════════════════════════════════════════════════════════════════════════ */
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
  const { theme } = useTheme();
  const isDark = theme === "dark";
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

  const cards = [
    {
      label: "Lợi Nhuận Tích Lũy",
      value: kpi ? `+${kpi.total_return.toFixed(0)}%` : "—",
      sub: `Giai đoạn ${period}${years ? ` (${years} năm)` : ""}`,
      Icon: TrendingUp,
      color: "text-emerald-400",
      border: isDark ? "border-emerald-500/20" : "border-emerald-300/40",
      bg: isDark ? "bg-emerald-500/[0.04]" : "bg-emerald-50/60",
    },
    {
      label: "Nhân Vốn",
      value: kpi ? `x${kpi.multiplier.toFixed(1)}` : "—",
      sub: "Số lần nhân tài khoản (lãi kép)",
      Icon: Rocket,
      color: "text-amber-400",
      border: isDark ? "border-amber-500/20" : "border-amber-300/40",
      bg: isDark ? "bg-amber-500/[0.04]" : "bg-amber-50/60",
    },
    {
      label: "Win Rate",
      value: kpi ? `${kpi.win_rate.toFixed(0)}%` : "—",
      sub: "Tỷ lệ tín hiệu chính xác",
      Icon: Zap,
      color: "text-purple-400",
      border: isDark ? "border-purple-500/20" : "border-purple-300/40",
      bg: isDark ? "bg-purple-500/[0.04]" : "bg-purple-50/60",
    },
  ];

  return (
    <section className={`py-20 px-4 border-t ${isDark ? "border-white/[0.06]" : "border-slate-200/60"}`}>
      <div className="max-w-5xl mx-auto">
        <FadeIn>
          <div className="text-center mb-12">
            <span className={`text-[10px] font-bold uppercase tracking-[0.3em] ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>
              Track Record
            </span>
            <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-black mt-3 ${isDark ? "text-white" : "text-slate-900"}`}>
              Hiệu suất{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                thực chiến
              </span>
            </h2>
            <p className={`text-sm mt-3 max-w-lg mx-auto ${isDark ? "text-white/40" : "text-slate-500"}`}>
              Kết quả backtest từ 2015 đến 2025 theo công thức của ADN Capital
            </p>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {cards.map((k, i) => (
            <FadeIn key={k.label} delay={i * 0.1}>
              <div className={`rounded-2xl border ${k.border} ${k.bg} p-6 text-center hover:scale-[1.03] transition-all duration-300 backdrop-blur-sm`}>
                <k.Icon className={`w-6 h-6 ${k.color} mx-auto mb-3`} />
                <p className={`text-3xl sm:text-4xl font-black ${k.color}`}>{k.value}</p>
                <p className={`text-xs font-bold mt-2 uppercase ${isDark ? "text-white/70" : "text-slate-700"}`}>{k.label}</p>
                <p className={`text-[10px] mt-1 ${isDark ? "text-white/30" : "text-slate-400"}`}>{k.sub}</p>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn>
          <div className="text-center">
            <Link href="/backtest"
              className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
              Trải nghiệm Backtest Động <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </FadeIn>

        {snapshot?.generated_at && (
          <p className={`text-[9px] text-center mt-4 ${isDark ? "text-white/20" : "text-slate-400"}`}>
            Dữ liệu được cập nhật tự động vào 00:00 ngày {snapshot.generated_at.split(" ")[0]}
          </p>
        )}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  SERVICES — San Pham content (moved from /san-pham)
 * ═══════════════════════════════════════════════════════════════════════════ */
const services = [
  {
    href: "/dashboard/rs-rating",
    icon: BarChart2,
    iconColor: "text-blue-400",
    gradientFrom: "from-blue-500/10",
    badge: null,
    title: "RS Rating",
    subtitle: "Xếp hạng sức mạnh tương đối",
    desc: "Chấm điểm sức mạnh cổ phiếu so với toàn thị trường. Tìm cổ phiếu dẫn dắt, tránh cổ phiếu yếu — theo phương pháp William O'Neil / CAN SLIM.",
    features: ["RS Score 1–99 cho từng mã", "Cập nhật theo phiên giao dịch", "Lọc theo ngành / nhóm cốt lõi", "Top leaders & laggards"],
  },
  {
    href: "/terminal",
    icon: MessageSquare,
    iconColor: "text-emerald-400",
    gradientFrom: "from-emerald-500/10",
    badge: "HOT",
    title: "Chat AI",
    subtitle: "Trợ lý đầu tư thông minh",
    desc: "Hỏi đáp phân tích kỹ thuật, cơ bản, vĩ mô với AI chuyên sâu về thị trường chứng khoán Việt Nam.",
    features: ["Phân tích kỹ thuật theo yêu cầu", "Tóm tắt báo cáo tài chính", "Market sentiment & vĩ mô", "Luận điểm Long / Short"],
  },
  {
    href: "/dashboard/signal-map",
    icon: Zap,
    iconColor: "text-yellow-400",
    gradientFrom: "from-yellow-500/10",
    badge: null,
    title: "Tín Hiệu",
    subtitle: "Bản đồ tín hiệu giao dịch",
    desc: "Nhận tín hiệu mua/bán theo hệ thống Quant Trading của ADN Capital — bộ lọc đa chiều, tối ưu cho VN.",
    features: ["Tín hiệu mua/bán tự động", "Bộ lọc Volume & RS cùng lúc", "Lịch sử tín hiệu đầy đủ", "Thông báo theo thời gian thực"],
  },
];

function ServicesSection() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <section className={`py-20 px-4 border-t ${isDark ? "border-white/[0.06]" : "border-slate-200/60"}`}>
      <div className="max-w-6xl mx-auto">
        <FadeIn>
          <div className="text-center mb-14">
            <span className={`text-[10px] font-bold uppercase tracking-[0.3em] ${isDark ? "text-blue-400" : "text-blue-600"}`}>
              Platform
            </span>
            <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-black mt-3 ${isDark ? "text-white" : "text-slate-900"}`}>
              Sản phẩm &{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                Dịch vụ
              </span>
            </h2>
            <p className={`text-sm mt-3 max-w-lg mx-auto ${isDark ? "text-white/40" : "text-slate-500"}`}>
              Hệ sinh thái công cụ đầu tư chứng khoán toàn diện — từ phân tích kỹ thuật, AI hỗ trợ đến tín hiệu giao dịch.
            </p>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {services.map((svc, i) => {
            const Icon = svc.icon;
            return (
              <FadeIn key={svc.href} delay={i * 0.1}>
                <Link href={svc.href}>
                  <div className={`group relative h-full rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl cursor-pointer ${
                    isDark
                      ? "bg-white/[0.03] backdrop-blur-xl border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.05]"
                      : "bg-white/60 backdrop-blur-xl border-white/50 hover:border-slate-300 hover:bg-white/80"
                  }`}>
                    {svc.badge && (
                      <span className="absolute top-4 right-4 text-[9px] font-black text-emerald-400 bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 rounded-full tracking-widest">
                        {svc.badge}
                      </span>
                    )}
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 transition-transform group-hover:scale-110 duration-300 ${
                      isDark ? "bg-white/[0.06] border border-white/[0.1]" : "bg-slate-100 border border-slate-200"
                    }`}>
                      <Icon className={`w-6 h-6 ${svc.iconColor}`} />
                    </div>
                    <h3 className={`text-lg font-black mb-0.5 ${isDark ? "text-white" : "text-slate-900"}`}>{svc.title}</h3>
                    <p className={`text-xs mb-4 ${isDark ? "text-white/35" : "text-slate-400"}`}>{svc.subtitle}</p>
                    <p className={`text-sm leading-relaxed mb-5 ${isDark ? "text-white/50" : "text-slate-500"}`}>{svc.desc}</p>
                    <ul className="space-y-2 mb-5">
                      {svc.features.map((f) => (
                        <li key={f} className={`flex items-center gap-2 text-xs ${isDark ? "text-white/40" : "text-slate-500"}`}>
                          <span className={`w-1 h-1 rounded-full flex-shrink-0 ${svc.iconColor.replace("text-", "bg-")}`} />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <div className={`flex items-center gap-1 text-xs font-bold ${svc.iconColor} group-hover:gap-2 transition-all`}>
                      Xem ngay <ArrowRight className="w-3 h-3" />
                    </div>
                  </div>
                </Link>
              </FadeIn>
            );
          })}
        </div>

        {/* Margin CTA */}
        <FadeIn delay={0.3}>
          <div className={`mt-8 rounded-2xl border p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 ${
            isDark
              ? "bg-white/[0.03] backdrop-blur-xl border-white/[0.08]"
              : "bg-white/60 backdrop-blur-xl border-white/50"
          }`}>
            <div className={`w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center ${
              isDark ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-emerald-50 border border-emerald-200"
            }`}>
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1">
              <h3 className={`text-sm font-black mb-0.5 ${isDark ? "text-white" : "text-slate-900"}`}>Ký Quỹ Margin</h3>
              <p className={`text-xs ${isDark ? "text-white/40" : "text-slate-500"}`}>
                Lãi suất từ 5,99%/năm — Tư vấn miễn phí, phản hồi trong 2 giờ.
              </p>
            </div>
            <Link href="/margin">
              <button className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black transition-all cursor-pointer">
                Đăng ký tư vấn <ArrowRight className="w-3 h-3" />
              </button>
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  PROCESS — Ryza "Approach Plan" style numbered steps
 * ═══════════════════════════════════════════════════════════════════════════ */
const STEPS = [
  {
    step: "01",
    title: "Đăng ký tài khoản",
    desc: "Mở tài khoản chứng khoán miễn phí qua link giới thiệu của ADN Capital. Phí giao dịch ưu đãi từ 0.15%.",
    Icon: UserPlus,
    pct: "30%",
  },
  {
    step: "02",
    title: "Kết nối hệ thống",
    desc: "Đăng nhập ADN Capital bằng Google. Hệ thống tự động kích hoạt gói VIP khi xác nhận tài khoản.",
    Icon: Rocket,
    pct: "60%",
  },
  {
    step: "03",
    title: "Theo dõi tín hiệu",
    desc: "Nhận tín hiệu Mua/Bán đã được AI lọc. Dashboard hiển thị Cầu Dao Tổng, RS Rating, và Market Score realtime.",
    Icon: BarChart3,
    pct: "100%",
  },
];

function ProcessSection() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <section className={`py-20 px-4 border-t ${isDark ? "border-white/[0.06]" : "border-slate-200/60"}`}>
      <div className="max-w-5xl mx-auto">
        <FadeIn>
          <div className="text-center mb-14">
            <span className={`text-[10px] font-bold uppercase tracking-[0.3em] ${isDark ? "text-cyan-400" : "text-cyan-600"}`}>
              Process
            </span>
            <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-black mt-3 ${isDark ? "text-white" : "text-slate-900"}`}>
              Quy trình{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">
                3 bước
              </span>
            </h2>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {STEPS.map((s, i) => (
            <FadeIn key={s.step} delay={i * 0.12}>
              <div className={`relative rounded-2xl border p-6 h-full transition-all duration-300 hover:scale-[1.02] ${
                isDark
                  ? "bg-white/[0.03] backdrop-blur-xl border-white/[0.08] hover:border-white/[0.15]"
                  : "bg-white/60 backdrop-blur-xl border-white/50 hover:border-slate-300"
              }`}>
                {/* Step number — big & faded */}
                <span className={`absolute top-4 right-5 text-5xl font-black ${isDark ? "text-white/[0.04]" : "text-slate-200/60"}`}>
                  {s.step}
                </span>

                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <span className={`flex items-center justify-center w-9 h-9 rounded-xl text-sm font-black ${
                      isDark ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" : "bg-emerald-50 border border-emerald-200 text-emerald-600"
                    }`}>
                      {s.step}
                    </span>
                    <s.Icon className={`w-5 h-5 ${isDark ? "text-white/30" : "text-slate-400"}`} />
                  </div>
                  <h3 className={`text-sm font-bold mb-2 ${isDark ? "text-white" : "text-slate-900"}`}>{s.title}</h3>
                  <p className={`text-xs leading-relaxed ${isDark ? "text-white/40" : "text-slate-500"}`}>{s.desc}</p>

                  {/* Progress bar */}
                  <div className={`mt-4 h-1 rounded-full overflow-hidden ${isDark ? "bg-white/[0.06]" : "bg-slate-200"}`}>
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                      initial={{ width: 0 }}
                      whileInView={{ width: s.pct }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, delay: 0.3 + i * 0.2, ease: "easeOut" }}
                    />
                  </div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.4}>
          <div className="text-center mt-10">
            <a
              href="https://s.dnse.vn/HVxkDz"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-all hover:scale-105"
            >
              <UserPlus className="w-4 h-4" />
              Mở Tài Khoản Ngay
            </a>
            <p className={`text-[10px] mt-2 ${isDark ? "text-white/20" : "text-slate-400"}`}>
              * Link giới thiệu DNSE — Đối tác của ADN Capital
            </p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  TESTIMONIALS — Ryza "What People Say" style
 * ═══════════════════════════════════════════════════════════════════════════ */
const testimonials = [
  {
    name: "Minh Tuấn",
    role: "Nhà đầu tư cá nhân",
    text: "Hệ thống ADN giúp tôi tiết kiệm hàng giờ phân tích mỗi ngày. Tín hiệu chính xác, giao diện dễ dùng.",
    rating: 5,
  },
  {
    name: "Thanh Huyền",
    role: "Quản lý danh mục",
    text: "RS Rating và bản đồ tín hiệu là hai công cụ tôi dùng hàng ngày. Tối ưu đáng kể hiệu suất đầu tư.",
    rating: 5,
  },
  {
    name: "Đức Anh",
    role: "Trader full-time",
    text: "Chat AI rất ấn tượng — phân tích kỹ thuật nhanh, chính xác. Cảm giác như có một trợ lý chuyên nghiệp 24/7.",
    rating: 5,
  },
];

function TestimonialSection() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <section className={`py-20 px-4 border-t ${isDark ? "border-white/[0.06]" : "border-slate-200/60"}`}>
      <div className="max-w-5xl mx-auto">
        <FadeIn>
          <div className="text-center mb-14">
            <span className={`text-[10px] font-bold uppercase tracking-[0.3em] ${isDark ? "text-purple-400" : "text-purple-600"}`}>
              Testimonials
            </span>
            <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-black mt-3 ${isDark ? "text-white" : "text-slate-900"}`}>
              Khách hàng{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                nói gì
              </span>
            </h2>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {testimonials.map((t, i) => (
            <FadeIn key={t.name} delay={i * 0.1}>
              <div className={`rounded-2xl border p-6 h-full transition-all duration-300 hover:scale-[1.02] ${
                isDark
                  ? "bg-white/[0.03] backdrop-blur-xl border-white/[0.08] hover:border-white/[0.15]"
                  : "bg-white/60 backdrop-blur-xl border-white/50 hover:border-slate-300"
              }`}>
                {/* Stars */}
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>

                <p className={`text-sm leading-relaxed mb-6 italic ${isDark ? "text-white/60" : "text-slate-600"}`}>
                  &ldquo;{t.text}&rdquo;
                </p>

                <div className="flex items-center gap-3 mt-auto">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black ${
                    isDark ? "bg-white/[0.08] text-white/60" : "bg-slate-100 text-slate-600"
                  }`}>
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className={`text-xs font-bold ${isDark ? "text-white/80" : "text-slate-800"}`}>{t.name}</p>
                    <p className={`text-[10px] ${isDark ? "text-white/30" : "text-slate-400"}`}>{t.role}</p>
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

/* ═══════════════════════════════════════════════════════════════════════════
 *  COURSE — Đăng ký khóa học (kept from original)
 * ═══════════════════════════════════════════════════════════════════════════ */
function CourseSection() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [name, setName] = useState("");
  const [zalo, setZalo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !zalo.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/course-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), zalo: zalo.trim() }),
      });
      if (!res.ok) throw new Error("Lỗi đăng ký");
      setDone(true);
    } catch {
      setError("Đăng ký thất bại, vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className={`py-20 px-4 border-t ${isDark ? "border-white/[0.06]" : "border-slate-200/60"}`}>
      <div className="max-w-3xl mx-auto">
        <FadeIn>
          <div className={`relative overflow-hidden rounded-2xl border p-6 sm:p-10 ${
            isDark
              ? "bg-white/[0.03] backdrop-blur-xl border-white/[0.08]"
              : "bg-white/60 backdrop-blur-xl border-white/50"
          }`}>
            <div className="absolute -top-16 -right-16 w-48 h-48 bg-purple-500/[0.04] rounded-full blur-3xl" />

            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-5 h-5 text-purple-400" />
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-[0.2em]">
                  Khóa Học
                </span>
              </div>

              <h2 className={`text-xl sm:text-2xl font-black mb-2 ${isDark ? "text-white" : "text-slate-900"}`}>
                Hiểu Rõ Bản Chất Của Đầu Tư
              </h2>
              <p className={`text-sm leading-relaxed mb-6 ${isDark ? "text-white/50" : "text-slate-500"}`}>
                Khóa học toàn diện về giao dịch thực chiến — nắm bắt cơ hội đầu tư từ con số 0,
                quản trị rủi ro và xây dựng danh mục.
              </p>

              {done ? (
                <div className={`flex items-center gap-3 rounded-xl p-4 ${
                  isDark ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-emerald-50 border border-emerald-200"
                }`}>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-emerald-400">Đăng ký thành công!</p>
                    <p className={`text-xs ${isDark ? "text-white/40" : "text-slate-500"}`}>Admin sẽ liên hệ qua Zalo trong 24h.</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input type="text" placeholder="Họ và tên" value={name} onChange={(e) => setName(e.target.value)}
                      required maxLength={100}
                      className={`w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none transition-colors ${
                        isDark
                          ? "bg-white/[0.04] border border-white/[0.1] text-white placeholder-white/30 focus:border-emerald-500/50"
                          : "bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-500/50"
                      }`}
                    />
                    <input type="text" placeholder="Số Zalo" value={zalo} onChange={(e) => setZalo(e.target.value)}
                      required maxLength={15}
                      className={`w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none transition-colors ${
                        isDark
                          ? "bg-white/[0.04] border border-white/[0.1] text-white placeholder-white/30 focus:border-emerald-500/50"
                          : "bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-500/50"
                      }`}
                    />
                  </div>
                  {error && <p className="text-xs text-red-400">{error}</p>}
                  <button type="submit" disabled={submitting}
                    className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-sm transition-all">
                    {submitting ? "Đang gửi..." : "Đăng Ký Khóa Học"}
                    {!submitting && <ArrowRight className="w-3.5 h-3.5" />}
                  </button>
                </form>
              )}
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 *  FAQ — Ryza "Ask Us Anything" style accordion
 * ═══════════════════════════════════════════════════════════════════════════ */
const faqs = [
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
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className={`py-20 px-4 border-t ${isDark ? "border-white/[0.06]" : "border-slate-200/60"}`}>
      <div className="max-w-3xl mx-auto">
        <FadeIn>
          <div className="text-center mb-14">
            <span className={`text-[10px] font-bold uppercase tracking-[0.3em] ${isDark ? "text-amber-400" : "text-amber-600"}`}>
              FAQ
            </span>
            <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-black mt-3 ${isDark ? "text-white" : "text-slate-900"}`}>
              Câu hỏi{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">
                thường gặp
              </span>
            </h2>
          </div>
        </FadeIn>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <FadeIn key={i} delay={i * 0.06}>
              <div className={`rounded-2xl border overflow-hidden transition-all duration-300 ${
                isDark
                  ? "bg-white/[0.03] backdrop-blur-xl border-white/[0.08] hover:border-white/[0.12]"
                  : "bg-white/60 backdrop-blur-xl border-white/50 hover:border-slate-300"
              }`}>
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  className={`w-full flex items-center justify-between px-5 py-4 text-left transition-colors ${
                    isDark ? "text-white/80 hover:text-white" : "text-slate-700 hover:text-slate-900"
                  }`}
                >
                  <span className="text-sm font-bold pr-4">{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-300 ${open === i ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {open === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <p className={`px-5 pb-4 text-sm leading-relaxed ${isDark ? "text-white/45" : "text-slate-500"}`}>
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

/* ═══════════════════════════════════════════════════════════════════════════
 *  FOOTER CTA — Ryza "Let's Work Together" style
 * ═══════════════════════════════════════════════════════════════════════════ */
function FooterCTA() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <section className={`py-20 px-4 border-t ${isDark ? "border-white/[0.06]" : "border-slate-200/60"}`}>
      <div className="max-w-3xl mx-auto text-center">
        <FadeIn>
          <h2 className={`text-3xl sm:text-4xl lg:text-5xl font-black mb-4 ${isDark ? "text-white" : "text-slate-900"}`}>
            Bắt đầu{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
              ngay hôm nay
            </span>
          </h2>
          <p className={`text-sm mb-8 ${isDark ? "text-white/40" : "text-slate-500"}`}>
            Đầu tư thông minh hơn với hệ thống ADN Capital.
          </p>
          <a
            href="https://s.dnse.vn/HVxkDz"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-all hover:scale-[1.03] shadow-[0_0_40px_-8px_rgba(16,185,129,0.3)]"
          >
            <UserPlus className="w-4 h-4" />
            Mở Tài Khoản Miễn Phí
            <ArrowUpRight className="w-4 h-4" />
          </a>
        </FadeIn>
        <FadeIn delay={0.2}>
          <p className={`text-xs mt-8 ${isDark ? "text-white/20" : "text-slate-400"}`}>
            Powered by{" "}
            <span className="text-emerald-500/70 font-bold">ADN CAPITAL</span>
            {" · "}Hỗ trợ: admin@adncapital.vn
          </p>
          <p className={`text-[9px] mt-2 ${isDark ? "text-white/15" : "text-slate-400"}`}>
            * Đầu tư chứng khoán luôn có rủi ro. Kết quả quá khứ không đảm bảo lợi nhuận tương lai.
          </p>
        </FadeIn>
      </div>
    </section>
  );
}

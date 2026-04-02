"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MainLayout } from "@/components/layout/MainLayout";
import Pricing from "@/components/landing/Pricing";
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
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
 *  LANDING PAGE — Sale Funnel cuộn dọc
 *  Hero → Performance → Guide → Course
 * ═══════════════════════════════════════════════════════════════════════════ */

export default function HomePage() {
  return (
    <MainLayout>
      <div className="space-y-0">
        <HeroSection />
        <PerformanceSection />
        <GuideSection />
        <Pricing />
        <CourseSection />
        <FooterCTA />
      </div>
    </MainLayout>
  );
}

/* ── HERO ─────────────────────────────────────────────────────────────── */
function HeroSection() {
  return (
    <section className="relative overflow-hidden py-20 sm:py-28 px-4">
      {/* Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-emerald-500/5 rounded-full blur-3xl" />
      <div className="absolute top-20 right-10 w-40 h-40 bg-cyan-500/5 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-4xl mx-auto text-center">
        <span className="inline-block text-[10px] font-bold text-emerald-400 uppercase tracking-[0.3em] mb-4 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
          ADN CAPITAL · Quant Trading System
        </span>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white leading-tight">
          ĐẦU TƯ CÙNG HỆ THỐNG
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-400">
            ADN SYSTEM
          </span>
        </h1>

        <p className="text-base sm:text-lg text-neutral-400 mt-5 max-w-2xl mx-auto leading-relaxed">
          Hệ thống giao dịch thuật toán kết hợp AI — Tự động quét tín hiệu,
          quản trị rủi ro và bảo vệ danh mục.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
          <a
            href="https://s.dnse.vn/HVxkDz"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-all hover:scale-105 active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            Mở Tài Khoản Ngay
          </a>
          <Link
            href="/backtest"
            className="flex items-center gap-2 px-6 py-3 rounded-xl border border-neutral-700 hover:border-neutral-500 text-neutral-300 hover:text-white font-medium text-sm transition-all hover:bg-neutral-800/50"
          >
            <BarChart3 className="w-4 h-4" />
            Xem Lịch Sử Lợi Nhuận
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── PERFORMANCE ──────────────────────────────────────────────────────── */
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
  const period = snapshot
    ? `${snapshot.start_year}–${snapshot.end_year}`
    : "...";
  const years = snapshot
    ? snapshot.end_year - snapshot.start_year
    : 0;

  const cards = [
    {
      label: "Lợi Nhuận Tích Lũy",
      value: kpi ? `+${kpi.total_return.toFixed(0)}%` : "—",
      sub: `Giai đoạn ${period}${years ? ` (${years} năm)` : ""}`,
      Icon: TrendingUp,
      color: "text-emerald-400",
      border: "border-emerald-500/20",
      bg: "bg-emerald-500/5",
    },
    {
      label: "Nhân Vốn",
      value: kpi ? `x${kpi.multiplier.toFixed(1)}` : "—",
      sub: "Số lần nhân tài khoản (lãi kép)",
      Icon: Rocket,
      color: "text-amber-400",
      border: "border-amber-500/20",
      bg: "bg-amber-500/5",
    },
    {
      label: "Win Rate",
      value: kpi ? `${kpi.win_rate.toFixed(0)}%` : "—",
      sub: "Tỷ lệ tín hiệu chính xác",
      Icon: Zap,
      color: "text-purple-400",
      border: "border-purple-500/20",
      bg: "bg-purple-500/5",
    },
  ];

  return (
    <section className="py-16 px-4 border-t border-neutral-800/50">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.3em]">
            Track Record
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white mt-2">
            Hiệu suất thực chiến
          </h2>
          <p className="text-sm text-neutral-500 mt-2">
            Kết quả backtest từ 2015 đến 2025 theo công thức của ADN Capital
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {cards.map((k) => (
            <div
              key={k.label}
              className={`rounded-2xl border ${k.border} ${k.bg} p-6 text-center hover:scale-[1.02] transition-transform`}
            >
              <k.Icon className={`w-6 h-6 ${k.color} mx-auto mb-3`} />
              <p className={`text-3xl sm:text-4xl font-black ${k.color}`}>
                {k.value}
              </p>
              <p className="text-xs font-bold text-neutral-300 mt-2 uppercase">
                {k.label}
              </p>
              <p className="text-[10px] text-neutral-500 mt-1">{k.sub}</p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Link
            href="/backtest"
            className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
          >
            Trải nghiệm Backtest Động
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {snapshot?.generated_at && (
          <p className="text-[9px] text-neutral-600 text-center mt-4">
            Dữ liệu được cập nhật tự động vào 00:00 ngày {snapshot.generated_at.split(" ")[0]}
          </p>
        )}
      </div>
    </section>
  );
}

/* ── GUIDE — 3 bước mở tài khoản ─────────────────────────────────────── */
const STEPS = [
  {
    step: 1,
    title: "Đăng ký tài khoản",
    desc: "Mở tài khoản chứng khoán miễn phí qua link giới thiệu của ADN Capital. Phí giao dịch ưu đãi từ 0.15%.",
    Icon: UserPlus,
  },
  {
    step: 2,
    title: "Kết nối hệ thống",
    desc: "Đăng nhập ADN Capital bằng Google. Hệ thống tự động kích hoạt gói VIP khi xác nhận tài khoản.",
    Icon: Rocket,
  },
  {
    step: 3,
    title: "Theo dõi tín hiệu",
    desc: "Nhận tín hiệu Mua/Bán đã được AI lọc. Dashboard hiển thị Cầu Dao Tổng, RS Rating, và Market Score realtime.",
    Icon: BarChart3,
  },
];

function GuideSection() {
  return (
    <section id="guide" className="py-16 px-4 border-t border-neutral-800/50 scroll-mt-16">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-[0.3em]">
            Hướng Dẫn
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white mt-2">
            3 bước bắt đầu
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {STEPS.map((s) => (
            <div
              key={s.step}
              className="relative rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 hover:border-neutral-700 transition-colors"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-black">
                  {s.step}
                </span>
                <s.Icon className="w-5 h-5 text-neutral-500" />
              </div>
              <h3 className="text-sm font-bold text-white mb-2">{s.title}</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <a
            href="https://s.dnse.vn/HVxkDz"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-all hover:scale-105"
          >
            <UserPlus className="w-4 h-4" />
            Mở Tài Khoản Ngay
          </a>
          <p className="text-[10px] text-neutral-600 mt-2">
            * Link giới thiệu DNSE — Đối tác của ADN Capital
          </p>
        </div>
      </div>
    </section>
  );
}

/* ── COURSE — Đăng ký khóa học ────────────────────────────────────────── */
function CourseSection() {
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
    <section id="course" className="py-16 px-4 border-t border-neutral-800/50 scroll-mt-16">
      <div className="max-w-3xl mx-auto">
        <div className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/80 p-6 sm:p-10">
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-purple-500/5 rounded-full blur-3xl" />

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-5 h-5 text-purple-400" />
              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-[0.2em]">
                Khóa Học
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white mb-2">
              Hiểu Rõ Bản Chất Của Đầu Tư
            </h2>
            <p className="text-sm text-neutral-400 leading-relaxed mb-6">
              Khóa học toàn diện về giao dịch thực chiến — nắm bắt cơ hội đầu tư từ con số 0,
              quản trị rủi ro và xây dựng danh mục.
            </p>

            {done ? (
              <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-emerald-400">
                    Đăng ký thành công!
                  </p>
                  <p className="text-xs text-neutral-400">
                    Admin sẽ liên hệ qua Zalo trong 24h.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Họ và tên"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={100}
                    className="w-full px-4 py-2.5 rounded-lg bg-neutral-800 border border-neutral-700 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                  <input
                    type="text"
                    placeholder="Số Zalo"
                    value={zalo}
                    onChange={(e) => setZalo(e.target.value)}
                    required
                    maxLength={15}
                    className="w-full px-4 py-2.5 rounded-lg bg-neutral-800 border border-neutral-700 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                </div>
                {error && (
                  <p className="text-xs text-red-400">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-sm transition-all"
                >
                  {submitting ? "Đang gửi..." : "Đăng Ký Khóa Học"}
                  {!submitting && <ArrowRight className="w-3.5 h-3.5" />}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── FOOTER CTA ───────────────────────────────────────────────────────── */
function FooterCTA() {
  return (
    <section className="py-12 px-4 border-t border-neutral-800/50">
      <div className="max-w-3xl mx-auto text-center">
        <p className="text-xs text-neutral-600">
          Powered by{" "}
          <span className="text-emerald-500/70 font-bold">ADN CAPITAL</span>
          {" · "}Hỗ trợ: admin@adncapital.vn
        </p>
        <p className="text-[9px] text-neutral-700 mt-2">
          * Đầu tư chứng khoán luôn có rủi ro. Kết quả quá khứ không đảm bảo lợi nhuận tương lai.
        </p>
      </div>
    </section>
  );
}

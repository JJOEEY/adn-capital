"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  Menu,
  Moon,
  Radar,
  ShieldCheck,
  Sun,
  X,
} from "lucide-react";
import { Footer } from "@/components/layout/Footer";
import { useTheme } from "@/components/providers/ThemeProvider";
import { PwaEntryRedirect } from "@/components/pwa/PwaEntryRedirect";
import { BRAND, PRODUCT_DESCRIPTIONS, PRODUCT_NAMES } from "@/lib/brand/productNames";

const navLinks = [
  { href: "#workflow", label: "Quy trình" },
  { href: "#products", label: "Sản phẩm" },
  { href: "#safety", label: "Kỷ luật" },
  { href: "/pricing", label: "Bảng giá" },
];

const workflowSteps = [
  {
    title: "Phân tích dữ liệu",
    body: "Theo dõi chỉ số, thanh khoản, độ rộng thị trường, tin tức và tín hiệu trong một màn hình thống nhất.",
    icon: BarChart3,
  },
  {
    title: "Giữ kỷ luật",
    body: "Mỗi cơ hội có vùng tham khảo, mục tiêu, cắt lỗ và tỷ trọng để hạn chế quyết định cảm tính.",
    icon: ShieldCheck,
  },
  {
    title: "Theo dõi danh mục",
    body: "Trạng thái quan sát, đang nắm giữ và đã kết thúc được tách rõ để kiểm tra rủi ro nhanh hơn.",
    icon: Activity,
  },
  {
    title: "Hành động an toàn",
    body: "AI hỗ trợ giải thích và cá nhân hóa. Nhà đầu tư luôn là người xác nhận quyết định cuối cùng.",
    icon: CheckCircle2,
  },
];

const productCards = [
  {
    name: PRODUCT_NAMES.dashboard,
    label: "Tổng quan thị trường",
    body: PRODUCT_DESCRIPTIONS.dashboard,
    href: "/dashboard",
    icon: BarChart3,
  },
  {
    name: PRODUCT_NAMES.brokerWorkflow,
    label: "Theo dõi cơ hội",
    body: PRODUCT_DESCRIPTIONS.brokerWorkflow,
    href: "/dashboard/signal-map",
    icon: Radar,
  },
  {
    name: PRODUCT_NAMES.art,
    label: "Đảo chiều và rủi ro",
    body: PRODUCT_DESCRIPTIONS.art,
    href: "/art",
    icon: Activity,
  },
  {
    name: PRODUCT_NAMES.advisory,
    label: "Trợ lý đầu tư",
    body: PRODUCT_DESCRIPTIONS.advisory,
    href: "/terminal",
    icon: Bot,
  },
];

const safetyBullets = [
  "AI chỉ hỗ trợ giải thích, tóm tắt và cá nhân hóa bối cảnh; không tự tạo tín hiệu gốc.",
  `Web, PWA, thông báo và ${PRODUCT_NAMES.brokerWorkflow} dùng cùng nguồn dữ liệu để tránh lệch thông tin.`,
  "Các chức năng kết nối tài khoản giao dịch vẫn ở trạng thái thử nghiệm nội bộ, chưa public cho khách hàng thường.",
  "Không tự động đặt lệnh. Các hành động nhạy cảm cần xác nhận và tuân thủ quy trình riêng.",
];

function Header() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const [open, setOpen] = useState(false);
  const logoSrc = isDark ? "/brand/logo-dark.jpg" : "/brand/logo-light.jpg";

  return (
    <header
      className="sticky top-0 z-50 border-b backdrop-blur-xl"
      style={{
        background: "color-mix(in srgb, var(--page-surface) 88%, transparent)",
        borderColor: "var(--border)",
      }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <Image src={logoSrc} alt={BRAND.name} width={42} height={42} className="rounded-xl object-cover" priority />
          <div>
            <p className="text-sm font-black leading-tight" style={{ color: "var(--text-primary)" }}>
              {BRAND.name}
            </p>
            <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
              {BRAND.tagline}
            </p>
          </div>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-semibold transition-colors"
              style={{ color: "var(--text-secondary)" }}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-10 w-10 items-center justify-center rounded-full border"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--surface)" }}
            aria-label="Đổi giao diện"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Link
            href="/auth"
            className="rounded-full border px-4 py-2 text-sm font-bold"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--surface)" }}
          >
            Đăng nhập
          </Link>
          <Link
            href="/auth?mode=register"
            className="rounded-full px-4 py-2 text-sm font-black"
            style={{ background: "var(--primary)", color: "#EBE2CF" }}
          >
            Dùng thử
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex h-10 w-10 items-center justify-center rounded-full border md:hidden"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--surface)" }}
          aria-label="Mở menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div className="border-t px-4 pb-4 md:hidden" style={{ borderColor: "var(--border)", background: "var(--page-surface)" }}>
          <div className="grid gap-2 pt-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-2xl px-4 py-3 text-sm font-bold"
                style={{ background: "var(--surface)", color: "var(--text-primary)" }}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/auth"
              className="rounded-2xl px-4 py-3 text-sm font-bold"
              style={{ background: "var(--primary)", color: "#EBE2CF" }}
              onClick={() => setOpen(false)}
            >
              Đăng nhập
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(circle at 80% 15%, rgba(46,77,61,0.18), transparent 34%), radial-gradient(circle at 15% 20%, rgba(160,132,92,0.13), transparent 32%)",
        }}
      />
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <p className="text-xs font-black uppercase tracking-[0.24em]" style={{ color: "var(--primary)" }}>
            {BRAND.name} - {BRAND.tagline}
          </p>
          <h1 className="mt-5 max-w-4xl text-5xl font-black leading-[0.95] tracking-[-0.07em] sm:text-6xl lg:text-7xl" style={{ color: "var(--text-primary)" }}>
            Hệ điều hành đầu tư AI cho chứng khoán Việt Nam.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8" style={{ color: "var(--text-secondary)" }}>
            ADNexus gom dữ liệu thị trường, bản tin, tín hiệu, danh mục và trợ lý AIDEN vào một luồng rõ ràng để nhà đầu tư ra quyết định có kiểm chứng hơn.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/auth?mode=register" className="inline-flex items-center gap-2 rounded-2xl px-5 py-4 text-sm font-black" style={{ background: "var(--primary)", color: "#EBE2CF" }}>
              Dùng thử {PRODUCT_NAMES.dashboard}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="#workflow" className="inline-flex items-center gap-2 rounded-2xl border px-5 py-4 text-sm font-black" style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--surface)" }}>
              Xem quy trình
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-2">
            {[PRODUCT_NAMES.dashboard, PRODUCT_NAMES.brokerWorkflow, PRODUCT_NAMES.art, PRODUCT_NAMES.brief, PRODUCT_NAMES.rsRating].map((item) => (
              <span key={item} className="rounded-full border px-3 py-1.5 text-xs font-bold" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-secondary)" }}>
                {item}
              </span>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.08 }}>
          <div className="rounded-[2rem] border p-4 shadow-2xl" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="rounded-[1.5rem] border p-5" style={{ background: "linear-gradient(145deg, var(--surface-2), var(--surface))", borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>
                    {PRODUCT_NAMES.brokerWorkflow}
                  </p>
                  <h2 className="mt-2 text-2xl font-black">Cơ hội được kiểm soát trước khi hành động</h2>
                </div>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
                  <Bot className="h-6 w-6" />
                </span>
              </div>

              <div className="mt-6 grid gap-3">
                {[
                  ["Cơ hội mới", "Đồng bộ cùng web, app và Telegram"],
                  ["Danh mục theo dõi", "Tách rõ quan sát, nắm giữ, kết thúc"],
                  ["Hành động an toàn", "Xem trước, kiểm tra, rồi mới quyết định"],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-4 rounded-2xl border px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                    <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                      {label}
                    </span>
                    <span className="text-right text-sm font-black" style={{ color: "var(--text-primary)" }}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--primary-light)" }}>
                  <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: "var(--primary)" }}>
                    Tỷ trọng tham khảo
                  </p>
                  <p className="mt-3 text-4xl font-black">10%</p>
                  <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
                    Giúp nhà đầu tư hiểu quy mô đề xuất trước khi tự quyết định.
                  </p>
                </div>
                <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
                    Nguyên tắc
                  </p>
                  <p className="mt-3 text-4xl font-black">SAFE</p>
                  <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
                    AI chỉ giải thích; dữ liệu và rủi ro đi qua rule xác định.
                  </p>
                </div>
              </div>

              <p className="mt-5 text-xs leading-5" style={{ color: "var(--text-muted)" }}>
                Minh họa public. Không hiển thị tài khoản thật, không tự động đặt lệnh và không gọi kết nối giao dịch thật.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <PwaEntryRedirect>
      <main className="min-h-screen" style={{ background: "var(--page-surface)", color: "var(--text-primary)" }}>
        <Header />
        <Hero />

        <section id="workflow" className="border-y px-4 py-14 sm:px-6 lg:px-8" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: "var(--primary)" }}>
                Quy trình ADNexus
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-5xl">
                Từ dữ liệu đến hành động, không bỏ qua kỷ luật.
              </h2>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {workflowSteps.map((step) => {
                const Icon = step.icon;
                return (
                  <article key={step.title} className="rounded-[1.5rem] border p-5" style={{ background: "var(--page-surface)", borderColor: "var(--border)" }}>
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-5 text-xl font-black">{step.title}</h3>
                    <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
                      {step.body}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="products" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div className="max-w-3xl">
                <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: "var(--primary)" }}>
                  Bộ công cụ
                </p>
                <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-5xl">
                  Một nền tảng, nhiều bề mặt sử dụng.
                </h2>
              </div>
              <Link href="/san-pham" className="inline-flex w-fit items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-black" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-primary)" }}>
                Xem toàn bộ sản phẩm
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {productCards.map((card) => {
                const Icon = card.icon;
                return (
                  <Link key={card.name} href={card.href} className="group block">
                    <article className="h-full rounded-[1.5rem] border p-5 transition duration-200 group-hover:-translate-y-1" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <p className="mt-5 text-xs font-black uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
                        {card.label}
                      </p>
                      <h3 className="mt-2 text-2xl font-black">{card.name}</h3>
                      <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
                        {card.body}
                      </p>
                    </article>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section id="safety" className="px-4 pb-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[2rem] border p-6" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: "var(--primary)" }}>
                Nguyên tắc vận hành
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.04em]">AI hỗ trợ. Kỷ luật quyết định.</h2>
              <p className="mt-4 text-sm leading-7" style={{ color: "var(--text-secondary)" }}>
                AIDEN được thiết kế để giải thích, tóm tắt và cá nhân hóa bối cảnh. Dữ liệu, tín hiệu, rủi ro và trạng thái vận hành đi theo luồng kiểm soát riêng.
              </p>
            </div>
            <div className="grid gap-3">
              {safetyBullets.map((bullet) => (
                <div key={bullet} className="flex gap-3 rounded-2xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--primary)" }} />
                  <p className="text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
                    {bullet}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl rounded-[2rem] border p-6 sm:p-8" style={{ background: "linear-gradient(135deg, var(--primary), #173627)", borderColor: "rgba(255,255,255,0.12)", color: "#EBE2CF" }}>
            <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: "rgba(235,226,207,0.72)" }}>
                  Bắt đầu
                </p>
                <h2 className="mt-3 text-3xl font-black tracking-[-0.04em]">
                  Mở ADNexus và kiểm tra thị trường hôm nay.
                </h2>
              </div>
              <Link href="/auth?mode=register" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#EBE2CF] px-5 py-4 text-sm font-black text-[#173627]">
                Tạo tài khoản
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <Footer />
      </main>
    </PwaEntryRedirect>
  );
}

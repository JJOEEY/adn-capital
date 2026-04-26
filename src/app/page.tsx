"use client";

import type { ComponentType, ReactNode } from "react";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  LineChart,
  Menu,
  Moon,
  Radar,
  ShieldCheck,
  Sun,
  Trophy,
  X,
} from "lucide-react";
import { Footer } from "@/components/layout/Footer";
import { useTheme } from "@/components/providers/ThemeProvider";
import { PwaEntryRedirect } from "@/components/pwa/PwaEntryRedirect";
import { BRAND, PRODUCT_NAMES } from "@/lib/brand/productNames";

type ProductMockKind = "pulse" | "pilot" | "art" | "advisory" | "rank";
type ProductIcon = ComponentType<{ className?: string }>;

const productCards: Array<{
  id: string;
  name: string;
  label: string;
  headline: string;
  body: string;
  href: string;
  icon: ProductIcon;
  mock: ProductMockKind;
}> = [
  {
    id: "nexpulse",
    name: PRODUCT_NAMES.dashboard,
    label: "Tổng quan thị trường",
    headline: "Một màn hình để đọc nhịp thị trường trong ngày.",
    body: "Theo dõi chỉ số, thanh khoản, độ rộng, dòng tiền và bản tin quan trọng trong cùng một bức tranh dễ hiểu.",
    href: "/dashboard",
    icon: BarChart3,
    mock: "pulse",
  },
  {
    id: "nexpilot",
    name: PRODUCT_NAMES.brokerWorkflow,
    label: "Theo dõi cơ hội",
    headline: "Tín hiệu được đưa vào bối cảnh danh mục.",
    body: "Mỗi cơ hội có trạng thái, vùng giá, tỷ trọng tham khảo và cảnh báo rủi ro để người dùng không hành động theo cảm tính.",
    href: "/dashboard/signal-map",
    icon: Radar,
    mock: "pilot",
  },
  {
    id: "nexart",
    name: PRODUCT_NAMES.art,
    label: "Trạng thái rủi ro",
    headline: "Biết khi nào thị trường đang an toàn hơn hoặc rủi ro hơn.",
    body: "NexART hiển thị trạng thái hành động, rủi ro và xu hướng bằng đồng hồ trực quan, không công khai công thức nội bộ.",
    href: "/art",
    icon: Activity,
    mock: "art",
  },
  {
    id: "aiden-advisory",
    name: PRODUCT_NAMES.advisory,
    label: "Trợ lý đầu tư",
    headline: "Hỏi như đang nhắn tin với một trợ lý phân tích.",
    body: "AIDEN hỗ trợ chat thường, giải thích bối cảnh thị trường và phân tích mã khi có dữ liệu phù hợp.",
    href: "/terminal",
    icon: Bot,
    mock: "advisory",
  },
  {
    id: "nexrank",
    name: PRODUCT_NAMES.rsRating,
    label: "Sức mạnh tương đối",
    headline: "Lọc nhanh cổ phiếu khỏe hơn mặt bằng thị trường.",
    body: "NexRank giúp so sánh sức mạnh tương đối của cổ phiếu và nhóm ngành để ưu tiên danh sách theo dõi.",
    href: "/rs-rating",
    icon: Trophy,
    mock: "rank",
  },
];

const navLinks = [
  { href: "#workflow", label: "Quy trình" },
  { href: "#products", label: "Sản phẩm", hasDropdown: true },
  { href: "#safety", label: "Kỷ luật" },
  { href: "/pricing", label: "Bảng giá" },
];

const workflowSteps = [
  {
    title: "Đọc thị trường",
    body: "Chỉ số, thanh khoản, độ rộng, tin tức và dòng tiền được gom vào một góc nhìn thống nhất.",
    icon: BarChart3,
  },
  {
    title: "Chọn cơ hội",
    body: "Cơ hội được phân loại rõ: mới quan sát, đang theo dõi, đang nắm giữ hoặc đã kết thúc.",
    icon: Radar,
  },
  {
    title: "Kiểm tra rủi ro",
    body: "Mỗi hành động đều đi kèm vùng giá, tỷ trọng, mục tiêu và điểm sai để giữ kỷ luật.",
    icon: ShieldCheck,
  },
  {
    title: "Tự quyết định",
    body: "AI chỉ giải thích và tóm tắt. Người dùng luôn là người xác nhận hành động cuối cùng.",
    icon: CheckCircle2,
  },
];

const safetyBullets = [
  "Tín hiệu gốc đến từ bộ quét và dữ liệu kiểm soát, không phải do AI tự tạo.",
  `Web, app và ${PRODUCT_NAMES.brokerWorkflow} đọc cùng một nguồn dữ liệu để giảm lệch thông tin.`,
  "Tính năng liên kết tài khoản giao dịch đang trong pilot nội bộ, chưa mở cho khách hàng thường.",
  "Không tự động đặt lệnh. Các hành động nhạy cảm cần xác nhận và tuân thủ quy trình riêng.",
];

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.35 },
  transition: { duration: 0.6, ease: "easeOut" },
} as const;

function Header() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const [open, setOpen] = useState(false);
  const logoSrc = isDark ? "/brand/logo-dark.jpg" : "/brand/logo-light.jpg";

  return (
    <header
      className="sticky top-0 z-50 border-b backdrop-blur-xl"
      style={{
        background: "color-mix(in srgb, var(--page-surface) 90%, transparent)",
        borderColor: "var(--border)",
      }}
    >
      <div className="flex w-full items-center justify-between px-5 py-3 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
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
          {navLinks.map((link) =>
            link.hasDropdown ? (
              <div key={link.href} className="group relative">
                <Link href={link.href} className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
                  {link.label}
                </Link>
                <div
                  className="invisible absolute left-1/2 top-full z-50 mt-3 w-96 -translate-x-1/2 rounded-3xl border p-2 opacity-0 shadow-2xl transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
                  style={{ background: "var(--surface)", borderColor: "var(--border)" }}
                >
                  <div className="grid gap-1">
                    {productCards.map((product) => {
                      const Icon = product.icon;
                      return (
                        <Link
                          key={product.id}
                          href={`#product-${product.id}`}
                          className="flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-[var(--bg-hover)]"
                        >
                          <span
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
                            style={{ background: "var(--primary-light)", color: "var(--primary)" }}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-black" style={{ color: "var(--text-primary)" }}>
                              {product.name}
                            </span>
                            <span className="block truncate text-xs" style={{ color: "var(--text-muted)" }}>
                              {product.label}
                            </span>
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <Link key={link.href} href={link.href} className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
                {link.label}
              </Link>
            ),
          )}
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
          <Link href="/auth?mode=register" className="rounded-full px-4 py-2 text-sm font-black" style={{ background: "var(--primary)", color: "#EBE2CF" }}>
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
            <div className="grid gap-2 rounded-2xl border p-2" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              {productCards.map((product) => (
                <Link
                  key={product.id}
                  href={`#product-${product.id}`}
                  className="rounded-xl px-3 py-2 text-sm font-bold"
                  style={{ color: "var(--text-secondary)" }}
                  onClick={() => setOpen(false)}
                >
                  {product.name}
                </Link>
              ))}
            </div>
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

function FullScreenSection({
  id,
  eyebrow,
  title,
  body,
  children,
  reverse = false,
  tint = "default",
}: {
  id?: string;
  eyebrow: string;
  title: string;
  body: string;
  children: ReactNode;
  reverse?: boolean;
  tint?: "default" | "deep" | "warm";
}) {
  const background =
    tint === "deep"
      ? "radial-gradient(circle at 85% 20%, rgba(46,77,61,0.24), transparent 34%), linear-gradient(135deg, color-mix(in srgb, var(--page-surface) 90%, #0c1a13), var(--page-surface))"
      : tint === "warm"
        ? "radial-gradient(circle at 16% 18%, rgba(160,132,92,0.16), transparent 36%), var(--page-surface)"
        : "radial-gradient(circle at 85% 15%, rgba(46,77,61,0.18), transparent 34%), radial-gradient(circle at 15% 20%, rgba(160,132,92,0.12), transparent 32%), var(--page-surface)";

  return (
    <section
      id={id}
      className="relative flex min-h-[calc(100svh-68px)] w-full snap-start scroll-mt-20 items-center overflow-hidden px-5 py-16 sm:px-8 lg:px-12 xl:px-16 2xl:px-20"
      style={{ background }}
    >
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px" style={{ background: "var(--border)" }} />
      <div className="grid w-full gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center xl:gap-14">
        <motion.div {...fadeUp} className={`max-w-[760px] ${reverse ? "lg:order-2" : ""}`}>
          <p className="text-xs font-black uppercase tracking-[0.26em]" style={{ color: "var(--primary)" }}>
            {eyebrow}
          </p>
          <h2 className="mt-5 text-5xl font-black leading-[0.94] tracking-[-0.075em] sm:text-6xl lg:text-7xl 2xl:text-8xl" style={{ color: "var(--text-primary)" }}>
            {title}
          </h2>
          <p className="mt-6 max-w-3xl text-lg leading-8 sm:text-xl sm:leading-9" style={{ color: "var(--text-secondary)" }}>
            {body}
          </p>
        </motion.div>
        <motion.div {...fadeUp} transition={{ duration: 0.6, ease: "easeOut", delay: 0.08 }} className={`min-w-0 ${reverse ? "lg:order-1" : ""}`}>
          {children}
        </motion.div>
      </div>
    </section>
  );
}

function HeroScene() {
  return (
    <div className="relative min-h-[560px] overflow-hidden rounded-[2.4rem] border p-4 shadow-2xl lg:min-h-[70svh]" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full blur-3xl" style={{ background: "rgba(160,132,92,0.18)" }} />
      <div className="absolute -bottom-24 left-12 h-96 w-96 rounded-full blur-3xl" style={{ background: "rgba(46,77,61,0.24)" }} />
      <div className="relative grid h-full gap-4 lg:grid-cols-[0.82fr_1.18fr]">
        <div className="rounded-[2rem] border p-5" style={{ background: "color-mix(in srgb, var(--surface-2) 72%, transparent)", borderColor: "var(--border)" }}>
          <div className="rounded-3xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
                <LineChart className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-black">Nhà đầu tư cá nhân</p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Theo dõi thị trường trong ngày
                </p>
              </div>
            </div>
          </div>
          <div className="mt-56 rounded-3xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
              AIDEN Analyst
            </p>
            <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
              Giải thích dữ liệu, không tự tạo tín hiệu.
            </p>
          </div>
          <div className="mt-36 rounded-3xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>
              Luồng quyết định
            </p>
            {["Đọc thị trường", "Chọn cơ hội", "Kiểm tra rủi ro", "Tự quyết định"].map((item) => (
              <div key={item} className="mt-3 flex items-center gap-2 text-sm font-bold" style={{ color: "var(--text-secondary)" }}>
                <CheckCircle2 className="h-4 w-4" style={{ color: "var(--primary)" }} />
                {item}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[2rem] border p-6" style={{ background: "linear-gradient(145deg, var(--surface-2), var(--surface))", borderColor: "var(--border)" }}>
          <p className="text-xs font-black uppercase tracking-[0.24em]" style={{ color: "var(--text-muted)" }}>
            ADNexus Control Room
          </p>
          <h3 className="mt-5 max-w-lg text-4xl font-black leading-tight tracking-[-0.05em]" style={{ color: "var(--text-primary)" }}>
            Một màn hình, nhiều lớp dữ liệu
          </h3>
          <div className="mt-8 grid gap-4">
            {[
              ["Thị trường", "Thanh khoản, độ rộng, chỉ số"],
              ["Cơ hội", "Tín hiệu mới và trạng thái theo dõi"],
              ["Tư vấn", "Chat thường hoặc phân tích mã"],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-[0.35fr_0.65fr] gap-4 rounded-3xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <p className="text-base" style={{ color: "var(--text-muted)" }}>
                  {label}
                </p>
                <p className="text-right text-base font-black" style={{ color: "var(--text-primary)" }}>
                  {value}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-8 grid grid-cols-2 gap-4">
            <div className="rounded-3xl border p-5" style={{ borderColor: "var(--border)", background: "var(--primary-light)" }}>
              <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: "var(--primary)" }}>
                Quy tắc
              </p>
              <p className="mt-4 text-5xl font-black">SAFE</p>
              <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
                AI hỗ trợ hiểu dữ liệu; hành động cuối cùng luôn do người dùng xác nhận.
              </p>
            </div>
            <div className="rounded-3xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
                Đồng bộ
              </p>
              <p className="mt-4 text-5xl font-black">1 nguồn</p>
              <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
                Web, app và thông báo đọc cùng dữ liệu để giảm lệch thông tin.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative flex min-h-[calc(100svh-68px)] w-full snap-start items-center overflow-hidden px-5 py-16 sm:px-8 lg:px-12 xl:px-16 2xl:px-20">
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(circle at 84% 10%, rgba(160,132,92,0.18), transparent 30%), radial-gradient(circle at 14% 12%, rgba(46,77,61,0.22), transparent 34%), var(--page-surface)",
        }}
      />
      <div className="grid w-full gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
        <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="max-w-[840px]">
          <p className="text-xs font-black uppercase tracking-[0.28em]" style={{ color: "var(--primary)" }}>
            {BRAND.name} - {BRAND.tagline}
          </p>
          <h1 className="mt-6 text-6xl font-black leading-[0.9] tracking-[-0.085em] sm:text-7xl lg:text-8xl 2xl:text-[9rem]" style={{ color: "var(--text-primary)" }}>
            Hệ điều hành đầu tư AI cho chứng khoán Việt Nam.
          </h1>
          <p className="mt-8 max-w-3xl text-lg leading-8 sm:text-xl sm:leading-9" style={{ color: "var(--text-secondary)" }}>
            ADNexus giúp nhà đầu tư đọc thị trường, theo dõi cơ hội, giữ kỷ luật và hỏi AIDEN trong một trải nghiệm thống nhất. Dễ hiểu cho người mới, đủ kiểm soát cho người giao dịch nghiêm túc.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/auth?mode=register" className="inline-flex items-center gap-2 rounded-2xl px-6 py-4 text-sm font-black" style={{ background: "var(--primary)", color: "#EBE2CF" }}>
              Dùng thử ADNexus
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="#products" className="inline-flex items-center gap-2 rounded-2xl border px-6 py-4 text-sm font-black" style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--surface)" }}>
              Xem câu chuyện sản phẩm
            </Link>
          </div>
          <div className="mt-9 flex flex-wrap gap-2">
            {[PRODUCT_NAMES.dashboard, PRODUCT_NAMES.brokerWorkflow, PRODUCT_NAMES.art, PRODUCT_NAMES.advisory, PRODUCT_NAMES.rsRating].map((item) => (
              <span key={item} className="rounded-full border px-4 py-2 text-xs font-black" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-secondary)" }}>
                {item}
              </span>
            ))}
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.08 }}>
          <HeroScene />
        </motion.div>
      </div>
    </section>
  );
}

function Workflow() {
  return (
    <section id="workflow" className="relative flex min-h-screen w-full snap-start items-center overflow-hidden px-5 py-16 sm:px-8 lg:px-12 xl:px-16 2xl:px-20" style={{ background: "var(--page-surface)" }}>
      <div className="grid w-full gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
        <motion.div {...fadeUp}>
          <p className="text-xs font-black uppercase tracking-[0.26em]" style={{ color: "var(--primary)" }}>
            Quy trình
          </p>
          <h2 className="mt-5 max-w-3xl text-5xl font-black leading-[0.95] tracking-[-0.07em] sm:text-6xl lg:text-7xl" style={{ color: "var(--text-primary)" }}>
            Từ dữ liệu đến hành động có kiểm soát.
          </h2>
        </motion.div>
        <div className="grid gap-4 md:grid-cols-2">
          {workflowSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.div key={step.title} {...fadeUp} transition={{ duration: 0.5, delay: index * 0.06 }} className="min-h-[260px] rounded-[2rem] border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <div className="flex items-center justify-between">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
                    <Icon className="h-6 w-6" />
                  </span>
                  <span className="text-5xl font-black" style={{ color: "var(--text-muted)", opacity: 0.28 }}>
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-8 text-2xl font-black" style={{ color: "var(--text-primary)" }}>
                  {step.title}
                </h3>
                <p className="mt-4 text-base leading-7" style={{ color: "var(--text-secondary)" }}>
                  {step.body}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SceneShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-[520px] overflow-hidden rounded-[2.4rem] border p-5 shadow-2xl lg:min-h-[68svh]" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl" style={{ background: "rgba(46,77,61,0.20)" }} />
      <div className="relative h-full">{children}</div>
    </div>
  );
}

function PulseMock() {
  const bars = [42, 64, 50, 76, 58, 90, 72, 86, 66, 94, 78, 82];
  return (
    <SceneShell>
      <div className="grid h-full gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[2rem] border p-5" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>
                NexPulse
              </p>
              <p className="mt-3 text-4xl font-black">VNINDEX 1,824.6</p>
            </div>
            <span className="rounded-full px-4 py-2 text-sm font-black" style={{ background: "rgba(22,163,74,0.12)", color: "#16a34a" }}>
              +0.42%
            </span>
          </div>
          <div className="mt-8 flex h-72 items-end gap-2 rounded-3xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            {bars.map((height, index) => (
              <div
                key={index}
                className="flex-1 rounded-t-xl"
                style={{
                  height: `${height}%`,
                  background: index % 3 === 0 ? "#16a34a" : index % 3 === 1 ? "#f59e0b" : "#2f513f",
                  opacity: 0.9,
                }}
              />
            ))}
          </div>
        </div>
        <div className="grid gap-4">
          {[
            ["HoSE", "18,420 tỷ"],
            ["HNX", "1,120 tỷ"],
            ["UPCoM", "840 tỷ"],
            ["Độ rộng", "238 tăng / 154 giảm"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-3xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
                {label}
              </p>
              <p className="mt-3 text-2xl font-black">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </SceneShell>
  );
}

function PilotMock() {
  return (
    <SceneShell>
      <div className="grid h-full gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[2rem] border p-5" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>
            NexPilot
          </p>
          <h3 className="mt-4 text-4xl font-black tracking-[-0.04em]">Danh sách cơ hội mới</h3>
          <div className="mt-8 space-y-3">
            {["HAH", "MWG", "FPT", "VRE"].map((ticker, index) => (
              <div key={ticker} className="flex items-center justify-between rounded-3xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <div>
                  <p className="text-2xl font-black">{ticker}</p>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    {index % 2 === 0 ? "Đang theo dõi" : "Mới phát sinh"}
                  </p>
                </div>
                <span className="rounded-full px-3 py-1 text-xs font-black" style={{ background: "rgba(22,163,74,0.12)", color: "#16a34a" }}>
                  Fresh
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[2rem] border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>
            Bối cảnh trước hành động
          </p>
          <div className="mt-6 rounded-3xl border p-5" style={{ borderColor: "var(--border)", background: "var(--primary-light)" }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-5xl font-black">HAH</p>
                <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                  Tỷ trọng tham khảo 8.7% NAV
                </p>
              </div>
              <span className="rounded-2xl px-4 py-2 text-sm font-black" style={{ background: "var(--surface)", color: "var(--primary)" }}>
                Theo dõi
              </span>
            </div>
            <div className="mt-8 grid grid-cols-3 gap-3 text-center">
              {[
                ["Entry", "56.0"],
                ["Mục tiêu", "59.9"],
                ["Sai điểm", "54.3"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  <p className="text-xs uppercase" style={{ color: "var(--text-muted)" }}>
                    {label}
                  </p>
                  <p className="mt-2 text-xl font-black">{value}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-6 text-base leading-7" style={{ color: "var(--text-secondary)" }}>
            Tín hiệu chỉ là danh sách theo dõi. Hệ thống giúp kiểm tra lại giá, tỷ trọng và trạng thái trước khi người dùng quyết định.
          </p>
        </div>
      </div>
    </SceneShell>
  );
}

function ArtMock() {
  return (
    <SceneShell>
      <div className="grid h-full gap-6 lg:grid-cols-[1fr_0.92fr] lg:items-center">
        <div className="flex flex-col items-center justify-center rounded-[2rem] border p-8" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <div className="relative h-80 w-80 max-w-full">
            <div className="absolute inset-0 rounded-full" style={{ background: "conic-gradient(from 220deg, #16a34a 0deg, #eab308 95deg, #f97316 145deg, #ef4444 210deg, transparent 211deg)" }} />
            <div className="absolute inset-10 rounded-full" style={{ background: "var(--surface-2)" }} />
            <div className="absolute inset-0 flex flex-col items-center justify-center pt-12">
              <p className="text-6xl font-black">2.7</p>
              <p className="mt-2 text-xl font-black uppercase" style={{ color: "#eab308" }}>
                Trung tính
              </p>
              <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>
                VN30
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-[2rem] border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>
            NexART + NexRank
          </p>
          <h3 className="mt-4 text-4xl font-black tracking-[-0.04em]">Risk cockpit dễ đọc</h3>
          <div className="mt-7 space-y-3">
            {[
              ["Trạng thái", "Trung tính"],
              ["Theo dõi", "Cần thêm xác nhận"],
              ["Xếp hạng", "Nhóm khỏe hơn thị trường"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-3xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                <span style={{ color: "var(--text-secondary)" }}>{label}</span>
                <span className="font-black">{value}</span>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm leading-6" style={{ color: "var(--text-muted)" }}>
            Giao diện public chỉ giải thích trạng thái. Công thức nội bộ không hiển thị.
          </p>
        </div>
      </div>
    </SceneShell>
  );
}

function AdvisoryMock() {
  return (
    <SceneShell>
      <div className="grid h-full gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[2rem] border p-6" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>
            AIDEN Advisory
          </p>
          <h3 className="mt-4 text-4xl font-black tracking-[-0.04em]">Chat như một ứng dụng nhắn tin</h3>
          <p className="mt-5 text-base leading-7" style={{ color: "var(--text-secondary)" }}>
            Người dùng có thể hỏi câu thường, hỏi thị trường hoặc yêu cầu phân tích mã. Nếu thiếu dữ liệu, AIDEN nói rõ thay vì bịa số.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3">
            {["Kỹ thuật", "Cơ bản", "Tâm lý", "Tin tức"].map((item) => (
              <span key={item} className="rounded-2xl border px-4 py-3 text-sm font-bold" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                {item}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col rounded-[2rem] border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: "var(--border)" }}>
            <div>
              <p className="text-lg font-black">Tư vấn đầu tư</p>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                AIDEN đang sẵn sàng
              </p>
            </div>
            <Bot className="h-6 w-6" style={{ color: "var(--primary)" }} />
          </div>
          <div className="flex-1 space-y-4 py-6">
            <div className="ml-auto max-w-[76%] rounded-3xl px-5 py-4 text-sm font-bold" style={{ background: "var(--primary)", color: "#EBE2CF" }}>
              So sánh TCB và EIB giúp tôi.
            </div>
            <div className="max-w-[84%] rounded-3xl border px-5 py-4 text-sm leading-6" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-secondary)" }}>
              AIDEN sẽ tách bối cảnh kỹ thuật, cơ bản, dòng tiền và rủi ro. Dữ liệu nào thiếu sẽ được ghi rõ.
            </div>
            <div className="ml-auto max-w-[70%] rounded-3xl px-5 py-4 text-sm font-bold" style={{ background: "var(--primary)", color: "#EBE2CF" }}>
              MCP là gì?
            </div>
            <div className="max-w-[84%] rounded-3xl border px-5 py-4 text-sm leading-6" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-secondary)" }}>
              Đây là câu hỏi thường. AIDEN trả lời trực tiếp, không ép thành mã cổ phiếu.
            </div>
          </div>
          <div className="rounded-full border px-5 py-3 text-sm" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
            Hỏi về thị trường, cổ phiếu hoặc khái niệm...
          </div>
        </div>
      </div>
    </SceneShell>
  );
}

function RankMock() {
  const rows = [
    ["FPT", 88],
    ["MWG", 82],
    ["TCB", 76],
    ["HPG", 72],
    ["VNM", 68],
  ] as const;

  return (
    <SceneShell>
      <div className="grid h-full gap-5 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>
            NexRank
          </p>
          <h3 className="mt-4 text-5xl font-black tracking-[-0.06em]">Bảng sức mạnh tương đối</h3>
          <p className="mt-5 text-base leading-7" style={{ color: "var(--text-secondary)" }}>
            Dùng để lọc nhóm cổ phiếu khỏe hơn mặt bằng chung. Quyền truy cập có thể giới hạn theo gói.
          </p>
        </div>
        <div className="rounded-[2rem] border p-5" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-black">Xếp hạng hôm nay</p>
            <span className="rounded-full border px-3 py-1 text-xs font-black" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
              Premium
            </span>
          </div>
          <div className="mt-5 space-y-4">
            {rows.map(([ticker, score]) => (
              <div key={ticker} className="rounded-3xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-black">{ticker}</span>
                  <span className="text-base font-black">{score}/100</span>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
                  <div className="h-full rounded-full" style={{ width: `${score}%`, background: "var(--primary)" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SceneShell>
  );
}

function ProductMock({ kind }: { kind: ProductMockKind }) {
  if (kind === "pulse") return <PulseMock />;
  if (kind === "pilot") return <PilotMock />;
  if (kind === "art") return <ArtMock />;
  if (kind === "advisory") return <AdvisoryMock />;
  return <RankMock />;
}

function Products() {
  return (
    <div id="products">
      {productCards.map((product, index) => {
        const Icon = product.icon;
        return (
          <FullScreenSection
            key={product.id}
            id={`product-${product.id}`}
            eyebrow={`${product.name} - ${product.label}`}
            title={product.headline}
            body={product.body}
            reverse={index % 2 === 1}
            tint={index % 3 === 0 ? "deep" : index % 3 === 1 ? "warm" : "default"}
          >
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
                <Icon className="h-5 w-5" />
              </span>
              <Link href={product.href} className="inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-primary)" }}>
                Mở {product.name}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <ProductMock kind={product.mock} />
          </FullScreenSection>
        );
      })}
    </div>
  );
}

function Safety() {
  return (
    <section id="safety" className="relative flex min-h-screen w-full snap-start items-center px-5 py-16 sm:px-8 lg:px-12 xl:px-16 2xl:px-20" style={{ background: "var(--page-surface)" }}>
      <div className="grid w-full gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <motion.div {...fadeUp} className="max-w-[760px]">
          <p className="text-xs font-black uppercase tracking-[0.26em]" style={{ color: "var(--primary)" }}>
            Nguyên tắc vận hành
          </p>
          <h2 className="mt-5 text-5xl font-black leading-[0.95] tracking-[-0.07em] sm:text-6xl lg:text-7xl" style={{ color: "var(--text-primary)" }}>
            AI hỗ trợ. Kỷ luật quyết định.
          </h2>
          <p className="mt-6 text-lg leading-8" style={{ color: "var(--text-secondary)" }}>
            AIDEN được thiết kế để giải thích, tóm tắt và cá nhân hóa bối cảnh. Dữ liệu, tín hiệu, rủi ro và trạng thái vận hành đi theo luồng kiểm soát riêng.
          </p>
        </motion.div>
        <div className="grid gap-4">
          {safetyBullets.map((bullet, index) => (
            <motion.div key={bullet} {...fadeUp} transition={{ duration: 0.5, delay: index * 0.05 }} className="flex gap-4 rounded-[1.8rem] border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0" style={{ color: "var(--primary)" }} />
              <p className="text-base leading-7" style={{ color: "var(--text-secondary)" }}>
                {bullet}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="flex min-h-[70svh] w-full snap-start items-center px-5 py-16 sm:px-8 lg:px-12 xl:px-16 2xl:px-20" style={{ background: "var(--page-surface)" }}>
      <div className="flex w-full flex-col gap-8 rounded-[2.5rem] p-8 md:flex-row md:items-center md:justify-between lg:p-12" style={{ background: "linear-gradient(135deg, var(--primary), #123729)", color: "#EBE2CF" }}>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] opacity-75">Bắt đầu</p>
          <h2 className="mt-4 max-w-4xl text-4xl font-black tracking-[-0.05em] sm:text-5xl lg:text-6xl">
            Mở ADNexus và kiểm tra thị trường hôm nay.
          </h2>
        </div>
        <Link href="/auth?mode=register" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl px-6 py-4 text-sm font-black" style={{ background: "#EBE2CF", color: "#123729" }}>
          Tạo tài khoản
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <PwaEntryRedirect>
      <main className="min-h-screen overflow-x-hidden scroll-smooth" style={{ background: "var(--page-surface)", color: "var(--text-primary)" }}>
        <Header />
        <Hero />
        <Workflow />
        <Products />
        <Safety />
        <CTA />
        <Footer />
      </main>
    </PwaEntryRedirect>
  );
}

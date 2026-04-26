"use client";

import type { ComponentType } from "react";
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
  body: string;
  href: string;
  icon: ProductIcon;
  mock: ProductMockKind;
}> = [
  {
    id: "nexpulse",
    name: PRODUCT_NAMES.dashboard,
    label: "Tổng quan thị trường",
    body: "Một màn hình theo dõi chỉ số, thanh khoản, độ rộng và bản tin quan trọng trong ngày.",
    href: "/dashboard",
    icon: BarChart3,
    mock: "pulse",
  },
  {
    id: "nexpilot",
    name: PRODUCT_NAMES.brokerWorkflow,
    label: "Theo dõi cơ hội",
    body: "Cơ hội được ghi nhận, phân loại trạng thái và theo dõi kỷ luật trước khi hành động.",
    href: "/dashboard/signal-map",
    icon: Radar,
    mock: "pilot",
  },
  {
    id: "nexart",
    name: PRODUCT_NAMES.art,
    label: "Đảo chiều và rủi ro",
    body: "Đồng hồ trạng thái giúp nhìn nhanh mức rủi ro đảo chiều, không công khai công thức nội bộ.",
    href: "/art",
    icon: Activity,
    mock: "art",
  },
  {
    id: "aiden-advisory",
    name: PRODUCT_NAMES.advisory,
    label: "Trợ lý đầu tư",
    body: "AIDEN hỗ trợ hỏi đáp thị trường, giải thích bối cảnh và phân tích mã theo dữ liệu đang có.",
    href: "/terminal",
    icon: Bot,
    mock: "advisory",
  },
  {
    id: "nexrank",
    name: PRODUCT_NAMES.rsRating,
    label: "Xếp hạng sức mạnh",
    body: "Bảng xếp hạng sức mạnh tương đối giúp lọc nhóm cổ phiếu khỏe hơn thị trường.",
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
    title: "Phân tích dữ liệu",
    body: "Theo dõi chỉ số, thanh khoản, độ rộng thị trường, tin tức và cơ hội trong một màn hình thống nhất.",
    icon: BarChart3,
  },
  {
    title: "Giữ kỷ luật",
    body: "Mỗi cơ hội có vùng tham khảo, mục tiêu, cắt lỗ và tỷ trọng để hạn chế quyết định cảm tính.",
    icon: ShieldCheck,
  },
  {
    title: "Theo dõi danh mục",
    body: "Các trạng thái quan sát, đang nắm giữ và đã kết thúc được tách rõ để kiểm tra rủi ro nhanh hơn.",
    icon: Activity,
  },
  {
    title: "Hành động an toàn",
    body: "AI hỗ trợ giải thích và cá nhân hóa. Nhà đầu tư luôn là người xác nhận quyết định cuối cùng.",
    icon: CheckCircle2,
  },
];

const safetyBullets = [
  "Tín hiệu gốc đến từ bộ quét và dữ liệu kiểm soát, không phải do AI tự tạo.",
  `Web, app và ${PRODUCT_NAMES.brokerWorkflow} đọc cùng một nguồn dữ liệu để tránh lệch thông tin.`,
  "Tính năng liên kết tài khoản giao dịch đang trong pilot nội bộ, chưa mở cho khách hàng thường.",
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
        background: "color-mix(in srgb, var(--page-surface) 90%, transparent)",
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
          {navLinks.map((link) =>
            link.hasDropdown ? (
              <div key={link.href} className="group relative">
                <Link
                  href={link.href}
                  className="text-sm font-semibold transition-colors"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {link.label}
                </Link>
                <div
                  className="invisible absolute left-1/2 top-full z-50 mt-3 w-80 -translate-x-1/2 rounded-3xl border p-2 opacity-0 shadow-2xl transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
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
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-semibold transition-colors"
                style={{ color: "var(--text-secondary)" }}
              >
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
          <h1
            className="mt-5 max-w-4xl text-5xl font-black leading-[0.95] tracking-[-0.07em] sm:text-6xl lg:text-7xl"
            style={{ color: "var(--text-primary)" }}
          >
            Hệ điều hành đầu tư AI cho chứng khoán Việt Nam.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8" style={{ color: "var(--text-secondary)" }}>
            ADNexus gom dữ liệu thị trường, bản tin, tín hiệu, danh mục và trợ lý AIDEN vào một luồng rõ ràng để nhà đầu tư ra quyết định có kiểm chứng hơn.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/auth?mode=register"
              className="inline-flex items-center gap-2 rounded-2xl px-5 py-4 text-sm font-black"
              style={{ background: "var(--primary)", color: "#EBE2CF" }}
            >
              Dùng thử {PRODUCT_NAMES.dashboard}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="#products"
              className="inline-flex items-center gap-2 rounded-2xl border px-5 py-4 text-sm font-black"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--surface)" }}
            >
              Xem bộ sản phẩm
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-2">
            {[PRODUCT_NAMES.dashboard, PRODUCT_NAMES.brokerWorkflow, PRODUCT_NAMES.art, PRODUCT_NAMES.rsRating, PRODUCT_NAMES.brief].map((item) => (
              <span
                key={item}
                className="rounded-full border px-3 py-1.5 text-xs font-bold"
                style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-secondary)" }}
              >
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
                  <div
                    key={label}
                    className="flex items-center justify-between gap-4 rounded-2xl border px-4 py-3"
                    style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                  >
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
                    Liên kết với quy mô danh mục khi xem trước hành động.
                  </p>
                </div>
                <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
                    Nguyên tắc
                  </p>
                  <p className="mt-3 text-4xl font-black">An toàn</p>
                  <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
                    AI chỉ giải thích; dữ liệu và rủi ro luôn được kiểm tra trước.
                  </p>
                </div>
              </div>

              <p className="mt-5 text-xs leading-5" style={{ color: "var(--text-muted)" }}>
                Minh họa public. Không hiển thị tài khoản thật và không tự động đặt lệnh.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Workflow() {
  return (
    <section id="workflow" className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.24em]" style={{ color: "var(--primary)" }}>
            Quy trình
          </p>
          <h2 className="mt-3 text-4xl font-black tracking-[-0.04em] sm:text-5xl" style={{ color: "var(--text-primary)" }}>
            Từ dữ liệu đến hành động có kiểm soát.
          </h2>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {workflowSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.title} className="rounded-[1.5rem] border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <div className="flex items-center justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-3xl font-black" style={{ color: "var(--text-muted)", opacity: 0.35 }}>
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-6 text-xl font-black" style={{ color: "var(--text-primary)" }}>
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
                  {step.body}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function PulseMock() {
  const bars = [44, 66, 52, 78, 60, 92, 73, 86];
  return (
    <div className="rounded-[1.35rem] border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
            NexPulse
          </p>
          <p className="mt-2 text-2xl font-black">VNINDEX 1,824.6</p>
        </div>
        <span className="rounded-full px-3 py-1 text-xs font-black" style={{ background: "rgba(22,163,74,0.12)", color: "#16a34a" }}>
          +0.42%
        </span>
      </div>
      <div className="mt-5 flex h-28 items-end gap-2 rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
        {bars.map((height, index) => (
          <div
            key={index}
            className="flex-1 rounded-t-lg"
            style={{
              height: `${height}%`,
              background: index % 3 === 0 ? "#16a34a" : index % 3 === 1 ? "#f59e0b" : "#2f513f",
              opacity: 0.88,
            }}
          />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          ["HoSE", "18,420 tỷ"],
          ["HNX", "1,120 tỷ"],
          ["UPCoM", "840 tỷ"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
            <p className="text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>
              {label}
            </p>
            <p className="mt-1 text-sm font-black">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-xl border p-3 text-sm" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
        Độ rộng: 238 mã tăng · 154 mã giảm · 58 mã đứng giá
      </div>
    </div>
  );
}

function PilotMock() {
  return (
    <div className="rounded-[1.35rem] border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
          NexPilot
        </p>
        <span className="rounded-full px-3 py-1 text-xs font-black" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
          Đang theo dõi
        </span>
      </div>
      <div className="mt-4 rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-3xl font-black">HAH</p>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Ngắn hạn · 8.7% NAV
            </p>
          </div>
          <span className="rounded-xl px-3 py-2 text-xs font-black" style={{ background: "rgba(22,163,74,0.12)", color: "#16a34a" }}>
            Fresh
          </span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            ["Entry", "56.0"],
            ["Target", "59.9"],
            ["Stoploss", "54.3"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border p-2" style={{ borderColor: "var(--border)" }}>
              <p className="text-[11px] uppercase" style={{ color: "var(--text-muted)" }}>
                {label}
              </p>
              <p className="mt-1 font-black">{value}</p>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-4 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
        Tín hiệu chỉ là danh sách theo dõi. Hệ thống giúp kiểm tra lại giá, tỷ trọng và trạng thái trước khi hành động.
      </p>
    </div>
  );
}

function ArtMock() {
  return (
    <div className="rounded-[1.35rem] border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
        NexART
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_0.9fr] sm:items-center">
        <div className="relative mx-auto h-48 w-48">
          <div
            className="absolute inset-0 rounded-full"
            style={{ background: "conic-gradient(from 220deg, #16a34a 0deg, #eab308 95deg, #f97316 145deg, #ef4444 210deg, transparent 211deg)" }}
          />
          <div className="absolute inset-7 rounded-full" style={{ background: "var(--surface)" }} />
          <div className="absolute inset-0 flex flex-col items-center justify-center pt-10">
            <p className="text-4xl font-black">2.7</p>
            <p className="text-sm font-black uppercase" style={{ color: "#eab308" }}>
              Trung tính
            </p>
          </div>
        </div>
        <div className="space-y-2">
          {["An toàn", "Trung tính", "Rủi ro"].map((label, index) => (
            <div key={label} className="flex items-center justify-between rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)" }}>
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {label}
              </span>
              <span className="font-black">{index === 1 ? "Hiện tại" : "Theo dõi"}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
        Minh họa trạng thái rủi ro. Không hiển thị công thức nội bộ trên giao diện public.
      </p>
    </div>
  );
}

function AdvisoryMock() {
  return (
    <div className="rounded-[1.35rem] border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
        AIDEN Advisory
      </p>
      <div className="mt-4 space-y-3">
        <div className="ml-auto max-w-[78%] rounded-2xl px-4 py-3 text-sm font-bold" style={{ background: "var(--primary)", color: "#EBE2CF" }}>
          So sánh TCB và EIB giúp tôi.
        </div>
        <div className="max-w-[86%] rounded-2xl border px-4 py-3 text-sm leading-6" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-secondary)" }}>
          AIDEN sẽ tách bối cảnh kỹ thuật, cơ bản, dòng tiền và rủi ro. Nếu dữ liệu thiếu, hệ thống báo rõ thay vì tự bịa số.
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs font-bold">
          {["Kỹ thuật", "Cơ bản", "Tâm lý", "Tin tức"].map((item) => (
            <span key={item} className="rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function RankMock() {
  const rows = [
    ["FPT", 88],
    ["MWG", 82],
    ["TCB", 76],
    ["HPG", 72],
  ] as const;

  return (
    <div className="rounded-[1.35rem] border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
          NexRank
        </p>
        <span className="rounded-full border px-3 py-1 text-xs font-black" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
          VIP
        </span>
      </div>
      <div className="mt-4 space-y-3">
        {rows.map(([ticker, score]) => (
          <div key={ticker} className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <div className="flex items-center justify-between">
              <span className="font-black">{ticker}</span>
              <span className="text-sm font-black">{score}/100</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
              <div className="h-full rounded-full" style={{ width: `${score}%`, background: "var(--primary)" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
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
    <section id="products" className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em]" style={{ color: "var(--primary)" }}>
              Bộ sản phẩm
            </p>
            <h2 className="mt-3 max-w-3xl text-4xl font-black tracking-[-0.04em] sm:text-5xl" style={{ color: "var(--text-primary)" }}>
              Một nền tảng, nhiều bề mặt sử dụng.
            </h2>
          </div>
          <Link
            href="/san-pham"
            className="inline-flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-black"
            style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-primary)" }}
          >
            Xem trang sản phẩm
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-10 grid gap-8">
          {productCards.map((product, index) => {
            const Icon = product.icon;
            const reverse = index % 2 === 1;
            return (
              <article
                key={product.id}
                id={`product-${product.id}`}
                className="scroll-mt-28 rounded-[2rem] border p-5 lg:p-8"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                <div className={`grid gap-8 lg:grid-cols-2 lg:items-center ${reverse ? "lg:[&>*:first-child]:order-2" : ""}`}>
                  <div>
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <p className="mt-5 text-xs font-black uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>
                      {product.label}
                    </p>
                    <h3 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-4xl" style={{ color: "var(--text-primary)" }}>
                      {product.name}
                    </h3>
                    <p className="mt-4 max-w-xl text-base leading-7" style={{ color: "var(--text-secondary)" }}>
                      {product.body}
                    </p>
                    <Link
                      href={product.href}
                      className="mt-6 inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black"
                      style={{ background: "var(--primary-light)", color: "var(--primary)" }}
                    >
                      Mở {product.name}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                  <ProductMock kind={product.mock} />
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Safety() {
  return (
    <section id="safety" className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em]" style={{ color: "var(--primary)" }}>
            Nguyên tắc vận hành
          </p>
          <h2 className="mt-3 text-4xl font-black tracking-[-0.04em] sm:text-5xl" style={{ color: "var(--text-primary)" }}>
            AI hỗ trợ. Kỷ luật quyết định.
          </h2>
          <p className="mt-5 text-base leading-7" style={{ color: "var(--text-secondary)" }}>
            AIDEN được thiết kế để giải thích, tóm tắt và cá nhân hóa bối cảnh. Dữ liệu, tín hiệu, rủi ro và trạng thái vận hành đi theo luồng kiểm soát riêng.
          </p>
        </div>
        <div className="grid gap-3">
          {safetyBullets.map((bullet) => (
            <div key={bullet} className="flex gap-3 rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--primary)" }} />
              <p className="text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
                {bullet}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="px-4 py-12 sm:px-6 lg:px-8">
      <div
        className="mx-auto flex max-w-7xl flex-col gap-5 rounded-[2rem] p-6 md:flex-row md:items-center md:justify-between lg:p-8"
        style={{ background: "linear-gradient(135deg, var(--primary), #123729)", color: "#EBE2CF" }}
      >
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] opacity-75">Bắt đầu</p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.04em]">Mở ADNexus và kiểm tra thị trường hôm nay.</h2>
        </div>
        <Link href="/auth?mode=register" className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-black" style={{ background: "#EBE2CF", color: "#123729" }}>
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
      <main className="min-h-screen" style={{ background: "var(--page-surface)", color: "var(--text-primary)" }}>
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

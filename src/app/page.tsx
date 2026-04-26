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
  ChevronDown,
  Menu,
  Moon,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Trophy,
  UserRound,
  X,
} from "lucide-react";
import { Footer } from "@/components/layout/Footer";
import { useTheme } from "@/components/providers/ThemeProvider";
import { PwaEntryRedirect } from "@/components/pwa/PwaEntryRedirect";
import { BRAND, PRODUCT_NAMES } from "@/lib/brand/productNames";

type ProductSceneKind = "pulse" | "pilot" | "art" | "advisory" | "rank";
type ProductIcon = ComponentType<{ className?: string }>;

const productStories: Array<{
  id: string;
  name: string;
  shortName: string;
  label: string;
  headline: string;
  body: string;
  outcome: string;
  href: string;
  icon: ProductIcon;
  scene: ProductSceneKind;
  bullets: string[];
}> = [
  {
    id: "nexpulse",
    name: PRODUCT_NAMES.dashboard,
    shortName: "Thị trường",
    label: "Tổng quan thị trường",
    headline: "Nhìn một lần để biết thị trường đang khỏe hay yếu.",
    body: "NexPulse gom chỉ số, thanh khoản, độ rộng và bản tin quan trọng vào một màn hình dễ đọc. Người mới không cần tự ghép nhiều nguồn để hiểu phiên giao dịch.",
    outcome: "Biết trạng thái thị trường trước khi chọn cổ phiếu.",
    href: "/dashboard",
    icon: BarChart3,
    scene: "pulse",
    bullets: ["Thanh khoản 3 sàn", "Độ rộng tăng/giảm", "Bản tin thị trường trong ngày"],
  },
  {
    id: "nexpilot",
    name: PRODUCT_NAMES.brokerWorkflow,
    shortName: "Cơ hội",
    label: "Theo dõi cơ hội",
    headline: "Tín hiệu không chỉ để xem, mà để theo dõi có kỷ luật.",
    body: "NexPilot đưa cơ hội vào các trạng thái rõ ràng: tầm ngắm, đang theo dõi, đã kết thúc. Mỗi mã có vùng tham khảo, mục tiêu, cắt lỗ và tỷ trọng đề xuất.",
    outcome: "Không bỏ sót tín hiệu mới, không bắn trùng tín hiệu cũ.",
    href: "/dashboard/signal-map",
    icon: Radar,
    scene: "pilot",
    bullets: ["Tín hiệu mới theo khung giờ", "Trạng thái rõ ràng", "Đẩy cùng nguồn cho web, app, Telegram"],
  },
  {
    id: "nexart",
    name: PRODUCT_NAMES.art,
    shortName: "Rủi ro",
    label: "Đảo chiều và rủi ro",
    headline: "Một đồng hồ trạng thái để biết khi nào nên cẩn trọng hơn.",
    body: "NexART hiển thị trạng thái hành động, rủi ro và xu hướng bằng ngôn ngữ đơn giản. Công thức nội bộ không hiển thị trên public UI.",
    outcome: "Nhận biết rủi ro đảo chiều mà không phải đọc công thức kỹ thuật.",
    href: "/art",
    icon: Activity,
    scene: "art",
    bullets: ["Gauge trạng thái", "Lịch sử thay đổi", "Không lộ công thức nội bộ"],
  },
  {
    id: "aiden-advisory",
    name: PRODUCT_NAMES.advisory,
    shortName: "Tư vấn",
    label: "Trợ lý đầu tư",
    headline: "Hỏi như đang chat, nhận câu trả lời có bối cảnh dữ liệu.",
    body: "AIDEN hỗ trợ chat thường, giải thích thị trường và phân tích mã cổ phiếu. Khi dữ liệu thiếu, hệ thống nói rõ thay vì tự bịa số.",
    outcome: "Một trợ lý đầu tư dễ dùng hơn bảng chỉ số khô cứng.",
    href: "/terminal",
    icon: Bot,
    scene: "advisory",
    bullets: ["Chat tự nhiên", "Phân tích mã cổ phiếu", "Không ép mọi câu hỏi thành ticker"],
  },
  {
    id: "nexrank",
    name: PRODUCT_NAMES.rsRating,
    shortName: "Xếp hạng",
    label: "Sức mạnh cổ phiếu",
    headline: "Lọc nhanh nhóm cổ phiếu đang khỏe hơn mặt bằng chung.",
    body: "NexRank xếp hạng sức mạnh tương đối để nhà đầu tư ưu tiên quan sát nhóm dẫn dắt. Tính năng này dành cho tài khoản Premium/VIP.",
    outcome: "Tập trung vào danh sách có sức mạnh tốt hơn thị trường.",
    href: "/rs-rating",
    icon: Trophy,
    scene: "rank",
    bullets: ["Điểm RS", "Bảng xếp hạng", "Dành cho Premium/VIP"],
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
    body: "Xem thị trường, thanh khoản, độ rộng và tin quan trọng trên cùng một luồng.",
    icon: BarChart3,
  },
  {
    title: "Chọn cơ hội",
    body: "Theo dõi mã mới phát sinh, trạng thái khuyến nghị và vùng giá cần chú ý.",
    icon: Radar,
  },
  {
    title: "Giữ kỷ luật",
    body: "Mỗi cơ hội có vùng tham khảo, mục tiêu, cắt lỗ và tỷ trọng để tránh quyết định cảm tính.",
    icon: ShieldCheck,
  },
  {
    title: "Hành động an toàn",
    body: "AI chỉ giải thích và cá nhân hóa. Nhà đầu tư luôn xác nhận quyết định cuối cùng.",
    icon: CheckCircle2,
  },
];

const safetyBullets = [
  "Tín hiệu gốc đến từ bộ quét và dữ liệu kiểm soát, không phải do AI tự tạo.",
  `Web, app, Telegram và ${PRODUCT_NAMES.brokerWorkflow} đọc cùng nguồn dữ liệu để tránh lệch thông tin.`,
  "Kết nối tài khoản giao dịch đang ở trạng thái pilot/admin, chưa public cho khách hàng thường.",
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
          {navLinks.map((link) =>
            link.hasDropdown ? (
              <div key={link.href} className="group relative">
                <Link
                  href={link.href}
                  className="inline-flex items-center gap-1 text-sm font-semibold transition-colors"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {link.label}
                  <ChevronDown className="h-3.5 w-3.5" />
                </Link>
                <div
                  className="invisible absolute left-1/2 top-full z-50 mt-3 w-96 -translate-x-1/2 rounded-[1.5rem] border p-2 opacity-0 shadow-2xl transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
                  style={{ background: "var(--surface)", borderColor: "var(--border)" }}
                >
                  <div className="grid gap-1">
                    {productStories.map((product) => {
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
                              {product.outcome}
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
              {productStories.map((product) => (
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

function SectionShell({
  id,
  eyebrow,
  title,
  body,
  children,
  reverse = false,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  body: string;
  children: ReactNode;
  reverse?: boolean;
}) {
  return (
    <section id={id} className="snap-start px-4 py-14 sm:px-6 lg:min-h-[calc(100svh-72px)] lg:px-8 lg:py-20">
      <div className={`mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center ${reverse ? "lg:[&>*:first-child]:order-2" : ""}`}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.58, ease: "easeOut" }}
        >
          <p className="text-xs font-black uppercase tracking-[0.26em]" style={{ color: "var(--primary)" }}>
            {eyebrow}
          </p>
          <h2 className="mt-4 max-w-3xl text-4xl font-black leading-[0.98] tracking-[-0.06em] sm:text-5xl lg:text-6xl" style={{ color: "var(--text-primary)" }}>
            {title}
          </h2>
          <p className="mt-6 max-w-2xl text-base leading-8 sm:text-lg" style={{ color: "var(--text-secondary)" }}>
            {body}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 26, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.62, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      </div>
    </section>
  );
}

function PersonaBadge({ label, sublabel, tone = "primary" }: { label: string; sublabel: string; tone?: "primary" | "gold" | "red" }) {
  const color = tone === "gold" ? "#d97706" : tone === "red" ? "#dc2626" : "var(--primary)";
  return (
    <div className="flex items-center gap-3 rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: "var(--primary-light)", color }}>
        <UserRound className="h-5 w-5" />
      </span>
      <span>
        <span className="block text-sm font-black" style={{ color: "var(--text-primary)" }}>
          {label}
        </span>
        <span className="block text-xs" style={{ color: "var(--text-muted)" }}>
          {sublabel}
        </span>
      </span>
    </div>
  );
}

function HeroVisual() {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border p-4 shadow-2xl" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div
        className="absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(circle at 20% 20%, color-mix(in srgb, var(--primary) 22%, transparent), transparent 32%), radial-gradient(circle at 85% 15%, rgba(217,119,6,0.18), transparent 34%)",
        }}
      />
      <div className="relative grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="grid content-between gap-4 rounded-[1.5rem] border p-4" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--surface) 88%, transparent)" }}>
          <PersonaBadge label="Nhà đầu tư cá nhân" sublabel="Theo dõi thị trường trong ngày" />
          <PersonaBadge label="AIDEN Analyst" sublabel="Giải thích dữ liệu, không tự tạo tín hiệu" tone="gold" />
          <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
              Luồng quyết định
            </p>
            <div className="mt-4 grid gap-2 text-sm font-bold">
              {["Đọc thị trường", "Chọn cơ hội", "Kiểm tra rủi ro", "Tự quyết định"].map((item) => (
                <div key={item} className="flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                  <CheckCircle2 className="h-4 w-4" style={{ color: "var(--primary)" }} />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-[1.5rem] border p-5" style={{ borderColor: "var(--border)", background: "linear-gradient(145deg, var(--surface-2), var(--surface))" }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>
                ADNexus Control Room
              </p>
              <h2 className="mt-2 text-2xl font-black">Một màn hình, nhiều lớp dữ liệu</h2>
            </div>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
              <Sparkles className="h-6 w-6" />
            </span>
          </div>

          <div className="mt-6 grid gap-3">
            {[
              ["Thị trường", "Thanh khoản, độ rộng, chỉ số"],
              ["Cơ hội", "Tín hiệu mới và trạng thái theo dõi"],
              ["Tư vấn", "Chat thường hoặc phân tích mã"],
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
                Quy tắc
              </p>
              <p className="mt-3 text-4xl font-black">SAFE</p>
              <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
                AI hỗ trợ hiểu dữ liệu; hành động cuối cùng luôn do người dùng xác nhận.
              </p>
            </div>
            <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
                Đồng bộ
              </p>
              <p className="mt-3 text-4xl font-black">1 nguồn</p>
              <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
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
    <section id="top" className="relative snap-start overflow-hidden px-4 py-14 sm:px-6 lg:min-h-[calc(100svh-72px)] lg:px-8 lg:py-20">
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(circle at 82% 12%, rgba(46,77,61,0.22), transparent 34%), radial-gradient(circle at 12% 20%, rgba(160,132,92,0.15), transparent 32%)",
        }}
      />
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <p className="text-xs font-black uppercase tracking-[0.24em]" style={{ color: "var(--primary)" }}>
            {BRAND.name} - {BRAND.tagline}
          </p>
          <h1 className="mt-5 max-w-4xl text-5xl font-black leading-[0.92] tracking-[-0.075em] sm:text-6xl lg:text-7xl" style={{ color: "var(--text-primary)" }}>
            Hệ điều hành đầu tư AI cho chứng khoán Việt Nam.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8" style={{ color: "var(--text-secondary)" }}>
            ADNexus giúp nhà đầu tư đọc thị trường, theo dõi cơ hội, giữ kỷ luật và hỏi AIDEN trong một trải nghiệm thống nhất. Dễ hiểu cho người mới, đủ kiểm soát cho người giao dịch nghiêm túc.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/auth?mode=register" className="inline-flex items-center gap-2 rounded-2xl px-5 py-4 text-sm font-black" style={{ background: "var(--primary)", color: "#EBE2CF" }}>
              Dùng thử ADNexus
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="#products" className="inline-flex items-center gap-2 rounded-2xl border px-5 py-4 text-sm font-black" style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--surface)" }}>
              Xem câu chuyện sản phẩm
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-2">
            {productStories.map((item) => (
              <Link
                key={item.id}
                href={`#product-${item.id}`}
                className="rounded-full border px-3 py-1.5 text-xs font-bold"
                style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-secondary)" }}
              >
                {item.name}
              </Link>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.08 }}>
          <HeroVisual />
        </motion.div>
      </div>
    </section>
  );
}

function Workflow() {
  return (
    <section id="workflow" className="snap-start px-4 py-14 sm:px-6 lg:min-h-[calc(100svh-72px)] lg:px-8 lg:py-20">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em]" style={{ color: "var(--primary)" }}>
            Quy trình
          </p>
          <h2 className="mt-3 text-4xl font-black leading-[0.98] tracking-[-0.05em] sm:text-5xl lg:text-6xl" style={{ color: "var(--text-primary)" }}>
            Từ dữ liệu đến hành động có kiểm soát.
          </h2>
          <p className="mt-5 text-base leading-8" style={{ color: "var(--text-secondary)" }}>
            ADNexus không bắt nhà đầu tư đọc hàng chục màn hình rời rạc. Mọi thứ được đưa về một chuỗi hành động dễ hiểu: đọc thị trường, chọn cơ hội, kiểm tra rủi ro, rồi tự quyết định.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {workflowSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ duration: 0.45, delay: index * 0.06 }}
                className="rounded-[1.5rem] border p-5"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
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
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function DashboardScene() {
  const bars = [44, 66, 52, 78, 60, 92, 73, 86];
  return (
    <div className="rounded-[1.7rem] border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
            NexPulse
          </p>
          <p className="mt-2 text-3xl font-black">VNINDEX 1,824.6</p>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            Nhà đầu tư đang xem bức tranh phiên hôm nay
          </p>
        </div>
        <span className="rounded-full px-3 py-1 text-xs font-black" style={{ background: "rgba(22,163,74,0.12)", color: "#16a34a" }}>
          +0.42%
        </span>
      </div>
      <div className="mt-5 flex h-40 items-end gap-2 rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
        {bars.map((height, index) => (
          <motion.div
            key={index}
            initial={{ height: 0 }}
            whileInView={{ height: `${height}%` }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, delay: index * 0.04 }}
            className="flex-1 rounded-t-lg"
            style={{
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

function PilotScene() {
  return (
    <div className="rounded-[1.7rem] border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="grid gap-4 md:grid-cols-[0.75fr_1.25fr]">
        <div className="grid content-between gap-4 rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <PersonaBadge label="Broker workflow" sublabel="Theo dõi cơ hội trong phiên" />
          <div className="rounded-2xl p-4" style={{ background: "var(--primary)", color: "#EBE2CF" }}>
            <p className="text-xs font-black uppercase tracking-[0.18em] opacity-70">Batch mới</p>
            <p className="mt-2 text-4xl font-black">17 mã</p>
            <p className="mt-2 text-sm opacity-80">Chỉ thông báo mã mới phát sinh.</p>
          </div>
        </div>
        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
              Thẻ theo dõi
            </p>
            <span className="rounded-full px-3 py-1 text-xs font-black" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
              Fresh
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
                Đang theo dõi
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                ["Vùng mua", "56.0"],
                ["Mục tiêu", "59.9"],
                ["Cắt lỗ", "54.3"],
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
            Telegram, web và app chỉ nên đọc cùng batch đã được ghi nhận, không gửi trực tiếp từ kết quả quét thô.
          </p>
        </div>
      </div>
    </div>
  );
}

function ArtScene() {
  return (
    <div className="rounded-[1.7rem] border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="grid gap-5 md:grid-cols-[1fr_0.85fr] md:items-center">
        <div className="relative mx-auto h-64 w-64">
          <div
            className="absolute inset-0 rounded-full"
            style={{ background: "conic-gradient(from 220deg, #16a34a 0deg, #eab308 95deg, #f97316 145deg, #ef4444 210deg, transparent 211deg)" }}
          />
          <div className="absolute inset-9 rounded-full" style={{ background: "var(--surface)" }} />
          <div className="absolute inset-0 flex flex-col items-center justify-center pt-12">
            <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
              VN30
            </p>
            <p className="mt-2 text-5xl font-black">2.7</p>
            <p className="text-sm font-black uppercase" style={{ color: "#eab308" }}>
              Trung tính
            </p>
          </div>
        </div>
        <div className="space-y-2">
          {[
            ["An toàn", "Theo dõi"],
            ["Trung tính", "Hiện tại"],
            ["Rủi ro", "Cẩn trọng"],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between rounded-xl border px-3 py-3" style={{ borderColor: "var(--border)" }}>
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {label}
              </span>
              <span className="font-black">{value}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-5 h-24 rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
        <div className="flex h-full items-end gap-1.5">
          {[18, 28, 24, 62, 78, 84, 55, 36, 72, 68, 82, 58].map((height, index) => (
            <div key={index} className="flex-1 rounded-t-md" style={{ height: `${height}%`, background: index % 2 ? "#f59e0b" : "var(--primary)" }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function AdvisoryScene() {
  return (
    <div className="rounded-[1.7rem] border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between rounded-2xl border px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
            <Bot className="h-5 w-5" />
          </span>
          <div>
            <p className="font-black">AIDEN</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Sẵn sàng tư vấn
            </p>
          </div>
        </div>
        <span className="rounded-full px-3 py-1 text-xs font-black" style={{ background: "rgba(22,163,74,0.12)", color: "#16a34a" }}>
          Online
        </span>
      </div>
      <div className="mt-4 space-y-3">
        <div className="ml-auto max-w-[78%] rounded-2xl px-4 py-3 text-sm font-bold" style={{ background: "var(--primary)", color: "#EBE2CF" }}>
          So sánh TCB và EIB giúp tôi.
        </div>
        <div className="max-w-[86%] rounded-2xl border px-4 py-3 text-sm leading-6" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-secondary)" }}>
          Tôi sẽ tách bối cảnh kỹ thuật, cơ bản, dòng tiền và rủi ro. Nếu dữ liệu nào chưa đủ, tôi sẽ nói rõ thay vì tự suy đoán.
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs font-bold">
          {["Kỹ thuật", "Cơ bản", "Tâm lý", "Tin tức"].map((item) => (
            <span key={item} className="rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
              {item}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 rounded-2xl border px-3 py-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <Search className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>
            Hỏi về thị trường, cổ phiếu, chiến lược...
          </span>
        </div>
      </div>
    </div>
  );
}

function RankScene() {
  const rows = [
    ["FPT", 88],
    ["MWG", 82],
    ["TCB", 76],
    ["HPG", 72],
  ] as const;

  return (
    <div className="rounded-[1.7rem] border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
            NexRank
          </p>
          <h3 className="mt-2 text-2xl font-black">Bảng sức mạnh tương đối</h3>
        </div>
        <span className="rounded-full border px-3 py-1 text-xs font-black" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
          Premium/VIP
        </span>
      </div>
      <div className="mt-5 space-y-3">
        {rows.map(([ticker, score]) => (
          <div key={ticker} className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <div className="flex items-center justify-between">
              <span className="font-black">{ticker}</span>
              <span className="text-sm font-black">{score}/100</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${score}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.65 }}
                className="h-full rounded-full"
                style={{ background: "var(--primary)" }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SceneVisual({ kind }: { kind: ProductSceneKind }) {
  if (kind === "pulse") return <DashboardScene />;
  if (kind === "pilot") return <PilotScene />;
  if (kind === "art") return <ArtScene />;
  if (kind === "advisory") return <AdvisoryScene />;
  return <RankScene />;
}

function ProductStory({ product, index }: { product: (typeof productStories)[number]; index: number }) {
  const Icon = product.icon;
  const reverse = index % 2 === 1;

  return (
    <SectionShell id={`product-${product.id}`} eyebrow={product.label} title={product.headline} body={product.body} reverse={reverse}>
      <div className="rounded-[2rem] border p-4 shadow-2xl" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className={`grid gap-5 ${reverse ? "lg:grid-cols-[0.95fr_1.05fr]" : "lg:grid-cols-[1.05fr_0.95fr]"}`}>
          <div className="rounded-[1.5rem] border p-5" style={{ borderColor: "var(--border)", background: "linear-gradient(145deg, var(--surface-2), var(--surface))" }}>
            <div className="flex items-start justify-between gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="rounded-full border px-3 py-1 text-xs font-black" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                {product.shortName}
              </span>
            </div>
            <h3 className="mt-5 text-3xl font-black tracking-[-0.04em]" style={{ color: "var(--text-primary)" }}>
              {product.name}
            </h3>
            <p className="mt-3 text-base leading-7" style={{ color: "var(--text-secondary)" }}>
              {product.outcome}
            </p>
            <div className="mt-6 grid gap-2">
              {product.bullets.map((bullet) => (
                <div key={bullet} className="flex items-center gap-2 text-sm font-bold" style={{ color: "var(--text-secondary)" }}>
                  <CheckCircle2 className="h-4 w-4" style={{ color: "var(--primary)" }} />
                  {bullet}
                </div>
              ))}
            </div>
            <Link href={product.href} className="mt-6 inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
              Mở {product.name}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <SceneVisual kind={product.scene} />
        </div>
      </div>
    </SectionShell>
  );
}

function ProductsStory() {
  return (
    <div id="products">
      {productStories.map((product, index) => (
        <ProductStory key={product.id} product={product} index={index} />
      ))}
    </div>
  );
}

function Safety() {
  return (
    <section id="safety" className="snap-start px-4 py-14 sm:px-6 lg:min-h-[calc(100svh-72px)] lg:px-8 lg:py-20">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em]" style={{ color: "var(--primary)" }}>
            Nguyên tắc vận hành
          </p>
          <h2 className="mt-3 text-4xl font-black leading-[0.98] tracking-[-0.05em] sm:text-5xl lg:text-6xl" style={{ color: "var(--text-primary)" }}>
            AI hỗ trợ. Kỷ luật quyết định.
          </h2>
          <p className="mt-5 text-base leading-8" style={{ color: "var(--text-secondary)" }}>
            AIDEN được thiết kế để giải thích, tóm tắt và cá nhân hóa bối cảnh. Dữ liệu, tín hiệu, rủi ro và trạng thái vận hành đi theo luồng kiểm soát riêng.
          </p>
        </div>
        <div className="rounded-[2rem] border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="grid gap-3">
            {safetyBullets.map((bullet) => (
              <div key={bullet} className="flex gap-3 rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--primary)" }} />
                <p className="text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
                  {bullet}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-2xl p-5" style={{ background: "linear-gradient(135deg, var(--primary), #123729)", color: "#EBE2CF" }}>
            <p className="text-xs font-black uppercase tracking-[0.22em] opacity-75">Trạng thái broker</p>
            <p className="mt-3 text-3xl font-black">Safe preview / Pilot</p>
            <p className="mt-2 text-sm leading-6 opacity-80">
              Các màn public chỉ minh họa workflow. Không hiển thị dữ liệu tài khoản thật và không tự động đặt lệnh.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="snap-start px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 rounded-[2rem] p-6 md:flex-row md:items-center md:justify-between lg:p-8" style={{ background: "linear-gradient(135deg, var(--primary), #123729)", color: "#EBE2CF" }}>
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
      <main className="min-h-screen scroll-smooth lg:snap-y lg:snap-proximity" style={{ background: "var(--page-surface)", color: "var(--text-primary)" }}>
        <Header />
        <Hero />
        <Workflow />
        <ProductsStory />
        <Safety />
        <CTA />
        <Footer />
      </main>
    </PwaEntryRedirect>
  );
}

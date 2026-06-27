"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  ChevronDown,
  LineChart,
  Menu,
  Moon,
  NotebookTabs,
  ScanLine,
  Sparkles,
  Sun,
  TrendingUp,
  X,
} from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { BRAND } from "@/lib/brand/productNames";
import { publicBodyFont } from "./publicFonts";

const toolLinks = [
  {
    label: "ADN Pulse",
    href: "/products/adn-pulse",
    icon: BarChart3,
    description:
      "Nơi tham khảo nhịp đập thị trường: chỉ số, độ rộng, thanh khoản, dòng tiền và mức rủi ro trong ngày.",
  },
  {
    label: "ADN Stock",
    href: "/products/adn-stock",
    icon: LineChart,
    description:
      "Tra cứu từng cổ phiếu cùng AIDEN: biểu đồ, vùng giá, thanh khoản, định giá và bối cảnh rủi ro.",
  },
  {
    label: "ADN Radar",
    href: "/products/adn-radar",
    icon: ScanLine,
    description:
      "Theo dõi tín hiệu đáng chú ý để biết mã nào cần quan sát kỹ hơn trong phiên.",
  },
  {
    label: "ADN Rank",
    href: "/products/adn-rank",
    icon: TrendingUp,
    description:
      "Bảng xếp hạng sức mạnh cổ phiếu và nhóm ngành, giúp tìm nơi dòng tiền khỏe hơn mặt bằng chung.",
  },
  {
    label: "ADN ART",
    href: "/products/adn-art",
    icon: Sparkles,
    description:
      "Theo dõi xu hướng đảo chiều để nhận biết vùng mua, vùng bán và thời điểm cần giảm hưng phấn.",
  },
  {
    label: "ADN Diary",
    href: "/products/adn-diary",
    icon: NotebookTabs,
    description:
      "Ghi lại giao dịch, lý do vào lệnh và cảm xúc để nhận ra thói quen thắng thua của chính mình.",
  },
];

const navLinks = [
  { label: "Trang chủ", href: "/" },
  { label: "Lộ trình", href: "/#journey" },
  { label: "Dịch vụ", href: "/#membership" },
];

export function PublicSiteHeader() {
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDark = theme === "dark";
  const logoSrc = "/brand/logo-square.png";

  const openToolsMenu = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setToolsOpen(true);
  };

  const closeToolsMenu = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setToolsOpen(false), 220);
  };

  return (
    <header
      className={`${publicBodyFont.className} sticky top-0 z-50 border-b backdrop-blur-xl`}
      style={{
        borderColor: "var(--border)",
        background: "color-mix(in srgb, var(--glass-surface-strong) 94%, transparent)",
        color: "var(--text-primary)",
      }}
    >
      <div className="mx-auto flex h-20 max-w-[1680px] items-center justify-between gap-6 px-5 sm:px-8 lg:px-12 xl:px-16">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <span
            className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border"
            style={{ borderColor: "var(--border)" }}
          >
            <Image src={logoSrc} alt={BRAND.name} fill sizes="44px" className="object-cover" priority />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-black leading-tight">{BRAND.name}</span>
            <span className="block truncate text-sm font-normal leading-snug" style={{ color: "var(--text-muted)" }}>
              Hệ thống giao dịch định lượng
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-2 lg:flex">
          <HeaderLink href="/">Trang chủ</HeaderLink>

          <div
            className="relative -my-4 py-4 after:absolute after:left-0 after:top-full after:h-3 after:w-full after:content-['']"
            onMouseEnter={openToolsMenu}
            onMouseLeave={closeToolsMenu}
          >
            <button
              type="button"
              onClick={() => setToolsOpen((value) => !value)}
              className="inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-semibold transition hover:bg-white/8"
              aria-expanded={toolsOpen}
            >
              Công cụ <ChevronDown className={`h-4 w-4 transition ${toolsOpen ? "rotate-180" : ""}`} />
            </button>

            {toolsOpen ? (
              <div
                className="absolute left-1/2 top-[calc(100%-2px)] w-[580px] -translate-x-1/2 pt-2"
                onMouseEnter={openToolsMenu}
                onMouseLeave={closeToolsMenu}
              >
                <div
                  className="grid gap-2 rounded-[1.6rem] border p-3 shadow-2xl"
                  style={{
                    borderColor: "var(--border-strong)",
                    background: "var(--bg-elevated)",
                    boxShadow: "0 26px 70px rgba(0,0,0,0.32)",
                  }}
                >
                  {toolLinks.map((tool) => {
                    const Icon = tool.icon;
                    return (
                      <Link
                        key={tool.href}
                        href={tool.href}
                        className="group grid grid-cols-[36px_1fr] gap-3 rounded-2xl p-3 transition hover:bg-white/8"
                        onClick={() => setToolsOpen(false)}
                      >
                        <span
                          className="flex h-9 w-9 items-center justify-center rounded-xl border"
                          style={{ borderColor: "var(--border)", color: "var(--primary)" }}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span>
                          <span className="block text-sm font-black">{tool.label}</span>
                          <span className="mt-1 block text-sm font-normal leading-6" style={{ color: "var(--text-muted)" }}>
                            {tool.description}
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          {navLinks.slice(1).map((link) => (
            <HeaderLink key={link.href} href={link.href}>
              {link.label}
            </HeaderLink>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-11 w-11 items-center justify-center rounded-full border transition hover:-translate-y-0.5"
            style={{ borderColor: "var(--border)", background: "var(--bg-surface)", color: "var(--primary)" }}
            aria-label="Đổi giao diện sáng tối"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Link
            href="/auth?mode=register"
            className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-black transition hover:-translate-y-0.5"
            style={{ background: "var(--primary)", color: "var(--on-primary)" }}
          >
            Mở tài khoản <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-full border lg:hidden"
          style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
          onClick={() => setMobileOpen((value) => !value)}
          aria-label="Mở menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen ? (
        <div className="border-t px-5 py-5 lg:hidden" style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}>
          <div className="grid gap-2">
            {[...navLinks, { label: "Công cụ", href: "/products" }].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-2xl px-4 py-3 text-base font-semibold"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="my-2 h-px" style={{ background: "var(--border)" }} />
            {toolLinks.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className="rounded-2xl px-4 py-3 text-sm font-normal"
                style={{ color: "var(--text-secondary)" }}
                onClick={() => setMobileOpen(false)}
              >
                {tool.label}
              </Link>
            ))}
            <Link
              href="/auth?mode=register"
              className="mt-3 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black"
              style={{ background: "var(--primary)", color: "var(--on-primary)" }}
              onClick={() => setMobileOpen(false)}
            >
              Mở tài khoản <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function HeaderLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="rounded-full px-4 py-2 text-sm font-semibold transition hover:bg-white/8">
      {children}
    </Link>
  );
}

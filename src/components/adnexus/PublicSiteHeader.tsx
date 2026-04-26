"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Menu, Moon, Sun, X } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { BRAND } from "@/lib/brand/productNames";
import { PRODUCT_MODULES } from "@/lib/brand/nexsuite";

const nav = [
  { label: "Sản phẩm", href: "/#products", dropdown: true },
  { label: "Ứng dụng", href: "/#use-cases" },
  { label: "Tài nguyên", href: "/#resources" },
  { label: "Bảng giá", href: "/pricing" },
  { label: "Liên hệ", href: "/#contact" },
];

export function PublicSiteHeader() {
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const logoSrc = theme === "dark" ? "/brand/logo-dark.jpg" : "/brand/logo-light.jpg";

  return (
    <header
      className="sticky top-0 z-50 border-b backdrop-blur-xl"
      style={{
        background: "color-mix(in srgb, var(--page-surface) 90%, transparent)",
        borderColor: "var(--border)",
      }}
    >
      <div className="flex w-full items-center justify-between px-5 py-3 sm:px-8 lg:px-12 xl:px-16">
        <Link href="/" className="flex items-center gap-3">
          <Image src={logoSrc} alt={BRAND.name} width={44} height={44} className="rounded-xl object-cover" priority />
          <div>
            <p className="text-sm font-black leading-tight" style={{ color: "var(--text-primary)" }}>{BRAND.name}</p>
            <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>{BRAND.tagline}</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          {nav.map((item) =>
            item.dropdown ? (
              <div key={item.href} className="group relative">
                <Link href={item.href} className="text-sm font-bold" style={{ color: "var(--text-secondary)" }}>
                  {item.label}
                </Link>
                <div
                  className="invisible absolute left-1/2 top-8 w-[820px] -translate-x-1/2 rounded-[2rem] border bg-white p-5 opacity-0 shadow-2xl transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 dark:bg-[#07150f]"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div className="grid grid-cols-3 gap-3">
                    {PRODUCT_MODULES.map((product) => (
                      <Link
                        key={product.slug}
                        href={`/#product-${product.slug}`}
                        className="rounded-2xl border p-4 transition hover:-translate-y-0.5"
                        style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-black" style={{ color: "var(--text-primary)" }}>{product.shortName ?? product.name}</p>
                          <span className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>{product.pillar}</span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-xs" style={{ color: "var(--text-secondary)" }}>{product.outcome}</p>
                      </Link>
                    ))}
                  </div>
                  <Link href="/products" className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black" style={{ background: "var(--primary)", color: "white" }}>
                    Xem toàn bộ NexSuite <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ) : (
              <Link key={item.href} href={item.href} className="text-sm font-bold" style={{ color: "var(--text-secondary)" }}>
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-full border p-3"
            style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-primary)" }}
            aria-label="Đổi giao diện"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Link href="/auth" className="rounded-full border px-5 py-3 text-sm font-black" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
            Đăng nhập
          </Link>
          <Link href="/dashboard" className="rounded-full px-5 py-3 text-sm font-black" style={{ background: "var(--primary)", color: "white" }}>
            Dùng thử
          </Link>
        </div>

        <button
          type="button"
          className="rounded-full border p-3 lg:hidden"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          onClick={() => setMobileOpen((value) => !value)}
          aria-label="Mở menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen ? (
        <div className="border-t px-5 py-5 lg:hidden" style={{ borderColor: "var(--border)", background: "var(--page-surface)" }}>
          <div className="grid gap-2">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="rounded-2xl border px-4 py-3 font-bold" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} onClick={() => setMobileOpen(false)}>
                {item.label}
              </Link>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {PRODUCT_MODULES.slice(0, 8).map((product) => (
              <Link key={product.slug} href={`/#product-${product.slug}`} className="rounded-2xl bg-[var(--surface-2)] px-4 py-3 text-sm font-black" style={{ color: "var(--text-primary)" }} onClick={() => setMobileOpen(false)}>
                {product.shortName ?? product.name}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}

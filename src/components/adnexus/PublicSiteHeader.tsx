"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Menu, Moon, Sun, X } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { BRAND, PRODUCT_NAMES } from "@/lib/brand/productNames";

const productLinks = [
  {
    label: PRODUCT_NAMES.market,
    href: "/#product-adn-pulse",
    description: "Đọc chỉ số, thanh khoản và độ rộng thị trường.",
  },
  {
    label: PRODUCT_NAMES.stock,
    href: "/#product-adn-lens",
    description: "Soi từng cổ phiếu qua dữ liệu và AIDEN.",
  },
  {
    label: PRODUCT_NAMES.art,
    href: "/#product-adn-art",
    description: "Đọc trạng thái hành động, rủi ro và xu hướng.",
  },
];

const nav = [
  { label: "Sản phẩm", href: "/#products", dropdown: true },
  { label: "Ứng dụng", href: "/#ecosystem" },
  { label: "Bảng giá", href: "/pricing" },
  { label: "Liên hệ", href: "/#contact" },
];

export function PublicSiteHeader() {
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const logoSrc = theme === "dark" ? "/brand/logo-dark.jpg" : "/brand/logo-light.jpg";

  return (
    <header
      className="fixed left-0 right-0 top-0 z-[80] border-b backdrop-blur-xl"
      style={{
        background: "var(--glass-surface-strong)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-ambient)",
      }}
    >
      <div className="flex w-full items-center justify-between px-5 py-3 sm:px-8 lg:px-12 xl:px-16">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src={logoSrc}
            alt={BRAND.company}
            width={44}
            height={44}
            className="rounded-xl object-cover"
            priority
          />
          <div>
            <p className="text-sm font-black leading-tight" style={{ color: "var(--text-primary)" }}>
              {BRAND.company}
            </p>
            <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
              {BRAND.tagline}
            </p>
          </div>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          {nav.map((item) =>
            item.dropdown ? (
              <div
                key={item.href}
                className="relative"
                onMouseEnter={() => setProductsOpen(true)}
                onMouseLeave={() => setProductsOpen(false)}
                onFocus={() => setProductsOpen(true)}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setProductsOpen(false);
                  }
                }}
              >
                <Link
                  href={item.href}
                  className="cursor-pointer text-sm font-bold transition hover:text-[var(--primary)]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {item.label}
                </Link>
                {productsOpen ? (
                  <div
                    className="absolute left-1/2 top-8 w-[520px] -translate-x-1/2 rounded-[2rem] border p-4 shadow-2xl backdrop-blur-xl"
                    style={{ background: "color-mix(in srgb, var(--bg-surface) 94%, transparent)", borderColor: "var(--border)" }}
                  >
                    <div className="grid gap-3">
                      {productLinks.map((product) => (
                        <Link
                          key={product.href}
                          href={product.href}
                          className="cursor-pointer rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:border-[var(--primary)]"
                          style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
                          onClick={() => setProductsOpen(false)}
                        >
                          <p className="font-black" style={{ color: "var(--text-primary)" }}>
                            {product.label}
                          </p>
                          <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                            {product.description}
                          </p>
                        </Link>
                      ))}
                    </div>
                    <Link
                      href="/products"
                      className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-black"
                      style={{ background: "var(--primary)", color: "var(--on-primary)" }}
                    >
                      Xem toàn bộ hệ sinh thái ADN <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                ) : null}
              </div>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="cursor-pointer text-sm font-bold transition hover:text-[var(--primary)]"
                style={{ color: "var(--text-secondary)" }}
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            aria-label="Đổi giao diện"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Link
            href="/auth"
            className="hidden rounded-full border px-5 py-3 text-sm font-black sm:inline-flex"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          >
            Đăng nhập
          </Link>
          <Link
            href="/auth?mode=register"
            className="hidden rounded-full px-5 py-3 text-sm font-black sm:inline-flex"
            style={{ background: "var(--primary)", color: "var(--on-primary)" }}
          >
            Dùng thử
          </Link>
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border lg:hidden"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            onClick={() => setMobileOpen((value) => !value)}
            aria-label="Mở menu"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div
          className="border-t px-5 py-4 lg:hidden"
          style={{ borderColor: "var(--border)", background: "var(--glass-surface-strong)" }}
        >
          <div className="grid gap-2">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-2xl px-4 py-3 font-bold"
                style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            {productLinks.map((product) => (
              <Link
                key={product.href}
                href={product.href}
                className="rounded-2xl px-4 py-3 text-sm font-bold"
                style={{ color: "var(--text-secondary)" }}
                onClick={() => setMobileOpen(false)}
              >
                {product.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}

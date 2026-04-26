"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Menu, Moon, Sun, X } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { BRAND } from "@/lib/brand/productNames";
import {
  PUBLIC_PRODUCT_MODULES,
  type ProductModule,
  type ProductPillar,
} from "@/lib/brand/nexsuite";

const nav = [
  { label: "Sản phẩm", href: "/#products", dropdown: true },
  { label: "Ứng dụng", href: "/#use-cases" },
  { label: "Tài nguyên", href: "/#resources" },
  { label: "Bảng giá", href: "/pricing" },
  { label: "Liên hệ", href: "/#contact" },
];

const pillarLabels: Record<ProductPillar, string> = {
  Analyst: "Phân tích",
  Discipline: "Kỷ luật",
  Network: "Kết nối",
};

export function PublicSiteHeader() {
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const logoSrc = theme === "dark" ? "/brand/logo-dark.jpg" : "/brand/logo-light.jpg";

  const groupedProducts = useMemo(() => {
    return PUBLIC_PRODUCT_MODULES.reduce<Record<ProductPillar, ProductModule[]>>(
      (groups, product) => {
        groups[product.pillar].push(product);
        return groups;
      },
      { Analyst: [], Discipline: [], Network: [] },
    );
  }, []);

  return (
    <motion.header
      className="fixed inset-x-0 top-0 z-[80] border-b backdrop-blur-xl"
      initial={reduceMotion ? false : { y: -18, opacity: 0 }}
      animate={reduceMotion ? undefined : { y: 0, opacity: 1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      style={{
        background: "color-mix(in srgb, var(--page-surface) 90%, transparent)",
        borderColor: "var(--border)",
      }}
    >
      <div className="adn-motion-frame pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/45 to-transparent" />

      <div className="flex w-full items-center justify-between px-5 py-3 sm:px-8 lg:px-12 xl:px-16">
        <Link href="/" className="flex items-center gap-3">
          <Image src={logoSrc} alt={BRAND.name} width={44} height={44} className="rounded-xl object-cover" priority />
          <div>
            <p className="text-sm font-black leading-tight" style={{ color: "var(--text-primary)" }}>
              {BRAND.name}
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
                  aria-haspopup="menu"
                  aria-expanded={productsOpen}
                >
                  {item.label}
                </Link>

                <AnimatePresence>
                  {productsOpen ? (
                    <motion.div
                      className="absolute left-1/2 top-full w-[920px] -translate-x-1/2 pt-4"
                      initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.98 }}
                      animate={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
                      exit={reduceMotion ? undefined : { opacity: 0, y: 8, scale: 0.98 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                    >
                      <div
                        className="rounded-[2rem] border bg-white/95 p-5 shadow-2xl shadow-black/15 backdrop-blur-xl dark:bg-[#07150f]/95"
                        style={{ borderColor: "var(--border)" }}
                      >
                        <div className="grid grid-cols-3 gap-4">
                          {(Object.keys(groupedProducts) as ProductPillar[]).map((pillar) => (
                            <div key={pillar}>
                              <p className="mb-3 text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>
                                {pillarLabels[pillar]}
                              </p>
                              <div className="grid gap-2">
                                {groupedProducts[pillar].map((product) => (
                                  <Link
                                    key={product.slug}
                                    href={`/#product-${product.slug}`}
                                    className="cursor-pointer rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-lg"
                                    style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
                                    onClick={() => setProductsOpen(false)}
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <p className="font-black" style={{ color: "var(--text-primary)" }}>
                                        {product.shortName ?? product.name}
                                      </p>
                                      <span className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>
                                        {product.status}
                                      </span>
                                    </div>
                                    <p className="mt-2 line-clamp-2 text-xs leading-5" style={{ color: "var(--text-secondary)" }}>
                                      {product.outcome}
                                    </p>
                                  </Link>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>

                        <Link
                          href="/products"
                          className="mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black"
                          style={{ background: "var(--primary)", color: "white" }}
                          onClick={() => setProductsOpen(false)}
                        >
                          Xem toàn bộ NexSuite <ArrowRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            ) : (
              <Link key={item.href} href={item.href} className="text-sm font-bold transition hover:text-[var(--primary)]" style={{ color: "var(--text-secondary)" }}>
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-full border p-3 transition hover:-translate-y-0.5"
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

      <AnimatePresence>
        {mobileOpen ? (
          <motion.div
            className="border-t px-5 py-5 lg:hidden"
            style={{ borderColor: "var(--border)", background: "var(--page-surface)" }}
            initial={reduceMotion ? false : { opacity: 0, y: -8 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
          >
            <div className="grid gap-2">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-2xl border px-4 py-3 font-bold"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {PUBLIC_PRODUCT_MODULES.map((product) => (
                <Link
                  key={product.slug}
                  href={`/#product-${product.slug}`}
                  className="rounded-2xl bg-[var(--surface-2)] px-4 py-3 text-sm font-black"
                  style={{ color: "var(--text-primary)" }}
                  onClick={() => setMobileOpen(false)}
                >
                  {product.shortName ?? product.name}
                </Link>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.header>
  );
}

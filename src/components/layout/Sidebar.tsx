"use client";

import type { ComponentType, CSSProperties } from "react";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  BookOpen,
  DollarSign,
  LayoutDashboard,
  Layers,
  Menu,
  MessageSquare,
  Moon,
  Sun,
  TrendingUp,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useCurrentDbUser } from "@/hooks/useCurrentDbUser";
import { BRAND, PRODUCT_NAMES } from "@/lib/brand/productNames";

const navItems: Array<{
  href: string;
  label: string;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  badge: string | null;
  adminOnly?: boolean;
}> = [
  { href: "/dashboard", label: PRODUCT_NAMES.dashboard, icon: LayoutDashboard, badge: null },
  { href: "/san-pham", label: `Bộ công cụ ${BRAND.name}`, icon: Layers, badge: null },
  { href: "/journal", label: "ADN Diary", icon: BookOpen, badge: null },
  { href: "/terminal", label: PRODUCT_NAMES.advisory, icon: MessageSquare, badge: "HOT" },
  { href: "/dashboard/signal-map", label: PRODUCT_NAMES.brokerWorkflow, icon: Zap, badge: null },
  { href: "/dashboard/dnse-trading", label: PRODUCT_NAMES.brokerConnect, icon: Wallet, badge: null },
  { href: "/art", label: PRODUCT_NAMES.art, icon: TrendingUp, badge: "MỚI" },
  { href: "/pricing", label: "Bảng giá", icon: DollarSign, badge: null },
  { href: "/margin", label: "Ký quỹ - Mua nhanh", icon: Banknote, badge: "MỚI" },
];

function getBadgeStyle(badge: string | null): CSSProperties {
  if (!badge) return {};

  if (badge === "HOT") {
    return {
      background: "rgba(192,57,43,0.10)",
      color: "#C0392B",
      border: "1px solid rgba(192,57,43,0.25)",
    };
  }

  if (badge === "PILOT") {
    return {
      background: "rgba(245,158,11,0.12)",
      color: "#f59e0b",
      border: "1px solid rgba(245,158,11,0.25)",
    };
  }

  return {
    background: "var(--primary-light)",
    color: "var(--primary)",
    border: "1px solid var(--border)",
  };
}

interface MarketData {
  value: number;
  changePercent: number;
}

export function Sidebar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { isAdmin } = useCurrentDbUser();
  const isDark = theme === "dark";
  const [vnindex, setVnindex] = useState<MarketData | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    async function fetchMarket() {
      try {
        const res = await fetch("/api/market");
        if (!res.ok) return;
        const data = await res.json();
        if (data.vnindex) setVnindex(data.vnindex);
      } catch {
        // Sidebar ticker is decorative; failures should not block navigation.
      }
    }

    fetchMarket();
    const interval = setInterval(fetchMarket, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const sidebarContent = (
    <>
      <div
        className="flex items-center justify-between border-b"
        style={{
          padding: "24px 16px",
          borderColor: "var(--border, #E8E4DB)",
        }}
      >
        <div className="flex items-center gap-3">
          <Image src="/brand/favicon.png" alt={BRAND.name} width={36} height={36} className="rounded-xl" />
          <div>
            <p className="text-sm font-bold leading-tight" style={{ color: "var(--text-primary, #173627)" }}>
              {BRAND.name}
            </p>
            <p className="text-[12px] leading-tight" style={{ color: "var(--text-secondary, #7D8471)" }}>
              {BRAND.tagline}
            </p>
          </div>
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden p-1.5 rounded-lg transition-all"
          style={{ color: "var(--text-secondary, #7D8471)" }}
          aria-label="Đóng menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div
        className="border-b"
        style={{
          padding: "12px 16px",
          borderColor: "var(--border, #E8E4DB)",
        }}
      >
        <div className="flex items-center gap-2 text-xs">
          <TrendingUp className="w-3 h-3" style={{ color: "var(--primary, #2E4D3D)" }} />
          <span style={{ color: "var(--text-secondary, #7D8471)" }}>VN-Index</span>
          {vnindex ? (
            <>
              <span
                className="font-mono font-medium ml-auto"
                style={{ color: vnindex.changePercent >= 0 ? "#10b981" : "#c0614a" }}
              >
                {vnindex.value.toLocaleString("vi-VN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <span
                className="text-[12px]"
                style={{ color: vnindex.changePercent >= 0 ? "#10b981" : "#c0614a" }}
              >
                {vnindex.changePercent >= 0 ? "+" : ""}
                {vnindex.changePercent.toFixed(2)}%
              </span>
            </>
          ) : (
            <span
              className="font-mono font-medium ml-auto animate-pulse"
              style={{ color: "var(--text-muted, #B0ADA4)" }}
            >
              --
            </span>
          )}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto" style={{ padding: "24px 16px" }}>
        <p
          className="px-0 mb-2"
          style={{
            fontSize: "11px",
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--text-muted, #B0ADA4)",
          }}
        >
          Menu
        </p>
        {navItems
          .filter((item) => !item.adminOnly || isAdmin)
          .map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link key={item.href} href={item.href}>
                <div
                  className="relative flex items-center gap-3 rounded-lg text-sm cursor-pointer group transition-all duration-150 active:scale-[0.98]"
                  style={{
                    padding: "10px 12px",
                    borderRadius: "10px",
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? "var(--primary, #2E4D3D)" : "var(--text-secondary, #7D8471)",
                    background: isActive ? "var(--primary-light, rgba(46,77,61,0.10))" : "transparent",
                  }}
                >
                  <Icon
                    className="w-4 h-4 flex-shrink-0 transition-colors"
                    style={{ color: isActive ? "var(--primary, #2E4D3D)" : "var(--text-secondary, #7D8471)" }}
                  />
                  <span className="flex-1 font-medium">{item.label}</span>
                  {item.badge && (
                    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md" style={getBadgeStyle(item.badge)}>
                      {item.badge}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
      </nav>

      <div
        className="border-t"
        style={{
          padding: "16px",
          borderColor: "var(--border, #E8E4DB)",
        }}
      >
        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-3 rounded-lg text-sm transition-all"
          style={{
            padding: "10px 12px",
            color: "var(--text-secondary, #7D8471)",
          }}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          <span>{isDark ? "Giao diện sáng" : "Giao diện tối"}</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 md:hidden p-2 rounded-xl shadow-lg"
        style={{
          background: "var(--surface, #FFFFFF)",
          color: "var(--text-primary, #173627)",
          border: "1px solid var(--border, #E8E4DB)",
        }}
        aria-label="Mở menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} aria-label="Đóng menu" />
          <aside
            className="absolute left-0 top-0 bottom-0 w-72 shadow-2xl flex flex-col"
            style={{ background: "var(--surface, #FFFFFF)" }}
          >
            {sidebarContent}
          </aside>
        </div>
      )}

      <aside
        className="hidden md:flex md:fixed md:left-0 md:top-0 md:bottom-0 md:w-72 md:flex-col md:z-30"
        style={{
          background: "var(--surface, #FFFFFF)",
          borderRight: "1px solid var(--border, #E8E4DB)",
        }}
      >
        {sidebarContent}
      </aside>

      <div className="hidden md:block md:w-72 flex-shrink-0" />
    </>
  );
}

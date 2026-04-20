"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useCurrentDbUser } from "@/hooks/useCurrentDbUser";
import {
  LayoutDashboard,
  BarChart2,
  MessageSquare,
  Zap,
  DollarSign,
  BookOpen,
  TrendingUp,
  Menu,
  X,
  Layers,
  Banknote,
  Wallet,
  Sun,
  Moon,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, badge: null },
  { href: "/san-pham", label: "Sản Phẩm & Dịch Vụ", icon: Layers, badge: null },
  { href: "/journal", label: "Nhật Ký Giao Dịch", icon: BookOpen, badge: null },
  { href: "/terminal", label: "Chat AI", icon: MessageSquare, badge: "HOT" },
  { href: "/dashboard/signal-map", label: "ADN AI Broker", icon: Zap, badge: null },
  { href: "/dashboard/dnse-trading", label: "DNSE Trading", icon: Wallet, badge: "MỚI" },
  { href: "/art", label: "ART", icon: TrendingUp, badge: "MỚI" },
  { href: "/margin", label: "Ký Quỹ Margin", icon: Banknote, badge: "MỚI" },
  { href: "/pricing", label: "Bảng Giá", icon: DollarSign, badge: null },
];

function getBadgeStyle(badge: string | null): React.CSSProperties {
  if (!badge) return {};
  if (badge === "HOT") {
    return {
      background: "rgba(192,57,43,0.10)",
      color: "#C0392B",
      border: "1px solid rgba(192,57,43,0.25)",
    };
  }
  // MỚI or default
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
        // silent
      }
    }
    fetchMarket();
    const interval = setInterval(fetchMarket, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Đóng sidebar khi chuyển trang trên mobile
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const sidebarContent = (
    <>
      {/* Logo */}
      <div
        className="flex items-center justify-between border-b"
        style={{
          padding: "24px 16px",
          borderColor: "var(--border, #E8E4DB)",
        }}
      >
        <div className="flex items-center gap-3">
          <Image
            src="/logo.jpg"
            alt="ADN Capital"
            width={36}
            height={36}
            className="rounded-xl"
          />
          <div>
            <p
              className="text-sm font-bold leading-tight"
              style={{ color: "var(--text-primary, #EBE2CF)" }}
            >
              ADN Capital
            </p>
            <p
              className="text-[12px] leading-tight"
              style={{ color: "var(--text-secondary, #9aab9e)" }}
            >
              Investment System
            </p>
          </div>
        </div>
        {/* Nút đóng trên mobile */}
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden p-1.5 rounded-lg transition-all"
          style={{
            color: "var(--text-secondary, #9aab9e)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "var(--primary-light, rgba(23,54,39,0.40))";
            (e.currentTarget as HTMLButtonElement).style.color =
              "var(--text-primary, #EBE2CF)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.color =
              "var(--text-secondary, #9aab9e)";
          }}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Market mini ticker */}
      <div
        className="border-b"
        style={{
          padding: "12px 16px",
          borderColor: "var(--border, #E8E4DB)",
        }}
      >
        <div className="flex items-center gap-2 text-xs">
          <TrendingUp className="w-3 h-3" style={{ color: "var(--primary, #2E4D3D)" }} />
          <span style={{ color: "var(--text-secondary, #9aab9e)" }}>VN-Index</span>
          {vnindex ? (
            <>
              <span
                className="font-mono font-medium ml-auto"
                style={{
                  color: vnindex.changePercent >= 0 ? "#10b981" : "#c0614a",
                }}
              >
                {vnindex.value.toLocaleString("vi-VN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <span
                className="text-[12px]"
                style={{
                  color: vnindex.changePercent >= 0 ? "#10b981" : "#c0614a",
                }}
              >
                {vnindex.changePercent >= 0 ? "+" : ""}
                {vnindex.changePercent.toFixed(2)}%
              </span>
            </>
          ) : (
            <span
              className="text-neutral-600 font-mono font-medium ml-auto animate-pulse"
              style={{ color: "var(--text-muted, #5a6b5e)" }}
            >
              --
            </span>
          )}
        </div>
      </div>

      {/* Navigation */}
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
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link key={item.href} href={item.href}>
              <div
                className="relative flex items-center gap-3 rounded-lg text-sm cursor-pointer group transition-all duration-150 active:scale-[0.98]"
                style={{
                  padding: "10px 12px",
                  borderRadius: "10px",
                  fontWeight: isActive ? 600 : 500,
                  color: isActive
                    ? "var(--primary, #2E4D3D)"
                    : "var(--text-secondary, #7D8471)",
                  background: isActive
                    ? "var(--primary-light, rgba(46,77,61,0.10))"
                    : "transparent",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLDivElement).style.background =
                      "var(--bg-hover, #F3F1EB)";
                    (e.currentTarget as HTMLDivElement).style.color =
                      "var(--primary, #2E4D3D)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLDivElement).style.background =
                      "transparent";
                    (e.currentTarget as HTMLDivElement).style.color =
                      "var(--text-secondary, #7D8471)";
                  }
                }}
              >
                <Icon
                  className="w-4 h-4 flex-shrink-0 transition-colors"
                  style={{
                    color: isActive
                      ? "var(--primary, #2E4D3D)"
                      : "var(--text-secondary, #7D8471)",
                  }}
                />
                <span className="flex-1 font-medium">{item.label}</span>
                {item.badge && (
                  <span
                    className="text-[11px] font-bold px-1.5 py-0.5 rounded-md"
                    style={getBadgeStyle(item.badge)}
                  >
                    {item.badge}
                  </span>
                )}
                {isActive && (
                  <div
                    className="absolute right-0 top-2 bottom-2 w-0.5 rounded-l-full"
                    style={{ background: "var(--primary, #2E4D3D)" }}
                  />
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Theme Toggle */}
      <div
        className="border-t"
        style={{
          padding: "12px 16px",
          borderColor: "var(--border, #E8E4DB)",
        }}
      >
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-between rounded-lg transition-all"
          style={{
            padding: "10px 12px",
            color: "var(--text-secondary, #7D8471)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "var(--bg-hover, #F3F1EB)";
            (e.currentTarget as HTMLButtonElement).style.color =
              "var(--primary, #2E4D3D)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.color =
              "var(--text-secondary, #7D8471)";
          }}
        >
          <div className="flex items-center gap-3">
            {isDark ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
            <span className="text-[14px] font-medium">
              {isDark ? "Light Mode" : "Dark Mode"}
            </span>
          </div>
        </button>
      </div>

      {/* Footer */}
      <div
        className="border-t"
        style={{
          padding: "16px",
          borderColor: "var(--border, #E8E4DB)",
        }}
      >
        <p
          className="text-[12px] text-center font-medium tracking-wide"
          style={{ color: "var(--text-muted, #B0ADA4)" }}
        >
          Powered by{" "}
          <span
            className="font-bold"
            style={{ color: "var(--text-secondary, #7D8471)" }}
          >
            ADN CAPITAL
          </span>
        </p>
      </div>
    </>
  );

  return (
    <>
      {/* Nút hamburger trên mobile */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 p-2 rounded-xl transition-all"
        style={{
          background: "var(--bg-surface, #FFFFFF)",
          border: "1px solid var(--border, #E8E4DB)",
          color: "var(--text-secondary, #7D8471)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color =
            "var(--primary, #2E4D3D)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color =
            "var(--text-secondary, #7D8471)";
        }}
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Overlay khi mở sidebar trên mobile */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-[55]"
          style={{ background: "rgba(0,0,0,0.60)" }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar desktop: luôn hiện; Mobile: slide in/out */}
      <aside
        className="flex flex-col h-screen fixed left-0 top-0 z-[60] transition-transform duration-300 ease-in-out"
        style={{
          width: "240px",
          background: "var(--bg-surface, #FFFFFF)",
          borderRight: "1px solid var(--border, #E8E4DB)",
          transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
        }}
      >
        <style jsx global>{`
          @media (min-width: 768px) {
            aside {
              transform: translateX(0) !important;
            }
          }
        `}</style>
        {sidebarContent}
      </aside>
    </>
  );
}

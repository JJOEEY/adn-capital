"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
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
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, badge: null },
  { href: "/san-pham", label: "Sản Phẩm & Dịch Vụ", icon: Layers, badge: null },
  { href: "/journal", label: "Nhật Ký Giao Dịch", icon: BookOpen, badge: null },
  { href: "/terminal", label: "Chat AI", icon: MessageSquare, badge: "HOT" },
  { href: "/dashboard/signal-map", label: "ADN AI Broker", icon: Zap, badge: null },
  { href: "/tei", label: "ART", icon: TrendingUp, badge: "MỚI" },
  { href: "/margin", label: "Ký Quỹ Margin", icon: Banknote, badge: "MỚI" },
  { href: "/pricing", label: "Bảng Giá", icon: DollarSign, badge: null },
];

interface MarketData {
  value: number;
  changePercent: number;
}

export function Sidebar() {
  const pathname = usePathname();
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
      <div className="flex items-center justify-between px-5 py-5 border-b border-neutral-800/60">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.jpg"
            alt="ADN Capital"
            width={36}
            height={36}
            className="rounded-xl"
          />
          <div>
            <p className="text-sm font-bold text-white leading-tight">ADN Capital</p>
            <p className="text-[12px] text-neutral-500 leading-tight">Investment System</p>
          </div>
        </div>
        {/* Nút đóng trên mobile */}
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800 transition-all"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Market mini ticker */}
      <div className="px-5 py-3 border-b border-neutral-800/60">
        <div className="flex items-center gap-2 text-xs">
          <TrendingUp className="w-3 h-3 text-emerald-400" />
          <span className="text-neutral-500">VN-Index</span>
          {vnindex ? (
            <>
              <span className={`font-mono font-medium ml-auto ${vnindex.changePercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {vnindex.value.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className={`text-[12px] ${vnindex.changePercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {vnindex.changePercent >= 0 ? "+" : ""}{vnindex.changePercent.toFixed(2)}%
              </span>
            </>
          ) : (
            <span className="text-neutral-600 font-mono font-medium ml-auto animate-pulse">--</span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 text-[12px] font-semibold text-neutral-600 uppercase tracking-widest mb-2">
          Menu
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link key={item.href} href={item.href}>
              <div
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm cursor-pointer group transition-all duration-150 hover:translate-x-0.5 active:scale-[0.98] ${
                  isActive
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                    : "text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800/50"
                }`}
              >
                <Icon
                  className={`w-4 h-4 flex-shrink-0 transition-colors ${
                    isActive ? "text-emerald-400" : "group-hover:text-neutral-300"
                  }`}
                />
                <span className="flex-1 font-medium">{item.label}</span>
                {item.badge && (
                  <span className="text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-md">
                    {item.badge}
                  </span>
                )}
                {isActive && (
                  <div className="absolute right-0 top-2 bottom-2 w-0.5 bg-emerald-400 rounded-l-full" />
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-neutral-800/60">
        <p className="text-[12px] text-neutral-600 text-center font-medium tracking-wide">
          Powered by <span className="text-emerald-500/70 font-bold">ADN CAPITAL</span>
        </p>
      </div>
    </>
  );

  return (
    <>
      {/* Nút hamburger trên mobile */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 p-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white transition-all"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Overlay khi mở sidebar trên mobile */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-[55] backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar desktop: luôn hiện; Mobile: slide in/out */}
      <aside
        className={`flex flex-col w-64 h-screen bg-neutral-950 border-r border-neutral-800/60 fixed left-0 top-0 z-[60] transition-transform duration-300 ease-in-out
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}

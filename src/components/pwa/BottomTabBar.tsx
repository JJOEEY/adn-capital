"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Bot,
  ChartCandlestick,
  Crosshair,
  Eye,
  FlaskConical,
  Home,
  LayoutGrid,
  Newspaper,
  NotebookTabs,
  Receipt,
  TrendingUp,
  User,
  X,
} from "lucide-react";

const tabs = [
  { href: "/dashboard", label: "Pulse", icon: Home },
  { href: "/dashboard/signal-map", label: "Radar", icon: Crosshair },
  { href: "/stock", label: "Cổ phiếu", icon: ChartCandlestick },
  { href: "/aiden", label: "AIDEN", icon: Bot },
];

const moreTools = [
  { href: "/watchlist", label: "Theo dõi", icon: Eye },
  { href: "/rs-rating", label: "Xếp hạng", icon: TrendingUp },
  { href: "/art", label: "Chỉ báo ART", icon: Activity },
  { href: "/journal", label: "Nhật ký", icon: NotebookTabs },
  { href: "/backtest", label: "ADN Lab", icon: FlaskConical },
  { href: "/tin-tuc", label: "Tin tức", icon: Newspaper },
  { href: "/pricing", label: "Bảng giá", icon: Receipt },
  { href: "/profile", label: "Hồ sơ", icon: User },
];

export function BottomTabBar() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname === href || pathname.startsWith(`${href}/`);

  const moreActive = moreTools.some((t) => pathname === t.href || pathname.startsWith(`${t.href}/`));

  const hapticTap = () => {
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(50);
    }
  };

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.45)" }} />
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className="absolute bottom-0 left-0 right-0 rounded-t-[28px] border-t px-5 pt-3"
            style={{
              background: "var(--bg-page)",
              borderColor: "var(--border)",
              paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: "var(--border-strong)" }} />
            <div className="mb-4 flex items-center justify-between">
              <p className="text-base font-black" style={{ color: "var(--text-primary)" }}>Công cụ khác</p>
              <button onClick={() => setMoreOpen(false)} aria-label="Đóng" style={{ color: "var(--text-muted)" }}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-x-3 gap-y-4">
              {moreTools.map((t) => {
                const Icon = t.icon;
                return (
                  <Link
                    key={t.href}
                    href={t.href}
                    onClick={() => {
                      hapticTap();
                      setMoreOpen(false);
                    }}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <span
                      className="flex h-14 w-14 items-center justify-center rounded-2xl border"
                      style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--primary)" }}
                    >
                      <Icon className="h-[22px] w-[22px]" />
                    </span>
                    <span className="text-center text-[11px] font-semibold leading-tight" style={{ color: "var(--text-secondary)" }}>
                      {t.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t safe-area-bottom lg:hidden"
        style={{
          background: "color-mix(in srgb, var(--surface) 92%, transparent)",
          borderColor: "var(--border)",
          backdropFilter: "blur(18px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div className="mx-auto grid h-16 max-w-xl grid-cols-5 items-center px-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab.href);
            return (
              <Link key={tab.href} href={tab.href} className="min-w-0" onClick={hapticTap}>
                <div className="relative flex flex-col items-center gap-0.5 py-1.5">
                  {active && (
                    <motion.div
                      layoutId="bottomTabIndicator"
                      className="absolute -top-1.5 h-0.5 w-5 rounded-full"
                      style={{ background: "var(--primary)" }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                  <Icon className="h-5 w-5 transition-colors duration-200" style={{ color: active ? "var(--primary)" : "var(--text-muted)" }} />
                  <span
                    className="text-center text-[10px] font-semibold leading-tight transition-colors duration-200"
                    style={{ color: active ? "var(--primary)" : "var(--text-muted)" }}
                  >
                    {tab.label}
                  </span>
                </div>
              </Link>
            );
          })}

          <button type="button" onClick={() => { hapticTap(); setMoreOpen((v) => !v); }} className="min-w-0">
            <div className="relative flex flex-col items-center gap-0.5 py-1.5">
              {moreActive && (
                <motion.div
                  layoutId="bottomTabIndicator"
                  className="absolute -top-1.5 h-0.5 w-5 rounded-full"
                  style={{ background: "var(--primary)" }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <LayoutGrid className="h-5 w-5 transition-colors duration-200" style={{ color: moreActive || moreOpen ? "var(--primary)" : "var(--text-muted)" }} />
              <span className="text-center text-[10px] font-semibold leading-tight transition-colors duration-200" style={{ color: moreActive || moreOpen ? "var(--primary)" : "var(--text-muted)" }}>
                Thêm
              </span>
            </div>
          </button>
        </div>
      </nav>
    </>
  );
}

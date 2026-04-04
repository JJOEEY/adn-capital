"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Bell,
  LogIn,
  LogOut,
  Crown,
  UserCircle,
  Menu,
  X,
  ChevronDown,
  Sun,
  Moon,
} from "lucide-react";
import { useCurrentDbUser } from "@/hooks/useCurrentDbUser";
import { USAGE_LIMITS } from "@/lib/utils";
import { useTheme } from "@/components/providers/ThemeProvider";

/* ── Nav items ── */
const navItems = [
  { href: "/", label: "Trang Chủ" },
  { href: "/san-pham", label: "Sản Phẩm & Dịch Vụ" },
  { href: "/dashboard", label: "Dashboard", hasDropdown: true },
  { href: "/journal", label: "Nhật Ký" },
  { href: "/backtest", label: "Backtest" },
];

/* ── Dropdown: Dashboard ── */
const dropdownItems = [
  { href: "/terminal", label: "Tư vấn đầu tư", desc: "AI Advisor 24/7", badge: null },
  { href: "/dashboard/rs-rating", label: "RS Rating", desc: "Xếp hạng sức mạnh cổ phiếu", badge: null },
  { href: "/margin", label: "Ký Quỹ High Margin", desc: "Tối ưu đòn bẩy tài chính", badge: "HOT" },
  { href: "/tei", label: "Chỉ báo TEI", desc: "Chỉ số kỹ thuật nâng cao", badge: "MỚI" },
  { href: "/khoa-hoc", label: "Khóa học", desc: "Đào tạo & chứng chỉ đầu tư", badge: null },
];

/* ── Liquid Glass helpers ── */
const glass = (isDark: boolean) =>
  isDark
    ? "bg-white/[0.06] backdrop-blur-2xl border border-white/[0.12] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_8px_32px_-8px_rgba(0,0,0,0.5)]"
    : "bg-white/50 backdrop-blur-2xl border border-white/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.7),0_8px_32px_-8px_rgba(0,0,0,0.12)]";

const glassHover = (isDark: boolean) =>
  isDark ? "hover:bg-white/[0.1]" : "hover:bg-white/70";

export function Header() {
  const pathname = usePathname();
  const { dbUser, role, vipTier, isAuthenticated, isAdmin, isLoading } = useCurrentDbUser();
  const { data: session } = useSession();
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownHover, setDropdownHover] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => setDropdownHover(false), [pathname]);

  const isDark = theme === "dark";

  const handleMouseEnter = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setDropdownHover(true);
  };
  const handleMouseLeave = () => {
    hoverTimeout.current = setTimeout(() => setDropdownHover(false), 200);
  };

  const showSkeleton = !mounted || isLoading;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  const isDropdownActive = dropdownItems.some((s) => isActive(s.href));

  return (
    <header className="fixed top-0 left-0 right-0 z-50 p-3 pb-0">
      <div
        className={`rounded-2xl h-16 transition-all duration-500 ${glass(isDark)}`}
      >
        <div className="flex items-center justify-between h-full px-4 md:px-6 max-w-[1600px] mx-auto">
          {/* ── Left: Logo + Theme Toggle ── */}
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/" className="flex items-center gap-2.5 group">
              <Image
                src="/logo.jpg"
                alt="ADN Capital"
                width={36}
                height={36}
                className="rounded-xl ring-1 ring-white/10 group-hover:ring-emerald-500/30 transition-all"
              />
              <span className="text-xl font-bold hidden sm:inline">
                <span className="text-emerald-400 drop-shadow-[0_0_12px_rgba(16,185,129,0.4)]">ADN</span>
                <span className={isDark ? "text-white/90" : "text-slate-800"}> Capital</span>
              </span>
            </Link>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className={`ml-2 p-2 rounded-xl transition-all duration-300 ${
                isDark
                  ? "text-amber-400/70 hover:text-amber-300 hover:bg-white/[0.08]"
                  : "text-slate-500 hover:text-slate-700 hover:bg-black/[0.05]"
              }`}
              title={isDark ? "Light mode" : "Dark mode"}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>

          {/* ── Center: Nav items (desktop) ── */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {navItems.map((item) => {
              const active = isActive(item.href);

              if (item.hasDropdown) {
                return (
                  <div
                    key={item.label}
                    ref={dropdownRef}
                    className="relative"
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                  >
                    <Link href={item.href}>
                      <div
                        className={`flex items-center gap-1 px-4 py-2 text-[13px] font-medium rounded-xl transition-all duration-300 cursor-pointer ${
                          isDropdownActive || dropdownHover
                            ? isDark
                              ? "text-white bg-white/[0.08]"
                              : "text-slate-900 bg-black/[0.06]"
                            : isDark
                            ? "text-white/60 hover:text-white hover:bg-white/[0.06]"
                            : "text-slate-500 hover:text-slate-800 hover:bg-black/[0.04]"
                        }`}
                      >
                        {item.label}
                        <ChevronDown
                          className={`w-3 h-3 transition-transform duration-300 ${
                            dropdownHover ? "rotate-180" : ""
                          }`}
                        />
                      </div>
                    </Link>

                    {/* ── Dropdown Menu ── */}
                    <AnimatePresence>
                      {dropdownHover && (
                        <motion.div
                          initial={{ opacity: 0, y: 8, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 8, scale: 0.96 }}
                          transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                          className={`absolute top-full left-1/2 -translate-x-1/2 mt-3 w-[320px] rounded-2xl p-2 z-50 ${glass(isDark)}`}
                        >
                          {dropdownItems.map((dItem) => (
                            <Link key={dItem.href} href={dItem.href}>
                              <div
                                className={`px-3 py-2.5 rounded-xl transition-all duration-300 group ${
                                  isActive(dItem.href)
                                    ? isDark
                                      ? "bg-white/[0.08]"
                                      : "bg-emerald-500/10"
                                    : isDark
                                    ? "hover:bg-white/[0.06]"
                                    : "hover:bg-black/[0.04]"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <p
                                    className={`text-sm font-medium transition-colors duration-300 ${
                                      isActive(dItem.href)
                                        ? "text-emerald-400"
                                        : isDark
                                        ? "text-white/80 group-hover:text-white"
                                        : "text-slate-700 group-hover:text-slate-900"
                                    }`}
                                  >
                                    {dItem.label}
                                  </p>
                                  {dItem.badge && (
                                    <span
                                      className={`text-[9px] font-black px-1.5 py-0 rounded-md ${
                                        dItem.badge === "HOT"
                                          ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                                          : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                      }`}
                                    >
                                      {dItem.badge}
                                    </span>
                                  )}
                                </div>
                                <p
                                  className={`text-xs mt-0.5 ${
                                    isDark ? "text-white/30" : "text-slate-400"
                                  }`}
                                >
                                  {dItem.desc}
                                </p>
                              </div>
                            </Link>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              }

              return (
                <Link key={item.label} href={item.href}>
                  <div
                    className={`px-4 py-2 text-[13px] font-medium rounded-xl transition-all duration-300 ${
                      active
                        ? isDark
                          ? "text-white bg-white/[0.08]"
                          : "text-slate-900 bg-black/[0.06]"
                        : isDark
                        ? "text-white/60 hover:text-white hover:bg-white/[0.06]"
                        : "text-slate-500 hover:text-slate-800 hover:bg-black/[0.04]"
                    }`}
                  >
                    {item.label}
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* ── Right: Tools ── */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Search */}
            <button
              className={`p-2 rounded-xl transition-all duration-300 ${
                isDark
                  ? "text-white/40 hover:text-white hover:bg-white/[0.06]"
                  : "text-slate-400 hover:text-slate-700 hover:bg-black/[0.04]"
              }`}
            >
              <Search className="w-[17px] h-[17px]" />
            </button>

            {/* Notification Bell */}
            <button
              className={`p-2 rounded-xl transition-all duration-300 relative ${
                isDark
                  ? "text-white/40 hover:text-white hover:bg-white/[0.06]"
                  : "text-slate-400 hover:text-slate-700 hover:bg-black/[0.04]"
              }`}
            >
              <Bell className="w-[17px] h-[17px]" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_6px_rgba(16,185,129,0.7)]" />
            </button>

            {/* Auth / Avatar */}
            {showSkeleton ? (
              <div className={`w-8 h-8 rounded-full animate-pulse ${isDark ? "bg-white/10" : "bg-slate-200"}`} />
            ) : isAuthenticated ? (
              <div className="flex items-center gap-2">
                {role === "VIP" && (
                  <span
                    className={`hidden sm:flex items-center gap-1 text-[9px] font-bold border px-2 py-0.5 rounded-lg backdrop-blur-sm ${
                      vipTier === "PREMIUM"
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/25"
                        : "bg-purple-500/10 text-purple-400 border-purple-500/25"
                    }`}
                  >
                    <Crown className="w-2.5 h-2.5" />
                    {vipTier === "PREMIUM" ? "PREMIUM" : "VIP"}
                  </span>
                )}
                <Link href="/profile" className="hover:opacity-80 transition-opacity">
                  {session?.user?.image ? (
                    <img
                      src={session.user.image}
                      alt=""
                      className={`w-8 h-8 rounded-full ring-2 transition-all ${
                        isDark ? "ring-white/15 hover:ring-emerald-500/40" : "ring-white/60 hover:ring-emerald-500/40"
                      }`}
                    />
                  ) : (
                    <UserCircle className={`w-8 h-8 ${isDark ? "text-white/30" : "text-slate-400"}`} />
                  )}
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className={`p-2 rounded-xl transition-all duration-300 ${
                    isDark
                      ? "text-white/30 hover:text-red-400 hover:bg-white/[0.06]"
                      : "text-slate-400 hover:text-red-500 hover:bg-red-50/50"
                  }`}
                  title="Đăng xuất"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link href="/auth">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className={`flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl transition-all duration-300 ${
                    isDark
                      ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20"
                      : "text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15"
                  }`}
                >
                  <LogIn className="w-4 h-4" />
                  Đăng nhập
                </motion.button>
              </Link>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className={`lg:hidden p-2 rounded-xl transition-all ${
                isDark
                  ? "text-white/50 hover:text-white hover:bg-white/[0.06]"
                  : "text-slate-500 hover:text-slate-800 hover:bg-black/[0.04]"
              }`}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile menu ── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 top-[76px] bg-black/40 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.nav
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              className={`mt-2 rounded-2xl z-50 lg:hidden p-3 space-y-1 ${glass(isDark)}`}
            >
              {navItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <div key={item.label}>
                    <Link href={item.href}>
                      <div
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                          active
                            ? isDark
                              ? "bg-white/[0.08] text-emerald-400"
                              : "bg-emerald-500/10 text-emerald-600"
                            : isDark
                            ? "text-white/50 hover:text-white hover:bg-white/[0.06]"
                            : "text-slate-500 hover:text-slate-800 hover:bg-black/[0.04]"
                        }`}
                      >
                        {item.label}
                      </div>
                    </Link>
                    {item.hasDropdown && (
                      <div className={`ml-4 mt-1 space-y-0.5 pl-4 border-l ${isDark ? "border-white/[0.06]" : "border-slate-200/60"}`}>
                        {dropdownItems.map((sub) => (
                          <Link key={sub.href} href={sub.href}>
                            <div
                              className={`px-3 py-2 rounded-lg text-xs transition-all ${
                                isActive(sub.href)
                                  ? "text-emerald-400"
                                  : isDark
                                  ? "text-white/35 hover:text-white hover:bg-white/[0.06]"
                                  : "text-slate-400 hover:text-slate-800 hover:bg-black/[0.04]"
                              }`}
                            >
                              {sub.label}
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}

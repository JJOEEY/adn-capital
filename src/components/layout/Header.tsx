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
  BarChart2,
  MessageSquare,
  Zap,
  BookOpen,
  Home,
  FlaskConical,
  Users,
  Activity,
  Banknote,
  LayoutDashboard,
} from "lucide-react";
import { useCurrentDbUser } from "@/hooks/useCurrentDbUser";
import { USAGE_LIMITS } from "@/lib/utils";
import { useTheme } from "@/components/providers/ThemeProvider";

/* ── Nav items ── */
const navItems = [
  { href: "/", label: "Thị trường", icon: Home },
  { href: "/dashboard", label: "Giải pháp đầu tư", icon: LayoutDashboard, hasDropdown: true },
  { href: "/journal", label: "Góc nhìn đầu tư", icon: BookOpen },
  { href: "/backtest", label: "Cộng tác", icon: FlaskConical },
  { href: "/admin", label: "Quản Lý", icon: Users, adminOnly: true },
];

/* ── Dropdown: Giải pháp đầu tư (2 cột) ── */
const dropdownCol1 = [
  { href: "/san-pham", label: "Quản lý tài sản", desc: "Chiến lược phân bổ danh mục" },
  { href: "/dashboard", label: "Quản lý đầu tư", desc: "Dashboard phân tích thị trường" },
  { href: "/terminal", label: "Tư vấn đầu tư", desc: "AI Advisor 24/7" },
];

const dropdownCol2 = [
  { href: "/dashboard/rs-rating", label: "RS Rating", desc: "Xếp hạng sức mạnh cổ phiếu", icon: BarChart2, badge: null },
  { href: "/margin", label: "Ký Quỹ High Margin", desc: "Tối ưu đòn bẩy tài chính", icon: Banknote, badge: "HOT" },
  { href: "/tei", label: "Khoá học", desc: "Đào tạo & chứng chỉ đầu tư", icon: Activity, badge: null },
];

export function Header() {
  const pathname = usePathname();
  const { dbUser, role, vipTier, isAuthenticated, isAdmin, isLoading } = useCurrentDbUser();
  const { data: session } = useSession();
  const { theme } = useTheme();
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

  const limit = USAGE_LIMITS[role] ?? 3;
  const usage = dbUser?.chatCount ?? 0;
  const showSkeleton = !mounted || isLoading;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  const isServiceActive = [...dropdownCol1, ...dropdownCol2].some((s) => isActive(s.href));

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 h-20 transition-colors duration-300 ${
        isDark
          ? "bg-[#020617]/70 border-b border-white/10"
          : "bg-white/70 border-b border-slate-200/60"
      } backdrop-blur-lg`}
    >
      <div className="flex items-center justify-between h-full px-4 md:px-8 max-w-[1600px] mx-auto">
        {/* ── Left: Logo ── */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
          <Image
            src="/logo.jpg"
            alt="ADN Capital"
            width={38}
            height={38}
            className="rounded-xl ring-1 ring-white/10 group-hover:ring-emerald-500/30 transition-all"
          />
          <span className="text-2xl font-bold hidden sm:inline">
            <span className="text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]">ADN</span>
            <span className={isDark ? "text-white" : "text-slate-900"}> Capital</span>
          </span>
        </Link>

        {/* ── Center: Nav items (desktop) ── */}
        <nav className="hidden lg:flex items-center gap-1 mx-4">
          {navItems
            .filter((item) => !item.adminOnly || isAdmin)
            .map((item) => {
              const active = isActive(item.href);

              if (item.hasDropdown) {
                return (
                  <div
                    key={item.href}
                    ref={dropdownRef}
                    className="relative"
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                  >
                    <Link href={item.href}>
                      <div
                        className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all duration-300 cursor-pointer relative ${
                          isServiceActive || dropdownHover
                            ? isDark
                              ? "text-white"
                              : "text-slate-900"
                            : isDark
                            ? "text-slate-300 hover:text-white"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {item.label}
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform duration-300 ${
                            dropdownHover ? "rotate-180" : ""
                          }`}
                        />
                        {(isServiceActive || dropdownHover) && (
                          <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-emerald-500 shadow-[0_4px_15px_rgba(16,185,129,0.4)] rounded-full" />
                        )}
                      </div>
                    </Link>

                    {/* ── Dropdown Menu ── */}
                    <AnimatePresence>
                      {dropdownHover && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 8 }}
                          transition={{ duration: 0.3, ease: "easeOut" }}
                          className={`absolute top-full left-1/2 -translate-x-1/2 mt-4 w-[520px] rounded-2xl border shadow-2xl z-50 overflow-hidden ${
                            isDark
                              ? "bg-slate-900/80 backdrop-blur-[40px] border-white/10 shadow-[0_10px_40px_-10px_rgba(16,185,129,0.15)]"
                              : "bg-white/90 backdrop-blur-[40px] border-slate-200/60 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)]"
                          }`}
                        >
                          <div className="grid grid-cols-2 gap-0 p-3">
                            {/* ── Column 1 ── */}
                            <div className="space-y-0.5 pr-3 border-r border-white/5">
                              <p
                                className={`text-[10px] font-bold uppercase tracking-widest px-3 py-2 ${
                                  isDark ? "text-slate-500" : "text-slate-400"
                                }`}
                              >
                                Dịch vụ tư vấn
                              </p>
                              {dropdownCol1.map((item) => (
                                <Link key={item.href} href={item.href}>
                                  <div
                                    className={`px-3 py-2.5 rounded-lg transition-all duration-300 group ${
                                      isActive(item.href)
                                        ? isDark
                                          ? "bg-white/5"
                                          : "bg-emerald-50"
                                        : isDark
                                        ? "hover:bg-white/5"
                                        : "hover:bg-slate-50"
                                    }`}
                                  >
                                    <p
                                      className={`text-sm font-medium transition-colors duration-300 ${
                                        isActive(item.href)
                                          ? "text-emerald-400"
                                          : isDark
                                          ? "text-slate-300 group-hover:text-white"
                                          : "text-slate-700 group-hover:text-slate-900"
                                      }`}
                                    >
                                      {item.label}
                                    </p>
                                    <p
                                      className={`text-xs mt-0.5 ${
                                        isDark ? "text-slate-500" : "text-slate-400"
                                      }`}
                                    >
                                      {item.desc}
                                    </p>
                                  </div>
                                </Link>
                              ))}
                            </div>

                            {/* ── Column 2: Hệ thống Quant ── */}
                            <div className="space-y-0.5 pl-3">
                              <p
                                className={`text-[10px] font-bold uppercase tracking-widest px-3 py-2 ${
                                  isDark ? "text-slate-500" : "text-slate-400"
                                }`}
                              >
                                Hệ thống Quant
                              </p>
                              {dropdownCol2.map((item) => (
                                <Link key={item.href} href={item.href}>
                                  <div
                                    className={`px-3 py-2.5 rounded-lg transition-all duration-300 group ${
                                      isActive(item.href)
                                        ? isDark
                                          ? "bg-white/5"
                                          : "bg-emerald-50"
                                        : isDark
                                        ? "hover:bg-white/5"
                                        : "hover:bg-slate-50"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <p
                                        className={`text-sm font-medium transition-colors duration-300 ${
                                          isActive(item.href)
                                            ? "text-emerald-400"
                                            : isDark
                                            ? "text-slate-300 group-hover:text-white"
                                            : "text-slate-700 group-hover:text-slate-900"
                                        }`}
                                      >
                                        {item.label}
                                      </p>
                                      {item.badge && (
                                        <span className="text-[9px] font-black bg-orange-500/20 text-orange-400 border border-orange-500/30 px-1.5 py-0 rounded shadow-[0_0_8px_rgba(249,115,22,0.3)]">
                                          {item.badge}
                                        </span>
                                      )}
                                    </div>
                                    <p
                                      className={`text-xs mt-0.5 ${
                                        isDark ? "text-slate-500" : "text-slate-400"
                                      }`}
                                    >
                                      {item.desc}
                                    </p>
                                  </div>
                                </Link>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              }

              return (
                <Link key={item.href} href={item.href}>
                  <div
                    className={`px-4 py-2.5 text-sm font-medium transition-all duration-300 relative ${
                      active
                        ? isDark
                          ? "text-white"
                          : "text-slate-900"
                        : isDark
                        ? "text-slate-300 hover:text-white"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {item.label}
                    {active && (
                      <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-emerald-500 shadow-[0_4px_15px_rgba(16,185,129,0.4)] rounded-full" />
                    )}
                  </div>
                </Link>
              );
            })}
        </nav>

        {/* ── Right: Tools ── */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Search */}
          <button
            className={`p-2.5 rounded-xl transition-all duration-300 ${
              isDark
                ? "text-slate-400 hover:text-white hover:bg-white/5"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Search className="w-[18px] h-[18px]" />
          </button>

          {/* Notification Bell */}
          <button
            className={`p-2.5 rounded-xl transition-all duration-300 relative ${
              isDark
                ? "text-slate-400 hover:text-white hover:bg-white/5"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Bell className="w-[18px] h-[18px]" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_6px_rgba(16,185,129,0.7)]" />
          </button>

          {/* Auth / Avatar */}
          {showSkeleton ? (
            <div className="w-9 h-9 rounded-full bg-slate-800 animate-pulse" />
          ) : isAuthenticated ? (
            <div className="flex items-center gap-2.5">
              {role === "VIP" && (
                <span
                  className={`hidden sm:flex items-center gap-1 text-[9px] font-bold border px-2 py-0.5 rounded-lg ${
                    vipTier === "PREMIUM"
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/25"
                      : "bg-purple-500/10 text-purple-400 border-purple-500/25"
                  }`}
                >
                  <Crown className="w-2.5 h-2.5" />
                  {vipTier === "PREMIUM" ? "PREMIUM" : "VIP"}
                </span>
              )}
              <Link href="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                {session?.user?.image ? (
                  <img
                    src={session.user.image}
                    alt=""
                    className={`w-9 h-9 rounded-full ring-2 transition-all ${
                      isDark ? "ring-white/10 hover:ring-emerald-500/40" : "ring-slate-200 hover:ring-emerald-500/40"
                    }`}
                  />
                ) : (
                  <UserCircle className={`w-9 h-9 ${isDark ? "text-slate-600" : "text-slate-400"}`} />
                )}
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className={`p-2 rounded-xl transition-all duration-300 ${
                  isDark
                    ? "text-slate-500 hover:text-red-400 hover:bg-white/5"
                    : "text-slate-400 hover:text-red-500 hover:bg-red-50"
                }`}
                title="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link href="/auth">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-1.5 text-sm text-emerald-400 border border-emerald-500/35 px-4 py-2 rounded-xl bg-emerald-500/8 hover:bg-emerald-500/15 transition-all font-medium"
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
                ? "text-slate-400 hover:text-white hover:bg-white/5"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
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
              className="fixed inset-0 top-20 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.nav
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className={`absolute top-20 left-0 right-0 z-50 lg:hidden p-4 space-y-1 border-b ${
                isDark
                  ? "bg-[#020617]/95 backdrop-blur-2xl border-white/10"
                  : "bg-white/95 backdrop-blur-2xl border-slate-200"
              }`}
            >
              {navItems
                .filter((item) => !item.adminOnly || isAdmin)
                .map((item) => {
                  const active = isActive(item.href);
                  return (
                    <div key={item.href}>
                      <Link href={item.href}>
                        <div
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                            active
                              ? isDark
                                ? "bg-white/5 text-emerald-400"
                                : "bg-emerald-50 text-emerald-600"
                              : isDark
                              ? "text-slate-400 hover:text-white hover:bg-white/5"
                              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                          }`}
                        >
                          {item.label}
                        </div>
                      </Link>
                      {item.hasDropdown && (
                        <div className={`ml-4 mt-1 space-y-0.5 pl-4 border-l ${isDark ? "border-white/5" : "border-slate-200"}`}>
                          {[...dropdownCol1, ...dropdownCol2].map((sub) => (
                            <Link key={sub.href} href={sub.href}>
                              <div
                                className={`px-3 py-2 rounded-lg text-xs transition-all ${
                                  isActive(sub.href)
                                    ? "text-emerald-400"
                                    : isDark
                                    ? "text-slate-500 hover:text-white hover:bg-white/5"
                                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
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

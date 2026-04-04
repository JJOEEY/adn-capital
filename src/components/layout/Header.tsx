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
  ChevronRight,
  Sun,
  Moon,
  Home,
  ShoppingBag,
  LayoutDashboard,
  BookOpen,
  FlaskConical,
  MessageSquare,
  BarChart2,
  Banknote,
  Activity,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";
import { useCurrentDbUser } from "@/hooks/useCurrentDbUser";
import { useTheme } from "@/components/providers/ThemeProvider";

/* ── Nav items ── */
const navItems = [
  { href: "/", label: "Trang Chủ", icon: Home },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, hasDropdown: true },
  { href: "/journal", label: "Nhật Ký", icon: BookOpen },
  { href: "/backtest", label: "Backtest", icon: FlaskConical },
];

/* ── Dropdown: Dashboard ── */
const dropdownItems = [
  { href: "/terminal", label: "Tư vấn đầu tư", desc: "AI Advisor 24/7", icon: MessageSquare, badge: null },
  { href: "/dashboard/rs-rating", label: "RS Rating", desc: "Xếp hạng sức mạnh cổ phiếu", icon: BarChart2, badge: null },
  { href: "/margin", label: "Ký Quỹ High Margin", desc: "Tối ưu đòn bẩy tài chính", icon: Banknote, badge: "HOT" },
  { href: "/tei", label: "Chỉ báo TEI", desc: "Chỉ số kỹ thuật nâng cao", icon: Activity, badge: "MỚI" },
  { href: "/khoa-hoc", label: "Khóa học", desc: "Đào tạo & chứng chỉ đầu tư", icon: GraduationCap, badge: null },
];

/* ── Liquid Glass helpers ── */
const glass = (isDark: boolean) =>
  isDark
    ? "bg-white/[0.06] backdrop-blur-2xl border border-white/[0.12] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_8px_32px_-8px_rgba(0,0,0,0.5)]"
    : "bg-white/50 backdrop-blur-2xl border border-white/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.7),0_8px_32px_-8px_rgba(0,0,0,0.12)]";

const glassDense = (isDark: boolean) =>
  isDark
    ? "bg-[#0c1425]/90 backdrop-blur-2xl border border-white/[0.1] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_16px_48px_-12px_rgba(0,0,0,0.7)]"
    : "bg-white/80 backdrop-blur-2xl border border-white/70 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.8),0_16px_48px_-12px_rgba(0,0,0,0.15)]";

export function Header() {
  const pathname = usePathname();
  const { role, vipTier, isAuthenticated, isLoading, isAdmin } = useCurrentDbUser();
  const { data: session } = useSession();
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileCollapsed, setMobileCollapsed] = useState(false);
  const [dropdownHover, setDropdownHover] = useState(false);
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(true);
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

  const sidebarW = mobileCollapsed ? "w-[68px]" : "w-[260px]";

  return (
    <>
      {/* ── Desktop Header ── */}
      <header className="fixed top-0 left-0 right-0 z-50 p-3 pb-0 hidden lg:block">
        <div className={`rounded-2xl h-16 transition-all duration-500 ${glass(isDark)}`}>
          <div className="flex items-center justify-between h-full px-4 md:px-6 max-w-[1600px] mx-auto">
            {/* Left: Logo + Theme Toggle */}
            <div className="flex items-center gap-2 shrink-0">
              <Link href="/" className="flex items-center gap-2.5 group">
                <Image src="/logo.jpg" alt="ADN Capital" width={36} height={36}
                  className="rounded-xl ring-1 ring-white/10 group-hover:ring-emerald-500/30 transition-all" />
                <span className="text-xl font-bold">
                  <span className="text-emerald-400 drop-shadow-[0_0_12px_rgba(16,185,129,0.4)]">ADN</span>
                  <span className={isDark ? "text-white/90" : "text-slate-800"}> Capital</span>
                </span>
              </Link>
              <button onClick={toggleTheme}
                className={`ml-2 p-2 rounded-xl transition-all duration-300 ${
                  isDark ? "text-amber-400/70 hover:text-amber-300 hover:bg-white/[0.08]"
                    : "text-slate-500 hover:text-slate-700 hover:bg-black/[0.05]"
                }`} title={isDark ? "Light mode" : "Dark mode"}>
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>

            {/* Center: Nav */}
            <nav className="flex items-center gap-0.5">
              {navItems.map((item) => {
                const active = isActive(item.href);
                if (item.hasDropdown) {
                  return (
                    <div key={item.label} ref={dropdownRef} className="relative"
                      onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
                      <Link href={item.href}>
                        <div className={`flex items-center gap-1 px-4 py-2 text-[13px] font-medium rounded-xl transition-all duration-300 cursor-pointer ${
                          isDropdownActive || dropdownHover
                            ? isDark ? "text-white bg-white/[0.08]" : "text-slate-900 bg-black/[0.06]"
                            : isDark ? "text-white/60 hover:text-white hover:bg-white/[0.06]"
                              : "text-slate-500 hover:text-slate-800 hover:bg-black/[0.04]"
                        }`}>
                          {item.label}
                          <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${dropdownHover ? "rotate-180" : ""}`} />
                        </div>
                      </Link>

                      {/* Dropdown - with backdrop overlay */}
                      <AnimatePresence>
                        {dropdownHover && (
                          <>
                            {/* Subtle backdrop dimming */}
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.15 }}
                              className="fixed inset-0 bg-black/20 z-40"
                              style={{ top: "76px" }}
                            />
                            <motion.div
                              initial={{ opacity: 0, y: 8, scale: 0.96 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 8, scale: 0.96 }}
                              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                              className={`absolute top-full left-1/2 -translate-x-1/2 mt-3 w-[320px] rounded-2xl p-2 z-50 ${glassDense(isDark)}`}
                            >
                              {dropdownItems.map((dItem) => {
                                const DIcon = dItem.icon;
                                return (
                                  <Link key={dItem.href} href={dItem.href}>
                                    <div className={`flex items-start gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 group ${
                                      isActive(dItem.href)
                                        ? isDark ? "bg-white/[0.08]" : "bg-emerald-500/10"
                                        : isDark ? "hover:bg-white/[0.06]" : "hover:bg-black/[0.04]"
                                    }`}>
                                      <div className={`mt-0.5 p-1.5 rounded-lg ${
                                        isActive(dItem.href)
                                          ? "bg-emerald-500/15 text-emerald-400"
                                          : isDark ? "bg-white/[0.06] text-white/40 group-hover:text-white/70" : "bg-black/[0.04] text-slate-400"
                                      }`}>
                                        <DIcon className="w-3.5 h-3.5" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <p className={`text-sm font-medium transition-colors ${
                                            isActive(dItem.href) ? "text-emerald-400"
                                              : isDark ? "text-white/90 group-hover:text-white" : "text-slate-700 group-hover:text-slate-900"
                                          }`}>{dItem.label}</p>
                                          {dItem.badge && (
                                            <span className={`text-[9px] font-black px-1.5 py-0 rounded-md ${
                                              dItem.badge === "HOT"
                                                ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                                                : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                            }`}>{dItem.badge}</span>
                                          )}
                                        </div>
                                        <p className={`text-xs mt-0.5 ${isDark ? "text-white/35" : "text-slate-400"}`}>{dItem.desc}</p>
                                      </div>
                                    </div>
                                  </Link>
                                );
                              })}
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                }
                return (
                  <Link key={item.label} href={item.href}>
                    <div className={`px-4 py-2 text-[13px] font-medium rounded-xl transition-all duration-300 ${
                      active
                        ? isDark ? "text-white bg-white/[0.08]" : "text-slate-900 bg-black/[0.06]"
                        : isDark ? "text-white/60 hover:text-white hover:bg-white/[0.06]" : "text-slate-500 hover:text-slate-800 hover:bg-black/[0.04]"
                    }`}>{item.label}</div>
                  </Link>
                );
              })}
            </nav>

            {/* Admin link — only for admins */}
            {isAdmin && (
              <Link href="/admin">
                <div className={`px-4 py-2 text-[13px] font-medium rounded-xl transition-all duration-300 flex items-center gap-1.5 ${
                  isActive("/admin")
                    ? isDark ? "text-amber-400 bg-amber-500/10" : "text-amber-600 bg-amber-50"
                    : isDark ? "text-amber-400/60 hover:text-amber-400 hover:bg-white/[0.06]" : "text-amber-600/60 hover:text-amber-600 hover:bg-amber-50/50"
                }`}>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Quản Lý
                </div>
              </Link>
            )}

            {/* Right: Tools */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button className={`p-2 rounded-xl transition-all duration-300 ${
                isDark ? "text-white/40 hover:text-white hover:bg-white/[0.06]" : "text-slate-400 hover:text-slate-700 hover:bg-black/[0.04]"
              }`}><Search className="w-[17px] h-[17px]" /></button>
              <button className={`p-2 rounded-xl transition-all duration-300 relative ${
                isDark ? "text-white/40 hover:text-white hover:bg-white/[0.06]" : "text-slate-400 hover:text-slate-700 hover:bg-black/[0.04]"
              }`}>
                <Bell className="w-[17px] h-[17px]" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_6px_rgba(16,185,129,0.7)]" />
              </button>
              {showSkeleton ? (
                <div className={`w-8 h-8 rounded-full animate-pulse ${isDark ? "bg-white/10" : "bg-slate-200"}`} />
              ) : isAuthenticated ? (
                <div className="flex items-center gap-2">
                  {role === "VIP" && (
                    <span className={`flex items-center gap-1 text-[9px] font-bold border px-2 py-0.5 rounded-lg backdrop-blur-sm ${
                      vipTier === "PREMIUM" ? "bg-amber-500/10 text-amber-400 border-amber-500/25" : "bg-purple-500/10 text-purple-400 border-purple-500/25"
                    }`}><Crown className="w-2.5 h-2.5" />{vipTier === "PREMIUM" ? "PREMIUM" : "VIP"}</span>
                  )}
                  <Link href="/profile" className="hover:opacity-80 transition-opacity">
                    {session?.user?.image ? (
                      <img src={session.user.image} alt=""
                        className={`w-8 h-8 rounded-full ring-2 transition-all ${isDark ? "ring-white/15 hover:ring-emerald-500/40" : "ring-white/60 hover:ring-emerald-500/40"}`} />
                    ) : (
                      <UserCircle className={`w-8 h-8 ${isDark ? "text-white/30" : "text-slate-400"}`} />
                    )}
                  </Link>
                  <button onClick={() => signOut({ callbackUrl: "/" })}
                    className={`p-2 rounded-xl transition-all duration-300 ${isDark ? "text-white/30 hover:text-red-400 hover:bg-white/[0.06]" : "text-slate-400 hover:text-red-500 hover:bg-red-50/50"}`}
                    title="Đăng xuất"><LogOut className="w-4 h-4" /></button>
                </div>
              ) : (
                <Link href="/auth">
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    className={`flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl transition-all duration-300 ${
                      isDark ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20"
                        : "text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15"
                    }`}><LogIn className="w-4 h-4" />Đăng nhập</motion.button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Mobile: Top bar ── */}
      <header className={`fixed top-0 left-0 right-0 z-50 h-14 lg:hidden transition-all duration-300 ${
        isDark ? "bg-[#0c1425]/90 backdrop-blur-xl border-b border-white/[0.06]" : "bg-white/80 backdrop-blur-xl border-b border-slate-200/60"
      }`}>
        <div className="flex items-center justify-between h-full px-3">
          <button onClick={() => setMobileOpen(!mobileOpen)}
            className={`p-2 rounded-xl transition-all ${isDark ? "text-white/60 hover:text-white hover:bg-white/[0.08]" : "text-slate-500 hover:text-slate-800 hover:bg-black/[0.04]"}`}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.jpg" alt="ADN Capital" width={28} height={28} className="rounded-lg" />
            <span className="text-base font-bold">
              <span className="text-emerald-400">ADN</span>
              <span className={isDark ? "text-white/90" : "text-slate-800"}> Capital</span>
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <button onClick={toggleTheme}
              className={`p-2 rounded-xl transition-all ${isDark ? "text-amber-400/70 hover:text-amber-300" : "text-slate-500 hover:text-slate-700"}`}>
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            {showSkeleton ? (
              <div className={`w-7 h-7 rounded-full animate-pulse ${isDark ? "bg-white/10" : "bg-slate-200"}`} />
            ) : isAuthenticated ? (
              <Link href="/profile">
                {session?.user?.image ? (
                  <img src={session.user.image} alt="" className="w-7 h-7 rounded-full ring-1 ring-white/15" />
                ) : (
                  <UserCircle className={`w-7 h-7 ${isDark ? "text-white/30" : "text-slate-400"}`} />
                )}
              </Link>
            ) : (
              <Link href="/auth" className="text-emerald-400 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <LogIn className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ── Mobile: Sidebar overlay ── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Mobile: Left sidebar drawer ── */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 lg:hidden transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${sidebarW} ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${isDark
          ? "bg-[#0a1020]/95 backdrop-blur-2xl border-r border-white/[0.08]"
          : "bg-white/90 backdrop-blur-2xl border-r border-slate-200/60"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar header */}
          <div className={`flex items-center h-14 px-3 border-b shrink-0 ${isDark ? "border-white/[0.06]" : "border-slate-200/60"}`}>
            {!mobileCollapsed ? (
              <div className="flex items-center justify-between w-full">
                <Link href="/" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
                  <Image src="/logo.jpg" alt="" width={28} height={28} className="rounded-lg" />
                  <span className="text-sm font-bold">
                    <span className="text-emerald-400">ADN</span>
                    <span className={isDark ? "text-white/90" : "text-slate-800"}> Capital</span>
                  </span>
                </Link>
                <button onClick={() => setMobileCollapsed(true)}
                  className={`p-1.5 rounded-lg transition-all ${isDark ? "text-white/40 hover:text-white hover:bg-white/[0.08]" : "text-slate-400 hover:text-slate-700 hover:bg-black/[0.04]"}`}>
                  <ChevronRight className="w-4 h-4 rotate-180" />
                </button>
              </div>
            ) : (
              <button onClick={() => setMobileCollapsed(false)} className="mx-auto p-1.5 rounded-lg transition-all">
                <Image src="/logo.jpg" alt="" width={28} height={28} className="rounded-lg" />
              </button>
            )}
          </div>

          {/* Nav items */}
          <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 scrollbar-none">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              const hasDropdown = item.hasDropdown;
              const hasActiveChild = hasDropdown && dropdownItems.some((d) => isActive(d.href));

              return (
                <div key={item.label}>
                  {hasDropdown ? (
                    <button
                      onClick={() => {
                        if (mobileCollapsed) { setMobileCollapsed(false); setMobileDropdownOpen(true); }
                        else setMobileDropdownOpen(!mobileDropdownOpen);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                        hasActiveChild
                          ? isDark ? "text-emerald-400 bg-emerald-500/10" : "text-emerald-600 bg-emerald-50"
                          : isDark ? "text-white/50 hover:text-white hover:bg-white/[0.06]" : "text-slate-500 hover:text-slate-800 hover:bg-black/[0.04]"
                      } ${mobileCollapsed ? "justify-center px-0" : ""}`}
                    >
                      <Icon className="w-[18px] h-[18px] shrink-0" />
                      {!mobileCollapsed && (
                        <>
                          <span className="flex-1 text-left">{item.label}</span>
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${mobileDropdownOpen ? "rotate-180" : ""}`} />
                        </>
                      )}
                    </button>
                  ) : (
                    <Link href={item.href} onClick={() => setMobileOpen(false)}>
                      <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                        active
                          ? isDark ? "text-emerald-400 bg-emerald-500/10" : "text-emerald-600 bg-emerald-50"
                          : isDark ? "text-white/50 hover:text-white hover:bg-white/[0.06]" : "text-slate-500 hover:text-slate-800 hover:bg-black/[0.04]"
                      } ${mobileCollapsed ? "justify-center px-0" : ""}`}>
                        <Icon className="w-[18px] h-[18px] shrink-0" />
                        {!mobileCollapsed && <span>{item.label}</span>}
                      </div>
                    </Link>
                  )}

                  {/* Dropdown children */}
                  {hasDropdown && !mobileCollapsed && (
                    <AnimatePresence>
                      {mobileDropdownOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className={`ml-3 mt-1 space-y-0.5 pl-3 border-l ${isDark ? "border-white/[0.06]" : "border-slate-200/60"}`}>
                            {dropdownItems.map((sub) => {
                              const SubIcon = sub.icon;
                              const subActive = isActive(sub.href);
                              return (
                                <Link key={sub.href} href={sub.href} onClick={() => setMobileOpen(false)}>
                                  <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                                    subActive
                                      ? isDark ? "text-emerald-400 bg-emerald-500/10" : "text-emerald-600 bg-emerald-50"
                                      : isDark ? "text-white/40 hover:text-white hover:bg-white/[0.06]" : "text-slate-400 hover:text-slate-800 hover:bg-black/[0.04]"
                                  }`}>
                                    <SubIcon className="w-3.5 h-3.5 shrink-0" />
                                    <span className="flex-1">{sub.label}</span>
                                    {sub.badge && (
                                      <span className={`text-[8px] font-black px-1.5 rounded ${
                                        sub.badge === "HOT" ? "bg-orange-500/20 text-orange-400" : "bg-emerald-500/20 text-emerald-400"
                                      }`}>{sub.badge}</span>
                                    )}
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Admin link — mobile */}
          {isAdmin && (
            <div className="px-2 mt-1">
              <Link href="/admin" onClick={() => setMobileOpen(false)}>
                <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                  isActive("/admin")
                    ? isDark ? "text-amber-400 bg-amber-500/10" : "text-amber-600 bg-amber-50"
                    : isDark ? "text-amber-400/60 hover:text-amber-400 hover:bg-white/[0.06]" : "text-amber-600/60 hover:text-amber-600 hover:bg-amber-50/50"
                } ${mobileCollapsed ? "justify-center px-0" : ""}`}>
                  <ShieldCheck className="w-[18px] h-[18px] shrink-0" />
                  {!mobileCollapsed && <span>Quản Lý</span>}
                </div>
              </Link>
            </div>
          )}

          {/* Sidebar footer */}
          <div className={`shrink-0 border-t px-2 py-3 space-y-1 ${isDark ? "border-white/[0.06]" : "border-slate-200/60"}`}>
            {isAuthenticated && (
              <button onClick={() => { signOut({ callbackUrl: "/" }); setMobileOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all ${
                  isDark ? "text-red-400/60 hover:text-red-400 hover:bg-red-500/10" : "text-red-500/60 hover:text-red-500 hover:bg-red-50"
                } ${mobileCollapsed ? "justify-center px-0" : ""}`}>
                <LogOut className="w-[18px] h-[18px] shrink-0" />
                {!mobileCollapsed && <span>Đăng xuất</span>}
              </button>
            )}
            {!isAuthenticated && (
              <Link href="/auth" onClick={() => setMobileOpen(false)}>
                <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all ${
                  isDark ? "text-emerald-400 bg-emerald-500/10" : "text-emerald-600 bg-emerald-50"
                } ${mobileCollapsed ? "justify-center px-0" : ""}`}>
                  <LogIn className="w-[18px] h-[18px] shrink-0" />
                  {!mobileCollapsed && <span>Đăng nhập</span>}
                </div>
              </Link>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LogIn,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  Home,
  LayoutDashboard,
  BarChart2,
  Activity,
  MessageSquare,
  Banknote,
  BookOpen,
  FlaskConical,
  ShieldCheck,
  Send,
  Info,
  Zap,
  ChevronLeft,
  ChevronRight,
  Crown,
  Newspaper,
} from "lucide-react";
import { useCurrentDbUser } from "@/hooks/useCurrentDbUser";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useSidebarStore } from "@/store/sidebarStore";

/* ---------- Menu structure ---------- */
interface MenuItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  external?: boolean;
  badge?: string;
  roles?: string[];
}
interface MenuSection {
  title: string;
  items: MenuItem[];
  adminOnly?: boolean;
}

const menuSections: MenuSection[] = [
  {
    title: "",
    items: [{ href: "/", label: "Trang Chủ", icon: Home }],
  },
  {
    title: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Sản phẩm đầu tư",
    items: [
      { href: "/tei", label: "Chỉ báo TEI", icon: Activity, badge: "MỚI" },
      { href: "/terminal", label: "Tư vấn đầu tư", icon: MessageSquare },
      { href: "/dashboard/signal-map", label: "Tín Hiệu", icon: Zap },
      { href: "/khac/tin-tuc", label: "Tin Tức", icon: Newspaper, badge: "BETA", roles: ["ADMIN", "WRITER"] },
    ],
  },
  {
    title: "Dịch vụ",
    items: [
      { href: "/margin", label: "Ký quỹ · Mua nhanh", icon: Banknote, badge: "HOT" },
      { href: "/journal", label: "Nhật ký giao dịch", icon: BookOpen },
    ],
  },
  {
    title: "Khác",
    items: [
      { href: "https://t.me/+fryvX_B-6Y9kODg1", label: "Group Telegram", icon: Send, external: true },
      { href: "/backtest", label: "Backtest", icon: FlaskConical },
      { href: "/hdsd", label: "Hướng dẫn sử dụng", icon: BookOpen, badge: "UPDATING" },
    ],
  },
  {
    title: "Về chúng tôi",
    items: [{ href: "#", label: "Updating...", icon: Info }],
  },
  {
    title: "Quản lý",
    items: [{ href: "/admin", label: "Quản Lý Hệ Thống", icon: ShieldCheck }],
    adminOnly: true,
  },
];

/* ---------- Component ---------- */
export function Header() {
  const pathname = usePathname();
  const { dbUser, role, vipTier, isAuthenticated, isLoading, isAdmin } = useCurrentDbUser();
  const { data: session } = useSession();
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { collapsed, toggle: toggleCollapse } = useSidebarStore();

  useEffect(() => setMounted(true), []);
  useEffect(() => setMobileOpen(false), [pathname]);

  const isDark = theme === "dark";
  const showSkeleton = !mounted || isLoading;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  const userName = dbUser?.name || session?.user?.name || "User";
  const userImage = dbUser?.image || session?.user?.image || null;

  const lastLogin = new Date().toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  /* ---- Shared sidebar content ---- */
  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => {
    const w = collapsed && !isMobile;

    return (
      <div className="flex flex-col h-full">
        {/* Branding */}
        <div className={`shrink-0 px-4 pt-5 pb-3 ${w ? "px-2 pt-4" : ""}`}>
          <Link href="/" className={`flex items-center gap-2.5 ${w ? "justify-center" : ""}`}
            onClick={() => isMobile && setMobileOpen(false)}>
            <Image src="/logo.jpg" alt="ADN" width={w ? 32 : 36} height={w ? 32 : 36}
              className="rounded-xl ring-1 ring-white/10 shrink-0" />
            {!w && (
              <div>
                <p className="text-sm font-bold leading-tight">
                  <span className="text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]">ADN</span>
                  <span className={isDark ? " text-white/90" : " text-slate-800"}> AI System</span>
                </p>
                <p className={`text-[11px] tracking-wider uppercase ${isDark ? "text-white/25" : "text-slate-400"}`}>
                  AI-Powered Platform
                </p>
              </div>
            )}
          </Link>
        </div>

        {/* Welcome card */}
        {isAuthenticated && !w && (
          <div className={`mx-3 mb-3 px-3 py-3 rounded-xl ${
            isDark ? "bg-white/[0.04] border border-white/[0.06]" : "bg-black/[0.03] border border-slate-200/50"
          }`}>
            <div className="flex items-center gap-2.5">
              {userImage ? (
                <img src={userImage} alt="" className="w-8 h-8 rounded-full ring-1 ring-white/10 shrink-0" />
              ) : (
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  isDark ? "bg-emerald-500/15 text-emerald-400" : "bg-emerald-50 text-emerald-600"
                }`}>
                  {userName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className={`text-[11px] ${isDark ? "text-white/35" : "text-slate-400"}`}>Chào mừng trở lại,</p>
                <p className={`text-xs font-bold truncate ${isDark ? "text-white/90" : "text-slate-800"}`}>{userName}</p>
              </div>
            </div>
            {role === "VIP" && (
              <div className="mt-2">
                <span className={`inline-flex items-center gap-1 text-[11px] font-bold border px-2 py-0.5 rounded-lg ${
                  vipTier === "PREMIUM" ? "bg-amber-500/10 text-amber-400 border-amber-500/25" : "bg-purple-500/10 text-purple-400 border-purple-500/25"
                }`}><Crown className="w-2.5 h-2.5" />{vipTier === "PREMIUM" ? "PREMIUM" : "VIP"}</span>
              </div>
            )}
            <p className={`text-[11px] mt-2 ${isDark ? "text-white/20" : "text-slate-400"}`}>
              Last login: {lastLogin}
            </p>
          </div>
        )}

        {/* Nav sections */}
        <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-4 scrollbar-none">
          {menuSections.map((section) => {
            if (section.adminOnly && !isAdmin) return null;
            return (
              <div key={section.title || "home"}>
                {section.title && !w && (
                  <p className={`text-[11px] font-bold uppercase tracking-[0.15em] px-3 mb-1 ${
                    isDark ? "text-white/20" : "text-slate-400"
                  }`}>
                    {section.title}
                  </p>
                )}
                {w && section.title && (
                  <div className={`mx-auto w-5 h-px mb-2 rounded-full ${isDark ? "bg-white/10" : "bg-slate-200"}`} />
                )}
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    if (item.roles && !item.roles.includes(dbUser?.systemRole ?? "")) return null;
                    const Icon = item.icon;
                    const active = isActive(item.href);

                    const itemContent = (
                      <div
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[15px] font-medium transition-all duration-200 cursor-pointer ${
                          w ? "justify-center px-0 mx-1" : ""
                        } ${
                          active
                            ? isDark
                              ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_12px_-4px_rgba(16,185,129,0.3)]"
                              : "text-emerald-600 bg-emerald-50 border border-emerald-200"
                            : isDark
                            ? "text-white/50 hover:text-white hover:bg-white/[0.06] border border-transparent"
                            : "text-slate-500 hover:text-slate-800 hover:bg-black/[0.04] border border-transparent"
                        }`}
                        title={w ? item.label : undefined}
                      >
                        <Icon className="w-[18px] h-[18px] shrink-0" />
                        {!w && (
                          <>
                            <span className="flex-1 truncate">{item.label}</span>
                            {item.badge && (
                              <span className={`text-[12px] font-black px-1.5 py-0.5 rounded-md ${
                                item.badge === "HOT"
                                  ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                                  : item.badge === "UPDATING"
                                  ? "bg-amber-500/15 text-amber-400 border border-amber-500/25"
                                  : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              }`}>
                                {item.badge}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    );

                    if (item.external) {
                      return (
                        <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer">
                          {itemContent}
                        </a>
                      );
                    }

                    return (
                      <Link key={item.href} href={item.href} onClick={() => isMobile && setMobileOpen(false)}>
                        {itemContent}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Footer: theme + auth + collapse */}
        <div className={`shrink-0 border-t px-2 py-3 space-y-1 ${isDark ? "border-white/[0.06]" : "border-slate-200/60"}`}>
          <button onClick={toggleTheme}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[15px] font-medium transition-all ${
              isDark ? "text-amber-400/60 hover:text-amber-300 hover:bg-white/[0.06]" : "text-slate-500 hover:text-slate-700 hover:bg-black/[0.04]"
            } ${w ? "justify-center px-0 mx-1" : ""}`}
            title={isDark ? "Light Mode" : "Dark Mode"}>
            {isDark ? <Sun className="w-[18px] h-[18px] shrink-0" /> : <Moon className="w-[18px] h-[18px] shrink-0" />}
            {!w && <span>{isDark ? "Light Mode" : "Dark Mode"}</span>}
          </button>

          {showSkeleton ? (
            <div className={`h-10 rounded-xl animate-pulse ${isDark ? "bg-white/5" : "bg-slate-100"}`} />
          ) : isAuthenticated ? (
            <button onClick={() => { signOut({ callbackUrl: "/" }); if (isMobile) setMobileOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[15px] font-medium transition-all ${
                isDark ? "text-red-400/60 hover:text-red-400 hover:bg-red-500/10" : "text-red-500/60 hover:text-red-500 hover:bg-red-50"
              } ${w ? "justify-center px-0 mx-1" : ""}`}>
              <LogOut className="w-[18px] h-[18px] shrink-0" />
              {!w && <span>Đăng xuất</span>}
            </button>
          ) : (
            <Link href="/auth" onClick={() => isMobile && setMobileOpen(false)}>
              <div className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[15px] font-medium transition-all ${
                isDark ? "text-emerald-400 bg-emerald-500/10" : "text-emerald-600 bg-emerald-50"
              } ${w ? "justify-center px-0 mx-1" : ""}`}>
                <LogIn className="w-[18px] h-[18px] shrink-0" />
                {!w && <span>Đăng nhập</span>}
              </div>
            </Link>
          )}

          {!isMobile && (
            <button onClick={toggleCollapse}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[15px] transition-all ${
                isDark ? "text-white/25 hover:text-white/50 hover:bg-white/[0.04]" : "text-slate-400 hover:text-slate-600 hover:bg-black/[0.03]"
              } ${w ? "justify-center px-0 mx-1" : ""}`}>
              {collapsed ? <ChevronRight className="w-[18px] h-[18px]" /> : <ChevronLeft className="w-[18px] h-[18px]" />}
              {!w && <span className="text-xs">Thu gọn</span>}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-40 hidden lg:block transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${
          collapsed ? "w-[68px]" : "w-[260px]"
        } ${
          isDark
            ? "bg-[#050505]/95 backdrop-blur-3xl border-r border-white/[0.06]"
            : "bg-white/80 backdrop-blur-3xl border-r border-slate-200/60"
        }`}>
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <header className={`fixed top-0 left-0 right-0 z-50 h-14 lg:hidden transition-all duration-300 ${
        isDark
          ? "bg-[#050505]/92 backdrop-blur-3xl border-b border-white/[0.06]"
          : "bg-white/80 backdrop-blur-3xl border-b border-slate-200/60"
      }`}>
        <div className="flex items-center justify-between h-full px-3">
          <button onClick={() => setMobileOpen(!mobileOpen)}
            className={`p-2 rounded-xl transition-all ${
              isDark ? "text-white/60 hover:text-white hover:bg-white/[0.08]" : "text-slate-500 hover:text-slate-800 hover:bg-black/[0.04]"
            }`}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.jpg" alt="ADN" width={28} height={28} className="rounded-lg" />
            <span className="text-sm font-bold">
              <span className="text-emerald-400">ADN</span>
              <span className={isDark ? " text-white/90" : " text-slate-800"}> AI System</span>
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <button onClick={toggleTheme}
              className={`p-2 rounded-xl transition-all ${
                isDark ? "text-amber-400/70 hover:text-amber-300" : "text-slate-500 hover:text-slate-700"
              }`}>
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            {showSkeleton ? (
              <div className={`w-7 h-7 rounded-full animate-pulse ${isDark ? "bg-white/10" : "bg-slate-200"}`} />
            ) : isAuthenticated && userImage ? (
              <Link href="/profile">
                <img src={userImage} alt="" className="w-7 h-7 rounded-full ring-1 ring-white/15" />
              </Link>
            ) : isAuthenticated ? (
              <Link href="/profile">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold ${
                  isDark ? "bg-emerald-500/15 text-emerald-400" : "bg-emerald-50 text-emerald-600"
                }`}>{userName.charAt(0).toUpperCase()}</div>
              </Link>
            ) : (
              <Link href="/auth"
                className="text-emerald-400 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <LogIn className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Mobile overlay */}
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

      {/* Mobile sidebar drawer */}
      <aside className={`fixed top-0 left-0 bottom-0 z-50 lg:hidden w-[280px] transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      } ${
        isDark
          ? "bg-[#050505]/98 backdrop-blur-3xl border-r border-white/[0.08]"
          : "bg-white/95 backdrop-blur-3xl border-r border-slate-200/60"
      }`}>
        <SidebarContent isMobile />
      </aside>
    </>
  );
}

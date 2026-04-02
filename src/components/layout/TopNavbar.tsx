"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  BarChart2,
  MessageSquare,
  Zap,
  BookOpen,
  Home,
  FlaskConical,
  Users,
  LogIn,
  LogOut,
  Crown,
  UserCircle,
  Menu,
  X,
  Zap as ZapIcon,
} from "lucide-react";
import { useCurrentDbUser } from "@/hooks/useCurrentDbUser";
import { USAGE_LIMITS } from "@/lib/utils";

const navItems = [
  { href: "/",                    label: "Trang Chủ",          icon: Home,            badge: null },
  { href: "/dashboard",           label: "Dashboard",          icon: LayoutDashboard,  badge: null },
  { href: "/backtest",            label: "Backtest",           icon: FlaskConical,     badge: null },
  { href: "/rs-rating",           label: "RS Rating",          icon: BarChart2,        badge: null },
  { href: "/journal",             label: "Nhật Ký",            icon: BookOpen,         badge: null },
  { href: "/terminal",            label: "Chat AI",            icon: MessageSquare,    badge: "HOT" },
  { href: "/dashboard/signal-map",label: "Tín Hiệu",          icon: Zap,             badge: null },
  { href: "/admin",               label: "Quản Lý",           icon: Users,            badge: null },
];

export function TopNavbar() {
  const pathname = usePathname();
  const { dbUser, role, isAuthenticated, isAdmin, isLoading } = useCurrentDbUser();
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => setMobileOpen(false), [pathname]);

  const limit = USAGE_LIMITS[role] ?? 3;
  const usage = dbUser?.chatCount ?? 0;
  const usagePercent = limit === Infinity ? 0 : Math.min((usage / limit) * 100, 100);
  const showSkeleton = !mounted || isLoading;

  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-neutral-800/60 bg-neutral-950/95 backdrop-blur-md">
      <div className="flex items-center justify-between h-full px-4 max-w-[1600px] mx-auto">
        {/* ── Left: Logo ── */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <Image
            src="/logo.jpg"
            alt="ADN Capital"
            width={32}
            height={32}
            className="rounded-lg"
          />
          <span className="text-sm font-bold text-white hidden sm:inline">ADN Capital</span>
        </Link>

        {/* ── Center: Nav items (desktop) ── */}
        <nav className="hidden lg:flex items-center gap-0.5 mx-4">
          {navItems.filter((item) => item.href !== "/admin" || isAdmin).map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 whitespace-nowrap ${
                    active
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                      : "text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800/50"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${active ? "text-emerald-400" : ""}`} />
                  {item.label}
                  {item.badge && (
                    <span className="text-[8px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1 py-0 rounded">
                      {item.badge}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* ── Right: Usage + User ── */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Usage bar */}
          {!showSkeleton && isAuthenticated && limit !== Infinity && (
            <div className="hidden sm:flex items-center gap-2">
              <ZapIcon className="w-3 h-3 text-neutral-500" />
              <div className="w-16 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${usagePercent}%` }}
                  className={`h-full rounded-full ${usagePercent >= 80 ? "bg-red-500" : "bg-emerald-500"}`}
                />
              </div>
              <span className="text-[10px] text-neutral-500">{usage}/{limit}</span>
            </div>
          )}
          {!showSkeleton && isAuthenticated && limit === Infinity && (
            <div className="hidden sm:flex items-center gap-1 text-[10px] text-purple-400">
              <Crown className="w-3 h-3" />
              VIP
            </div>
          )}

          {/* Auth area */}
          {showSkeleton ? (
            <div className="w-7 h-7 rounded-full bg-neutral-800 animate-pulse" />
          ) : isAuthenticated ? (
            <div className="flex items-center gap-2">
              {role === "VIP" && (
                <span className="hidden sm:flex items-center gap-1 text-[9px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/25 px-1.5 py-0.5 rounded-md">
                  <Crown className="w-2.5 h-2.5" /> VIP
                </span>
              )}
              <span className="hidden md:inline text-xs text-neutral-300 font-medium max-w-[80px] truncate">
                {session?.user?.name?.split(" ").slice(-1)[0] ?? session?.user?.email?.split("@")[0]}
              </span>
              {session?.user?.image ? (
                <img src={session.user.image} alt="" className="w-7 h-7 rounded-full border border-neutral-700" />
              ) : (
                <UserCircle className="w-7 h-7 text-neutral-600" />
              )}
              <button onClick={() => signOut({ callbackUrl: "/" })} className="text-neutral-500 hover:text-red-400 transition-colors p-1" title="Đăng xuất">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <Link href="/auth">
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="flex items-center gap-1.5 text-xs text-emerald-400 border border-emerald-500/35 px-2.5 py-1 rounded-lg bg-emerald-500/8 hover:bg-emerald-500/15 transition-all font-medium">
                <LogIn className="w-3 h-3" />
                Đăng nhập
              </motion.button>
            </Link>
          )}

          {/* Mobile hamburger */}
          <button onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* ── Mobile dropdown menu ── */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 top-14 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
          <nav className="absolute top-14 left-0 right-0 bg-neutral-950 border-b border-neutral-800/60 z-50 lg:hidden p-3 space-y-0.5">
            {navItems.filter((item) => item.href !== "/admin" || isAdmin).map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link key={item.href} href={item.href}>
                  <div
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      active
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                        : "text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800/50"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? "text-emerald-400" : ""}`} />
                    {item.label}
                    {item.badge && (
                      <span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-md ml-auto">
                        {item.badge}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </nav>
        </>
      )}
    </header>
  );
}

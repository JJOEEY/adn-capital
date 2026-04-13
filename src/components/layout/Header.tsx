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
  Activity,
  MessageSquare,
  Banknote,
  BookOpen,
  FlaskConical,
  ShieldCheck,
  Send,
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
    title: "Overview",
    items: [
      { href: "/", label: "Trang Chủ", icon: Home },
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "Sản Phẩm Đầu Tư",
    items: [
      { href: "/tei", label: "Chỉ báo ART", icon: Activity, badge: "MỚI" },
      { href: "/terminal", label: "Tư vấn đầu tư", icon: MessageSquare },
      { href: "/dashboard/signal-map", label: "ADN AI Broker", icon: Zap },
      { href: "/khac/tin-tuc", label: "Tin Tức", icon: Newspaper, badge: "BETA", roles: ["ADMIN", "WRITER"] },
    ],
  },
  {
    title: "Dịch Vụ",
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
    title: "Về Chúng Tôi",
    items: [{ href: "#", label: "Updating...", icon: Home }],
  },
  {
    title: "Quản Lý",
    items: [{ href: "/admin", label: "Quản Lý Hệ Thống", icon: ShieldCheck }],
    adminOnly: true,
  },
];

/* ──────────────────────────────────────────────── Badge color helper ──── */
function badgeStyle(badge: string): React.CSSProperties {
  if (badge === "HOT")
    return { background: "rgba(192,57,43,0.12)", color: "#C0392B", border: "1px solid rgba(192,57,43,0.25)" };
  if (badge === "BETA" || badge === "UPDATING")
    return { background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" };
  // MỚI, default
  return { background: "var(--primary-light)", color: "var(--primary)", border: "1px solid var(--border)" };
}

/* ──────────────────────────────────────────────── SidebarContent ─────── */
function SidebarContent({ isMobile = false }: { isMobile?: boolean }) {
  const pathname = usePathname();
  const { dbUser, role, vipTier, isAuthenticated, isLoading, isAdmin } = useCurrentDbUser();
  const { data: session } = useSession();
  const { theme, toggleTheme } = useTheme();
  const { collapsed, toggle: toggleCollapse } = useSidebarStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = theme === "dark";
  const w = collapsed && !isMobile; // collapsed icon-only mode
  const showSkeleton = !mounted || isLoading;

  const userName = dbUser?.name || session?.user?.name || "User";
  const userImage = dbUser?.image || session?.user?.image || null;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="flex flex-col h-full">
      {/* ── Brand ── */}
      <div
        className={`shrink-0 flex items-center ${w ? "justify-center px-2 pt-5 pb-4" : "gap-2.5 px-4 pt-5 pb-4"}`}
      >
        <Link href="/" className={`flex items-center ${w ? "justify-center" : "gap-2.5"}`}
          onClick={() => isMobile && undefined}>
          <Image
            src="/logo.jpg"
            alt="ADN"
            width={w ? 32 : 32}
            height={w ? 32 : 32}
            className="rounded-xl shrink-0"
            style={{ border: "1px solid var(--border)" }}
          />
          {!w && (
            <div>
              <p className="text-[15px] font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
                ADN AI System
              </p>
              <p className="text-[11px] tracking-wider uppercase" style={{ color: "var(--text-muted)" }}>
                AI-Powered Platform
              </p>
            </div>
          )}
        </Link>
      </div>

      {/* ── User card (show only when expanded) ── */}
      {isAuthenticated && !w && (
        <div
          className="mx-2 mb-4 p-3 rounded-[10px]"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {userImage ? (
                <img
                  src={userImage}
                  alt=""
                  className="w-8 h-8 rounded-full shrink-0"
                  style={{ border: "1px solid var(--border)" }}
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: "var(--primary)", color: "var(--text-primary)" }}
                >
                  {userName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[13px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                  {userName}
                </p>
                <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  {role === "VIP" ? (vipTier === "PREMIUM" ? "Premium" : "VIP") : "Thành viên"}
                </p>
              </div>
            </div>
            {/* Theme toggle in user card */}
            <button
              onClick={toggleTheme}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0"
              style={{ color: "var(--text-secondary)" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
              }}
              title={isDark ? "Light Mode" : "Dark Mode"}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
          {role === "VIP" && (
            <div className="mt-2">
              <span
                className="inline-flex items-center gap-1 text-[11px] font-bold border px-2 py-0.5 rounded-lg"
                style={{
                  background: vipTier === "PREMIUM" ? "rgba(160,132,92,0.10)" : "var(--primary-light)",
                  color: vipTier === "PREMIUM" ? "#a0845c" : "var(--primary)",
                  borderColor: vipTier === "PREMIUM" ? "rgba(160,132,92,0.25)" : "var(--border)",
                }}
              >
                <Crown className="w-2.5 h-2.5" />
                {vipTier === "PREMIUM" ? "PREMIUM" : "VIP"}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Nav sections ── */}
      <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-4 scrollbar-none" style={{ padding: "0 8px" }}>
        {menuSections.map((section) => {
          if (section.adminOnly && !isAdmin) return null;
          return (
            <div key={section.title}>
              {section.title && !w && (
                <p
                  className="px-2 mb-1"
                  style={{
                    fontSize: "11px",
                    fontWeight: 500,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--text-muted)",
                    paddingTop: "8px",
                    paddingBottom: "4px",
                  }}
                >
                  {section.title}
                </p>
              )}
              {w && section.title && (
                <div className="mx-auto w-5 h-px mb-2 rounded-full" style={{ background: "var(--border)" }} />
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  if (item.roles && !item.roles.includes(dbUser?.systemRole ?? "")) return null;
                  const Icon = item.icon;
                  const active = isActive(item.href);

                  const itemContent = (
                    <div
                      className={`flex items-center gap-2.5 rounded-[9px] cursor-pointer transition-all duration-150 ${
                        w ? "justify-center p-2 mx-1" : "px-[10px] py-[9px]"
                      }`}
                      style={{
                        fontSize: "14px",
                        fontWeight: active ? 600 : 500,
                        color: active ? "var(--text-primary)" : "var(--text-secondary)",
                        background: active ? "rgba(23,54,39,0.50)" : "transparent",
                      }}
                      onMouseEnter={(e) => {
                        if (!active) {
                          (e.currentTarget as HTMLDivElement).style.background = "var(--bg-hover)";
                          (e.currentTarget as HTMLDivElement).style.color = "var(--text-primary)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!active) {
                          (e.currentTarget as HTMLDivElement).style.background = "transparent";
                          (e.currentTarget as HTMLDivElement).style.color = "var(--text-secondary)";
                        }
                      }}
                      title={w ? item.label : undefined}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {!w && (
                        <>
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.badge && (
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase"
                              style={badgeStyle(item.badge)}
                            >
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
                    <Link key={item.href} href={item.href}>
                      {itemContent}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* ── Bottom actions ── */}
      <div
        className="shrink-0 px-2 py-3 space-y-1"
        style={{
          borderTop: "1px solid var(--border)",
          marginTop: "auto",
        }}
      >
        {/* Theme toggle (icon-only mode) */}
        {w && (
          <button
            onClick={toggleTheme}
            className={`w-full flex items-center gap-2.5 py-2 rounded-xl transition-all ${w ? "justify-center" : "px-3"}`}
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
            }}
            title={isDark ? "Light Mode" : "Dark Mode"}
          >
            {isDark ? <Sun className="w-[18px] h-[18px] shrink-0" /> : <Moon className="w-[18px] h-[18px] shrink-0" />}
          </button>
        )}

        {/* Auth button */}
        {showSkeleton ? (
          <div className="h-10 rounded-xl animate-pulse" style={{ background: "var(--primary-light)" }} />
        ) : isAuthenticated ? (
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[14px] font-medium transition-all ${
              w ? "justify-center px-0 mx-1" : ""
            }`}
            style={{ color: "var(--danger)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(192,57,43,0.06)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
          >
            <LogOut className="w-[18px] h-[18px] shrink-0" />
            {!w && <span>Đăng xuất</span>}
          </button>
        ) : (
          <Link href="/auth">
            <div
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[14px] font-medium transition-all ${
                w ? "justify-center px-0 mx-1" : ""
              }`}
              style={{ background: "var(--primary-light)", color: "var(--primary)" }}
            >
              <LogIn className="w-[18px] h-[18px] shrink-0" />
              {!w && <span>Đăng nhập</span>}
            </div>
          </Link>
        )}

        {/* Collapse toggle (desktop only) */}
        {!isMobile && (
          <button
            onClick={toggleCollapse}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[14px] transition-all ${
              w ? "justify-center px-0 mx-1" : ""
            }`}
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
            }}
          >
            {collapsed ? (
              <ChevronRight className="w-[18px] h-[18px]" />
            ) : (
              <ChevronLeft className="w-[18px] h-[18px]" />
            )}
            {!w && <span className="text-xs">Thu gọn</span>}
          </button>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────── Header export ──────── */
export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { collapsed } = useSidebarStore();
  const isDark = theme === "dark";

  useEffect(() => setMobileOpen(false), [pathname]);

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-40 hidden lg:flex flex-col transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${
          collapsed ? "w-[68px]" : "w-[240px]"
        }`}
        style={{
          background: "var(--surface)",
          borderRight: "1px solid var(--border)",
        }}
      >
        <SidebarContent />
      </aside>

      {/* ── Mobile top bar ── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 h-14 lg:hidden"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between h-full px-3">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-xl transition-all"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.jpg" alt="ADN" width={28} height={28} className="rounded-lg" />
            <span className="text-[14px] font-bold" style={{ color: "var(--text-primary)" }}>
              ADN AI System
            </span>
          </Link>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl transition-all"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* ── Mobile overlay ── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 lg:hidden"
            style={{ background: "rgba(0,0,0,0.50)" }}
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Mobile sidebar drawer ── */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 lg:hidden w-[260px] transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          background: "var(--surface)",
          borderRight: "1px solid var(--border)",
        }}
      >
        <SidebarContent isMobile />
      </aside>
    </>
  );
}

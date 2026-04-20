"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
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
  ChevronDown,
  Banknote,
  Activity,
  Wallet,
} from "lucide-react";
import { useCurrentDbUser } from "@/hooks/useCurrentDbUser";
import { USAGE_LIMITS } from "@/lib/utils";

/* ── Nav items (không có dropdown) ─────────────────────── */
const navItems = [
  { href: "/",        label: "Trang Chủ", icon: Home,         badge: null },
  { href: "/dashboard",label: "Dashboard", icon: LayoutDashboard, badge: null },
  { href: "/backtest", label: "Backtest",  icon: FlaskConical, badge: null },
  { href: "/journal",  label: "Nhật Ký",  icon: BookOpen,     badge: null },
  { href: "/admin",    label: "Quản Lý",  icon: Users,        badge: null },
];

/* ── Dropdown: Sản Phẩm Dịch Vụ ─────────────────────────── */
const serviceItems: { href: string; label: string; icon: typeof BarChart2; badge: string | null; desc: string; adminOnly?: boolean }[] = [
  { href: "/terminal",             label: "Chat AI",       icon: MessageSquare, badge: "HOT", desc: "Trợ lý đầu tư AI" },
  { href: "/dashboard/signal-map", label: "ADN AI Broker", icon: Zap,         badge: null,    desc: "Trợ lý đồng hành khuyến nghị đầu tư" },
  { href: "/dashboard/dnse-trading", label: "DNSE Trading", icon: Wallet,     badge: "NEW",   desc: "Kết nối tài khoản và đặt lệnh chủ động" },
  { href: "/art",                  label: "ART",          icon: Activity,     badge: "MỚI",  desc: "Analytical Reversal Tracker" },
  { href: "/formula-test",         label: "Test Công Thức", icon: FlaskConical, badge: "MỚI",  desc: "Test 3 công thức chọn cổ phiếu", adminOnly: true },
  { href: "/margin",               label: "Ký Quỹ Margin", icon: Banknote,    badge: null,    desc: "Tư vấn ký quỹ margin" },
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

export function TopNavbar() {
  const pathname = usePathname();
  const { dbUser, role, vipTier, isAuthenticated, isAdmin, isLoading } = useCurrentDbUser();
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => setDropdownOpen(false), [pathname]);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const limit = USAGE_LIMITS[role] ?? 3;
  const usage = dbUser?.chatCount ?? 0;
  const usagePercent = limit === Infinity ? 0 : Math.min((usage / limit) * 100, 100);
  const showSkeleton = !mounted || isLoading;

  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(href + "/");

  const isServiceActive = serviceItems.some((s) => isActive(s.href));

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
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
          <span className="text-sm font-bold hidden sm:inline" style={{ color: "var(--text-primary)" }}>ADN Capital</span>
        </Link>

        {/* ── Center: Nav items (desktop) ── */}
        <nav className="hidden lg:flex items-center gap-0.5 mx-4">
          {navItems.filter((item) => item.href !== "/admin" || isAdmin).map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            // Chèn dropdown "Sản Phẩm Dịch Vụ" ngay sau Dashboard
            const insertDropdownAfter = item.href === "/dashboard";

            return (
              <>
                <Link key={item.href} href={item.href}>
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 whitespace-nowrap`}
                    style={{
                      color: active ? "var(--primary)" : "var(--text-muted)",
                      background: active ? "var(--primary-light)" : "transparent",
                      border: active ? "1px solid var(--border)" : "1px solid transparent",
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
                        (e.currentTarget as HTMLDivElement).style.color = "var(--text-muted)";
                      }
                    }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: active ? "var(--primary)" : "var(--text-muted)" }} />
                    {item.label}
                    {item.badge && (
                      <span className="text-[12px] font-bold px-1 py-0 rounded" style={getBadgeStyle(item.badge)}>
                        {item.badge}
                      </span>
                    )}
                  </div>
                </Link>

                {insertDropdownAfter && (
                  <div key="services-dropdown" ref={dropdownRef} className="relative">
                    <button
                      onClick={() => setDropdownOpen((v) => !v)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 whitespace-nowrap cursor-pointer`}
                      style={{
                        color: isServiceActive || dropdownOpen ? "var(--primary)" : "var(--text-muted)",
                        background: isServiceActive || dropdownOpen ? "var(--primary-light)" : "transparent",
                        border: isServiceActive || dropdownOpen ? "1px solid var(--border)" : "1px solid transparent",
                      }}
                      onMouseEnter={(e) => {
                        if (!isServiceActive && !dropdownOpen) {
                          (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
                          (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isServiceActive && !dropdownOpen) {
                          (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                          (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
                        }
                      }}
                    >
                      Sản Phẩm Dịch Vụ
                      <ChevronDown
                        className={`w-3 h-3 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}
                      />
                    </button>

                    <AnimatePresence>
                      {dropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -8, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -8, scale: 0.97 }}
                          transition={{ duration: 0.15 }}
                          className="absolute top-full left-0 mt-2 w-64 rounded-2xl shadow-2xl overflow-hidden z-50"
                          style={{
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            boxShadow: "0 8px 32px -8px rgba(0,0,0,0.20)",
                          }}
                        >
                          <div className="p-1.5 space-y-0.5">
                            {serviceItems.filter((s) => !s.adminOnly || isAdmin).map((svc) => {
                              const SvcIcon = svc.icon;
                              const svcActive = isActive(svc.href);
                              return (
                                <Link key={svc.href} href={svc.href}>
                                  <div
                                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group"
                                  style={{
                                    background: svcActive ? "var(--primary-light)" : "transparent",
                                    border: svcActive ? "1px solid var(--border)" : "1px solid transparent",
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!svcActive) (e.currentTarget as HTMLDivElement).style.background = "var(--bg-hover)";
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!svcActive) (e.currentTarget as HTMLDivElement).style.background = "transparent";
                                  }}
                                  >
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                      style={{
                                        background: svcActive ? "var(--primary-light)" : "var(--bg-hover)",
                                      }}>
                                      <SvcIcon className="w-4 h-4" style={{ color: svcActive ? "var(--primary)" : "var(--text-secondary)" }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold" style={{ color: svcActive ? "var(--primary)" : "var(--text-primary)" }}>
                                          {svc.label}
                                        </span>
                                        {svc.badge && (
                                          <span className="text-[12px] font-black px-1.5 py-0 rounded" style={getBadgeStyle(svc.badge)}>
                                            {svc.badge}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[12px] truncate" style={{ color: "var(--text-muted)" }}>{svc.desc}</p>
                                    </div>
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                          <div className="border-t px-3 py-2" style={{ borderColor: "var(--border)" }}>
                            <Link href="/san-pham">
                              <span className="text-[12px] transition-colors cursor-pointer" style={{ color: "var(--text-muted)" }}
                                onMouseEnter={(e) => { (e.target as HTMLSpanElement).style.color = "var(--primary)"; }}
                                onMouseLeave={(e) => { (e.target as HTMLSpanElement).style.color = "var(--text-muted)"; }}>
                                Xem tất cả sản phẩm →
                              </span>
                            </Link>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </>
            );
          })}
        </nav>

        {/* ── Right: Usage + User ── */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Usage bar */}
          {!showSkeleton && isAuthenticated && limit !== Infinity && (
            <div className="hidden sm:flex items-center gap-2">
              <ZapIcon className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
              <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${usagePercent}%` }}
                  className="h-full rounded-full"
                  style={{ background: usagePercent >= 80 ? "var(--danger)" : "#10b981" }}
                />
              </div>
              <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>{usage}/{limit}</span>
            </div>
          )}
          {!showSkeleton && isAuthenticated && limit === Infinity && (
            <div className="hidden sm:flex items-center gap-1 text-[12px]" style={{ color: vipTier === "PREMIUM" ? "#f59e0b" : "#a855f7" }}>
              <Crown className="w-3 h-3" />
              {vipTier === "PREMIUM" ? "PREMIUM" : "VIP"}
            </div>
          )}

          {/* Auth area */}
          {showSkeleton ? (
            <div className="w-7 h-7 rounded-full animate-pulse" style={{ background: "var(--surface-2)" }} />
          ) : isAuthenticated ? (
            <div className="flex items-center gap-2">
              {role === "VIP" && (
                <span
                  className="hidden sm:flex items-center gap-1 text-[11px] font-bold border px-1.5 py-0.5 rounded-md"
                  style={vipTier === "PREMIUM"
                    ? { background: "rgba(245,158,11,0.10)", color: "#f59e0b", borderColor: "rgba(245,158,11,0.25)" }
                    : { background: "rgba(168,85,247,0.10)", color: "#a855f7", borderColor: "rgba(168,85,247,0.25)" }
                  }>
                  <Crown className="w-2.5 h-2.5" /> {vipTier === "PREMIUM" ? "PREMIUM" : "VIP"}
                </span>
              )}
              <Link href="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <span className="hidden md:inline text-xs font-medium max-w-[80px] truncate" style={{ color: "var(--text-secondary)" }}>
                  {session?.user?.name?.split(" ").slice(-1)[0] ?? session?.user?.email?.split("@")[0]}
                </span>
                {session?.user?.image ? (
                  <img src={session.user.image} alt="" className="w-7 h-7 rounded-full border" style={{ borderColor: "var(--border)" }} />
                ) : (
                  <UserCircle className="w-7 h-7" style={{ color: "var(--text-muted)" }} />
                )}
              </Link>
              <button onClick={() => signOut({ callbackUrl: "/" })} className="transition-colors p-1" style={{ color: "var(--text-muted)" }} title="Đăng xuất">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <Link href="/auth">
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="flex items-center gap-1.5 text-xs border px-2.5 py-1 rounded-lg transition-all font-medium"
                style={{ color: "#16a34a", borderColor: "rgba(22,163,74,0.35)", background: "rgba(22,163,74,0.08)" }}>
                <LogIn className="w-3 h-3" />
                Đăng nhập
              </motion.button>
            </Link>
          )}

          {/* Mobile hamburger */}
          <button onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden p-1.5 rounded-lg transition-all" style={{ color: "var(--text-muted)" }}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* ── Mobile dropdown menu ── */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 top-14 z-40 lg:hidden" style={{ background: "rgba(0,0,0,0.50)" }} onClick={() => setMobileOpen(false)} />
          <nav className="absolute top-14 left-0 right-0 border-b z-50 lg:hidden p-3 space-y-0.5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            {navItems.filter((item) => item.href !== "/admin" || isAdmin).map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link key={item.href} href={item.href}>
                  <div
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                    style={{
                      color: active ? "var(--primary)" : "var(--text-secondary)",
                      background: active ? "var(--primary-light)" : "transparent",
                      border: active ? "1px solid var(--border)" : "1px solid transparent",
                    }}
                  >
                    <Icon className="w-4 h-4" style={{ color: active ? "var(--primary)" : "var(--text-secondary)" }} />
                    {item.label}
                    {item.badge && (
                      <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md ml-auto" style={getBadgeStyle(item.badge)}>
                        {item.badge}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
            {/* Sản Phẩm Dịch Vụ group trên mobile */}
            <div className="pt-1 mt-1 border-t" style={{ borderColor: "var(--border)" }}>
              <p className="px-3 text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>Sản Phẩm Dịch Vụ</p>
              {serviceItems.filter((s) => !s.adminOnly || isAdmin).map((svc) => {
                const SvcIcon = svc.icon;
                const active = isActive(svc.href);
                return (
                  <Link key={svc.href} href={svc.href}>
                    <div
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                      style={{
                        color: active ? "var(--primary)" : "var(--text-secondary)",
                        background: active ? "var(--primary-light)" : "transparent",
                        border: active ? "1px solid var(--border)" : "1px solid transparent",
                      }}
                    >
                      <SvcIcon className="w-4 h-4" style={{ color: active ? "var(--primary)" : "var(--text-secondary)" }} />
                      {svc.label}
                      {svc.badge && (
                        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md ml-auto" style={getBadgeStyle(svc.badge)}>
                          {svc.badge}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </nav>
        </>
      )}
    </header>
  );
}

"use client";

import type { ComponentType, CSSProperties, FormEvent } from "react";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Activity,
  Banknote,
  BarChart2,
  Bell,
  BookOpen,
  Bot,
  ChevronLeft,
  ChevronRight,
  Crown,
  FlaskConical,
  Home,
  LayoutDashboard,
  LogIn,
  LogOut,
  MessageSquare,
  Moon,
  Newspaper,
  Search,
  Send,
  ShieldCheck,
  Sun,
  Wallet,
  Zap,
} from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useCurrentDbUser } from "@/hooks/useCurrentDbUser";
import { BRAND, PRODUCT_NAMES } from "@/lib/brand/productNames";
import { useSidebarStore } from "@/store/sidebarStore";

interface MenuItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  external?: boolean;
  badge?: string;
  roles?: string[];
  requiresVip?: boolean;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
  adminOnly?: boolean;
}

const menuSections: MenuSection[] = [
  {
    title: "Tổng quan",
    items: [
      { href: "/", label: "Trang chủ", icon: Home },
      { href: "/dashboard", label: PRODUCT_NAMES.dashboard, icon: LayoutDashboard },
    ],
  },
  {
    title: "Sản phẩm đầu tư",
    items: [
      { href: "/dashboard/signal-map", label: PRODUCT_NAMES.brokerWorkflow, icon: Zap },
      { href: "/terminal", label: PRODUCT_NAMES.advisory, icon: MessageSquare },
      { href: "/art", label: PRODUCT_NAMES.art, icon: Activity, badge: "MỚI" },
      { href: "/rs-rating", label: PRODUCT_NAMES.rsRating, icon: BarChart2, badge: "VIP", requiresVip: true },
      {
        href: "/dashboard/dnse-trading",
        label: PRODUCT_NAMES.brokerConnect,
        icon: Wallet,
        badge: "PILOT",
        roles: ["ADMIN"],
      },
      { href: "/khac/tin-tuc", label: "Tin tức", icon: Newspaper, badge: "BETA", roles: ["ADMIN", "WRITER"] },
    ],
  },
  {
    title: "Dịch vụ",
    items: [
      { href: "/journal", label: "ADN Diary", icon: BookOpen },
    ],
  },
  {
    title: "Khác",
    items: [
      { href: "https://t.me/+fryvX_B-6Y9kODg1", label: "Group Telegram", icon: Send, external: true },
      { href: "/backtest", label: PRODUCT_NAMES.backtest, icon: FlaskConical },
      { href: "/hdsd", label: "Hướng dẫn sử dụng", icon: BookOpen },
      { href: "/margin", label: "Ký quỹ · Mua nhanh", icon: Banknote, badge: "HOT" },
    ],
  },
  {
    title: "Về chúng tôi",
    items: [
      { href: "/san-pham", label: `Bộ công cụ ${BRAND.name}`, icon: Home },
      { href: "/pricing", label: "Bảng giá dịch vụ", icon: Crown },
    ],
  },
  {
    title: "Quản lý",
    items: [{ href: "/admin", label: "Quản lý hệ thống", icon: ShieldCheck }],
    adminOnly: true,
  },
];

function badgeStyle(badge: string): CSSProperties {
  if (badge === "HOT") {
    return { background: "rgba(192,57,43,0.12)", color: "#C0392B", border: "1px solid rgba(192,57,43,0.25)" };
  }
  if (badge === "BETA" || badge === "PILOT") {
    return { background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" };
  }
  return { background: "var(--primary-light)", color: "var(--primary)", border: "1px solid var(--border)" };
}

function SidebarContent() {
  const pathname = usePathname();
  const { dbUser, role, vipTier, isAuthenticated, isLoading, isAdmin } = useCurrentDbUser();
  const { data: session } = useSession();
  const { theme, toggleTheme } = useTheme();
  const { collapsed, toggle: toggleCollapse } = useSidebarStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = theme === "dark";
  const compact = collapsed;
  const showSkeleton = !mounted || isLoading;

  const userName = dbUser?.name || session?.user?.name || "User";
  const userImage = dbUser?.image || session?.user?.image || null;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="flex h-full flex-col">
      <div className={`shrink-0 flex items-center ${compact ? "justify-center px-2 pt-5 pb-4" : "gap-2.5 px-4 pt-5 pb-4"}`}>
        <Link href="/" className={`flex items-center ${compact ? "justify-center" : "gap-2.5"}`}>
          <Image
            src="/brand/favicon.png"
            alt={BRAND.name}
            width={32}
            height={32}
            className="rounded-xl shrink-0"
            style={{ border: "1px solid var(--border)" }}
          />
          {!compact && (
            <div>
              <p className="text-[15px] font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
                {BRAND.name}
              </p>
              <p className="text-[11px] tracking-wider uppercase" style={{ color: "var(--text-muted)" }}>
                {BRAND.tagline}
              </p>
            </div>
          )}
        </Link>
      </div>

      {isAuthenticated && !compact && (
        <div className="mx-2 mb-4 rounded-[10px] p-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {userImage ? (
                <img src={userImage} alt="" className="w-8 h-8 rounded-full shrink-0" style={{ border: "1px solid var(--border)" }} />
              ) : (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: "var(--primary)", color: "#fff" }}
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
            <button
              onClick={toggleTheme}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0"
              style={{ color: "var(--text-secondary)" }}
              title={isDark ? "Giao diện sáng" : "Giao diện tối"}
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

      <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-4 scrollbar-none" style={{ padding: "0 8px" }}>
        {menuSections.map((section) => {
          if (section.adminOnly && !isAdmin) return null;
          return (
            <div key={section.title}>
              {section.title && !compact && (
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

              {compact && section.title && (
                <div className="mx-auto w-5 h-px mb-2 rounded-full" style={{ background: "var(--border)" }} />
              )}

              <div className="space-y-0.5">
                {section.items.map((item) => {
                  if (item.roles && !item.roles.includes(dbUser?.systemRole ?? "")) return null;
                  if (item.requiresVip && !isAdmin && role !== "VIP" && vipTier !== "PREMIUM") return null;
                  const Icon = item.icon;
                  const active = isActive(item.href);

                  const content = (
                    <div
                      className={`flex items-center gap-2.5 rounded-[9px] cursor-pointer transition-all duration-150 ${
                        compact ? "justify-center p-2 mx-1" : "px-[10px] py-[9px]"
                      }`}
                      style={{
                        fontSize: "14px",
                        fontWeight: active ? 600 : 500,
                        color: active ? "var(--text-primary)" : "var(--text-secondary)",
                        background: active ? "rgba(23,54,39,0.50)" : "transparent",
                      }}
                      title={compact ? item.label : undefined}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {!compact && (
                        <>
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.badge && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase" style={badgeStyle(item.badge)}>
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
                        {content}
                      </a>
                    );
                  }

                  return (
                    <Link key={item.href} href={item.href}>
                      {content}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 px-2 py-3 space-y-1" style={{ borderTop: "1px solid var(--border)", marginTop: "auto" }}>
        {compact && (
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-center gap-2.5 py-2 rounded-xl transition-all"
            style={{ color: "var(--text-secondary)" }}
            title={isDark ? "Giao diện sáng" : "Giao diện tối"}
          >
            {isDark ? <Sun className="w-[18px] h-[18px] shrink-0" /> : <Moon className="w-[18px] h-[18px] shrink-0" />}
          </button>
        )}

        {showSkeleton ? (
          <div className="h-10 rounded-xl animate-pulse" style={{ background: "var(--primary-light)" }} />
        ) : isAuthenticated ? (
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[14px] font-medium transition-all ${
              compact ? "justify-center px-0 mx-1" : ""
            }`}
            style={{ color: "var(--danger)" }}
          >
            <LogOut className="w-[18px] h-[18px] shrink-0" />
            {!compact && <span>Đăng xuất</span>}
          </button>
        ) : (
          <Link href="/auth">
            <div
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[14px] font-medium transition-all ${
                compact ? "justify-center px-0 mx-1" : ""
              }`}
              style={{ background: "var(--primary-light)", color: "var(--primary)" }}
            >
              <LogIn className="w-[18px] h-[18px] shrink-0" />
              {!compact && <span>Đăng nhập</span>}
            </div>
          </Link>
        )}

        <button
          onClick={toggleCollapse}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[14px] transition-all ${
            compact ? "justify-center px-0 mx-1" : ""
          }`}
          style={{ color: "var(--text-muted)" }}
        >
          {compact ? <ChevronRight className="w-[18px] h-[18px]" /> : <ChevronLeft className="w-[18px] h-[18px]" />}
          {!compact && <span className="text-xs">Thu gọn</span>}
        </button>
      </div>
    </div>
  );
}

export function Header() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { collapsed } = useSidebarStore();
  const [tickerQuery, setTickerQuery] = useState("");
  const isDark = theme === "dark";

  const handleTickerSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = tickerQuery.trim();
    const ticker = query.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const suffix = /^[A-Z0-9]{2,5}$/.test(ticker)
      ? `&ticker=${encodeURIComponent(ticker)}`
      : query
        ? `&q=${encodeURIComponent(query)}`
        : "";
    router.push(`/notifications?tab=chatbot${suffix}`);
  };

  return (
    <>
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

      <header
        className="fixed top-0 left-0 right-0 z-50 lg:hidden"
        style={{
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          paddingTop: "env(safe-area-inset-top, 0px)",
        }}
      >
        <div className="flex h-16 items-center gap-2 px-3">
          <form
            onSubmit={handleTickerSearch}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-full border px-3"
            style={{
              height: 40,
              background: "var(--surface-2)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
          >
            <input
              value={tickerQuery}
              onChange={(event) => setTickerQuery(event.target.value)}
              aria-label="Tìm mã cổ phiếu để tư vấn"
              placeholder="Tìm mã để tư vấn"
              autoCapitalize="characters"
              autoCorrect="off"
              className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold uppercase outline-none placeholder:normal-case"
              style={{ color: "var(--text-primary)" }}
            />
            <button
              type="submit"
              aria-label="Mở tư vấn đầu tư"
              className="shrink-0 rounded-full p-1"
              style={{ color: "var(--text-secondary)" }}
            >
              <Search className="h-4 w-4" />
            </button>
          </form>

          <Link
            href="/notifications?tab=updates"
            aria-label="Thông báo"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all"
            style={{
              background: "var(--surface-2)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
          >
            <Bell className="h-4 w-4" />
          </Link>

          <Link
            href="/notifications?tab=chatbot"
            aria-label="Tư vấn đầu tư"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all"
            style={{
              background: "var(--primary-light)",
              borderColor: "var(--border)",
              color: "var(--primary)",
            }}
          >
            <Bot className="h-4 w-4" />
          </Link>

          <button
            onClick={toggleTheme}
            aria-label={isDark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all"
            style={{
              background: "var(--surface-2)",
              borderColor: "var(--border)",
              color: "var(--text-secondary)",
            }}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  Banknote,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Moon,
  Sun,
  TrendingUp,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useCurrentDbUser } from "@/hooks/useCurrentDbUser";
import { BRAND, PRODUCT_NAMES } from "@/lib/brand/productNames";

type NavIcon = typeof LayoutDashboard;

interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  badge?: string | null;
  adminOnly?: boolean;
  children?: Array<{ href: string; label: string; icon: NavIcon; badge?: string | null; adminOnly?: boolean }>;
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: PRODUCT_NAMES.dashboard, icon: LayoutDashboard },
  { href: "/", label: "Thị trường", icon: TrendingUp },
  {
    href: "#",
    label: "Bộ công cụ đầu tư",
    icon: Zap,
    children: [
      { href: "/terminal", label: PRODUCT_NAMES.advisory, icon: MessageSquare, badge: "HOT" },
      { href: "/dashboard/signal-map", label: PRODUCT_NAMES.brokerWorkflow, icon: Zap },
      { href: "/art", label: PRODUCT_NAMES.art, icon: Activity, badge: "MỚI" },
      { href: "/margin", label: "Ký quỹ - Mua nhanh", icon: Banknote },
    ],
  },
  { href: "/journal", label: "Nhật ký", icon: BookOpen },
  { href: "/backtest", label: PRODUCT_NAMES.backtest, icon: FlaskConical },
  { href: "/admin", label: "Quản lý", icon: Users, adminOnly: true },
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
  return {
    background: "var(--primary-light)",
    color: "var(--primary)",
    border: "1px solid var(--border)",
  };
}

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { isAdmin } = useCurrentDbUser();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);

  const isDark = theme === "dark";

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    for (const item of navItems) {
      if (!item.children) continue;
      const hasActive = item.children.some((child) => pathname === child.href || pathname.startsWith(`${child.href}/`));
      if (hasActive) {
        setExpandedMenu(item.label);
        break;
      }
    }
  }, [pathname]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  const renderSidebarContent = (collapsed: boolean) => (
    <div className="flex flex-col h-full">
      <div className="flex items-center h-20 px-5 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
        <div className={`flex items-center gap-3 ${collapsed ? "justify-center w-full" : ""}`}>
          <Image
            src="/brand/favicon.png"
            alt={BRAND.name}
            width={36}
            height={36}
            className="rounded-xl ring-1 ring-white/10 shrink-0"
          />
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-sm font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
                {BRAND.name}
              </p>
              <p className="text-[12px] leading-tight" style={{ color: "var(--text-muted)" }}>
                {BRAND.tagline}
              </p>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 scrollbar-none">
        {navItems
          .filter((item) => !item.adminOnly || isAdmin)
          .map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            const children = item.children?.filter((child) => !child.adminOnly || isAdmin) ?? [];
            const hasChildren = children.length > 0;
            const isExpanded = expandedMenu === item.label;
            const hasActiveChild = hasChildren && children.some((child) => isActive(child.href));

            return (
              <div key={item.label}>
                {hasChildren ? (
                  <button
                    onClick={() => {
                      if (collapsed) {
                        setSidebarOpen(true);
                        setTimeout(() => setExpandedMenu(item.label), 300);
                      } else {
                        setExpandedMenu((prev) => (prev === item.label ? null : item.label));
                      }
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 relative group ${
                      collapsed ? "justify-center" : ""
                    }`}
                    style={{
                      color: hasActiveChild ? "var(--primary)" : "var(--text-secondary)",
                      background: hasActiveChild ? "var(--primary-light)" : "transparent",
                    }}
                  >
                    {hasActiveChild && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full"
                        style={{ background: "var(--primary)" }}
                      />
                    )}
                    <Icon className="w-5 h-5 shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left">{item.label}</span>
                        <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} />
                      </>
                    )}
                  </button>
                ) : (
                  <Link href={item.href}>
                    <div
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 relative group ${
                        collapsed ? "justify-center" : ""
                      }`}
                      style={{
                        color: active ? "var(--primary)" : "var(--text-secondary)",
                        background: active ? "var(--primary-light)" : "transparent",
                      }}
                    >
                      {active && (
                        <span
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full"
                          style={{ background: "var(--primary)" }}
                        />
                      )}
                      <Icon className="w-5 h-5 shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                      {!collapsed && item.badge && (
                        <span className="text-[12px] font-bold px-1.5 py-0 rounded ml-auto" style={getBadgeStyle(item.badge)}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </Link>
                )}

                {hasChildren && !collapsed && (
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="ml-5 mt-1 space-y-0.5 pl-3 border-l" style={{ borderColor: "var(--border)" }}>
                          {children.map((child) => {
                            const ChildIcon = child.icon;
                            const childActive = isActive(child.href);
                            return (
                              <Link key={child.href} href={child.href}>
                                <div
                                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-300"
                                  style={{
                                    color: childActive ? "var(--primary)" : "var(--text-secondary)",
                                    background: childActive ? "var(--primary-light)" : "transparent",
                                  }}
                                >
                                  <ChildIcon className="w-3.5 h-3.5" />
                                  <span>{child.label}</span>
                                  {child.badge && (
                                    <span
                                      className="text-[12px] font-black px-1.5 py-0 rounded ml-auto"
                                      style={getBadgeStyle(child.badge)}
                                    >
                                      {child.badge}
                                    </span>
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

      <div className="shrink-0 border-t px-3 py-3 space-y-2" style={{ borderColor: "var(--border)" }}>
        <button
          onClick={toggleTheme}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
            collapsed ? "justify-center" : ""
          }`}
          style={{ color: "var(--text-secondary)" }}
        >
          {isDark ? <Sun className="w-5 h-5 shrink-0" /> : <Moon className="w-5 h-5 shrink-0" />}
          {!collapsed && <span>{isDark ? "Giao diện sáng" : "Giao diện tối"}</span>}
        </button>

        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className={`hidden md:flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
            collapsed ? "justify-center" : ""
          }`}
          style={{ color: "var(--text-muted)" }}
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5 shrink-0" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5 shrink-0" />
              <span>Thu gọn</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div
      className="min-h-screen transition-colors duration-300"
      style={{
        background: "var(--bg-page)",
        color: "var(--text-primary)",
      }}
    >
      {isDark && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <div
            className="absolute top-[-200px] left-[-100px] w-[500px] h-[500px] rounded-full blur-[120px]"
            style={{ background: "rgba(23,54,39,0.05)" }}
          />
          <div
            className="absolute bottom-[-200px] right-[-100px] w-[400px] h-[400px] rounded-full blur-[120px]"
            style={{ background: "rgba(73,38,40,0.05)" }}
          />
        </div>
      )}

      <aside
        className={`hidden md:flex flex-col fixed left-0 top-0 h-screen z-40 transition-all duration-300 ease-in-out ${
          sidebarOpen ? "w-[240px]" : "w-[68px]"
        }`}
        style={{
          background: "var(--surface)",
          borderRight: "1px solid var(--border)",
        }}
      >
        {renderSidebarContent(!sidebarOpen)}
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 md:hidden"
            style={{ background: "rgba(0,0,0,0.50)" }}
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 md:hidden transition-transform duration-300 ease-in-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          background: "var(--surface)",
          borderRight: "1px solid var(--border)",
        }}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-6 right-4 p-1.5 rounded-lg transition-all"
          style={{ color: "var(--text-muted)" }}
          aria-label="Đóng menu"
        >
          <X className="w-5 h-5" />
        </button>
        {renderSidebarContent(false)}
      </aside>

      <div
        className="md:hidden fixed top-0 left-0 right-0 z-30 h-16 flex items-center px-4 gap-3 border-b"
        style={{
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-xl transition-all"
          style={{ color: "var(--text-secondary)" }}
          aria-label="Mở menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Image src="/brand/favicon.png" alt={BRAND.name} width={28} height={28} className="rounded-lg" />
          <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            {BRAND.name}
          </span>
        </div>
      </div>

      <main
        className={`relative z-10 flex-1 min-w-0 transition-all duration-300 ease-in-out pt-16 md:pt-0 ${
          sidebarOpen ? "md:ml-[240px]" : "md:ml-[68px]"
        }`}
      >
        <div className="p-4 md:p-6 lg:p-8 min-w-0 overflow-x-hidden">{children}</div>
      </main>
    </div>
  );
}

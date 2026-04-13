"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
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
  Menu,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Banknote,
  Activity,
  TrendingUp,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";

/* ── Nav items with optional sub-menu ── */
interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: string | null;
  children?: { href: string; label: string; icon: typeof BarChart2; badge?: string | null }[];
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/", label: "Thị trường", icon: TrendingUp },
  {
    href: "#",
    label: "Giải pháp đầu tư",
    icon: Zap,
    children: [
      { href: "/terminal", label: "Chat AI", icon: MessageSquare, badge: "HOT" },
      { href: "/dashboard/signal-map", label: "ADN AI Broker", icon: Zap },
      { href: "/tei", label: "ART", icon: Activity, badge: "MỚI" },
      { href: "/margin", label: "Ký Quỹ Margin", icon: Banknote },
    ],
  },
  { href: "/journal", label: "Góc nhìn đầu tư", icon: BookOpen },
  { href: "/backtest", label: "Backtest", icon: FlaskConical },
  { href: "/admin", label: "Quản Lý", icon: Users },
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

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);

  const isDark = theme === "dark";

  // Close mobile sidebar on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Auto-expand menu if child is active
  useEffect(() => {
    for (const item of navItems) {
      if (item.children) {
        const hasActive = item.children.some(
          (child) =>
            pathname === child.href || pathname.startsWith(child.href + "/")
        );
        if (hasActive) {
          setExpandedMenu(item.label);
          break;
        }
      }
    }
  }, [pathname]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  const toggleExpanded = (label: string) => {
    setExpandedMenu((prev) => (prev === label ? null : label));
  };

  /* ── Sidebar content (shared desktop & mobile) ── */
  const renderSidebarContent = (collapsed: boolean) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div
        className="flex items-center h-20 px-5 border-b shrink-0"
        style={{ borderColor: "var(--border)" }}
      >
        <div className={`flex items-center gap-3 ${collapsed ? "justify-center w-full" : ""}`}>
          <Image
            src="/logo.jpg"
            alt="ADN Capital"
            width={36}
            height={36}
            className="rounded-xl ring-1 ring-white/10 shrink-0"
          />
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-sm font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
                <span style={{ color: "var(--primary)" }}>ADN</span>{" "}
                Capital
              </p>
              <p className="text-[12px] leading-tight" style={{ color: "var(--text-muted)" }}>
                Investment System
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 scrollbar-none">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          const hasChildren = item.children && item.children.length > 0;
          const isExpanded = expandedMenu === item.label;
          const hasActiveChild = hasChildren && item.children!.some((c) => isActive(c.href));

          return (
            <div key={item.label}>
              {hasChildren ? (
                <button
                  onClick={() => {
                    if (collapsed) {
                      setSidebarOpen(true);
                      setTimeout(() => setExpandedMenu(item.label), 300);
                    } else {
                      toggleExpanded(item.label);
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 relative group ${
                    collapsed ? "justify-center" : ""
                  }`}
                  style={{
                    color: hasActiveChild ? "var(--primary)" : "var(--text-secondary)",
                    background: hasActiveChild ? "var(--primary-light)" : "transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!hasActiveChild) {
                      (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
                      (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!hasActiveChild) {
                      (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                      (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
                    }
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
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-300 ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
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

              {/* Children accordion */}
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
                        {item.children!.map((child) => {
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
                                onMouseEnter={(e) => {
                                  if (!childActive) {
                                    (e.currentTarget as HTMLDivElement).style.background = "var(--bg-hover)";
                                    (e.currentTarget as HTMLDivElement).style.color = "var(--text-primary)";
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!childActive) {
                                    (e.currentTarget as HTMLDivElement).style.background = "transparent";
                                    (e.currentTarget as HTMLDivElement).style.color = "var(--text-secondary)";
                                  }
                                }}
                              >
                                <ChildIcon className={`w-3.5 h-3.5 ${childActive ? "text-emerald-400" : ""}`} />
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

      {/* Bottom: Theme toggle + Collapse toggle */}
      <div
        className="shrink-0 border-t px-3 py-3 space-y-2"
        style={{ borderColor: "var(--border)" }}
      >
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${collapsed ? "justify-center" : ""}`}
          style={{ color: "var(--text-secondary)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
          }}
        >
          {isDark ? <Sun className="w-5 h-5 shrink-0" /> : <Moon className="w-5 h-5 shrink-0" />}
          {!collapsed && <span>{isDark ? "Light Mode" : "Dark Mode"}</span>}
        </button>

        {/* Collapse toggle (desktop only) */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className={`hidden md:flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${collapsed ? "justify-center" : ""}`}
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
      {/* ── Background glow blobs ── */}
      {isDark && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute top-[-200px] left-[-100px] w-[500px] h-[500px] rounded-full blur-[120px]" style={{ background: "rgba(23,54,39,0.05)" }} />
          <div className="absolute bottom-[-200px] right-[-100px] w-[400px] h-[400px] rounded-full blur-[120px]" style={{ background: "rgba(73,38,40,0.05)" }} />
        </div>
      )}

      {/* ── Desktop Sidebar ── */}
      <aside
        className={`hidden md:flex flex-col fixed left-0 top-0 h-screen z-40 transition-all duration-300 ease-in-out ${
          sidebarOpen ? "w-64" : "w-20"
        }`}
        style={{
          background: "var(--surface)",
          borderRight: "1px solid var(--border)",
        }}
      >
        {renderSidebarContent(!sidebarOpen)}
      </aside>

      {/* ── Mobile Overlay ── */}
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

      {/* ── Mobile Sidebar Drawer ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 md:hidden transition-transform duration-300 ease-in-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          background: "var(--surface)",
          borderRight: "1px solid var(--border)",
        }}
      >
        {/* Close button */}
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-6 right-4 p-1.5 rounded-lg transition-all"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
          }}
        >
          <X className="w-5 h-5" />
        </button>
        {renderSidebarContent(false)}
      </aside>

      {/* ── Mobile Topbar ── */}
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
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-hover)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
          }}
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Image src="/logo.jpg" alt="ADN Capital" width={28} height={28} className="rounded-lg" />
          <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            <span style={{ color: "var(--primary)" }}>ADN</span>{" "}
            Capital
          </span>
        </div>
      </div>

      {/* ── Main Content ── */}
      <main
        className={`relative z-10 transition-all duration-300 ease-in-out pt-16 md:pt-0 ${
          sidebarOpen ? "md:ml-64" : "md:ml-20"
        }`}
      >
        <div className="p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

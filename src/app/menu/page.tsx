"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useCurrentDbUser } from "@/hooks/useCurrentDbUser";
import { MainLayout } from "@/components/layout/MainLayout";
import { useTheme } from "@/components/providers/ThemeProvider";
import {
  FlaskConical,
  Activity,
  Send,
  BookOpen,
  Banknote,
  Info,
  LogOut,
  LogIn,
  Crown,
  ChevronRight,
  User,
  Settings,
  Shield,
  Users,
  Newspaper,
  Bell,
  Sun,
  Moon,
} from "lucide-react";

interface MenuGroup {
  title: string;
  items: {
    href: string;
    label: string;
    icon: typeof FlaskConical;
    badge?: string;
    external?: boolean;
    action?: () => void;
    color?: string;
  }[];
}

export default function MenuPage() {
  const { data: session } = useSession();
  const { theme, toggleTheme } = useTheme();
  const { dbUser, role, vipTier, isAuthenticated, isLoading, isAdmin, isWriter } = useCurrentDbUser();
  const [avatarError, setAvatarError] = useState(false);

  const userName = dbUser?.name || session?.user?.name || "User";
  const userImage = dbUser?.image || session?.user?.image || null;
  const userEmail = dbUser?.email || session?.user?.email || "";
  const isDark = theme === "dark";
  const sessionUser = session?.user as { role?: string; systemRole?: string } | undefined;
  const isAdminBySession =
    sessionUser?.role === "ADMIN" || sessionUser?.systemRole === "ADMIN";
  const canManageSystem = isAdmin || isAdminBySession;
  const canManageContent = canManageSystem || isWriter;
  const userInitial = useMemo(
    () => (userName || userEmail || "User").trim().charAt(0).toUpperCase(),
    [userEmail, userName]
  );

  const menuGroups: MenuGroup[] = [
    {
      title: "Công cụ",
      items: [
        { href: "/backtest", label: "Backtest", icon: FlaskConical },
        { href: "/art", label: "ART - Analytical Reversal Tracker", icon: Activity, badge: "MỚI" },
        { href: "https://t.me/+fryvX_B-6Y9kODg1", label: "Group Telegram", icon: Send, external: true },
        { href: "/hdsd", label: "Hướng dẫn sử dụng", icon: BookOpen },
      ],
    },
    {
      title: "Dịch vụ",
      items: [
        { href: "/margin", label: "Ký quỹ · Mua nhanh", icon: Banknote, badge: "HOT" },
      ],
    },
    {
      title: "Khác",
      items: [
        { href: "/notifications", label: "Thông báo", icon: Bell },
        { href: "#", label: "About Us (cập nhật sau)", icon: Info },
      ],
    },
    ...(canManageSystem
      ? [
          {
            title: "Quản lý hệ thống",
            items: [{ href: "/admin", label: "Quản Lý Hệ Thống", icon: Shield, badge: "ADMIN" as const }],
          },
        ]
      : []),
    ...(canManageContent
      ? [
          {
            title: "Quản trị nội dung",
            items: [
              { href: "/khac/tin-tuc/admin", label: "Quản lý bài viết", icon: Newspaper },
              { href: "/admin?tab=journals", label: "Nhật ký khách hàng", icon: Users },
            ],
          },
        ]
      : []),
  ];

  return (
    <MainLayout>
      <div className="p-4 pb-24 space-y-4 max-w-lg mx-auto">
        {/* Profile card */}
        {isLoading ? (
          <div className="rounded-2xl border border-white/[0.06] bg-[var(--surface)] p-5">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-neutral-800 animate-pulse" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-24 bg-neutral-800 rounded animate-pulse" />
                <div className="h-3 w-40 bg-neutral-800 rounded animate-pulse" />
              </div>
            </div>
          </div>
        ) : isAuthenticated ? (
          <Link href="/profile">
            <div className="rounded-2xl border border-white/[0.06] bg-[var(--surface)] p-5 hover:bg-[var(--surface)] transition-all">
              <div className="flex items-center gap-3">
                {userImage && !avatarError ? (
                  <img
                    src={userImage}
                    alt=""
                    className="w-14 h-14 rounded-full ring-2 ring-emerald-500/20"
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
                    <span className="text-xl font-bold text-emerald-400">{userInitial}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-white truncate">{userName}</p>
                  <p className="text-xs text-neutral-500 truncate">{userEmail}</p>
                  {role === "VIP" && (
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-bold border px-2 py-0.5 rounded-lg mt-1.5 ${
                        vipTier === "PREMIUM"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/25"
                          : "bg-purple-500/10 text-purple-400 border-purple-500/25"
                      }`}
                    >
                      <Crown className="w-2.5 h-2.5" />
                      {vipTier === "PREMIUM" ? "PREMIUM" : "VIP"}
                    </span>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleTheme();
                  }}
                  className="w-9 h-9 rounded-full flex items-center justify-center border transition-all cursor-pointer"
                  style={{
                    borderColor: "var(--border)",
                    color: "var(--text-secondary)",
                    background: "var(--surface-2)",
                  }}
                  title={isDark ? "Light mode" : "Dark mode"}
                >
                  {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
                <ChevronRight className="w-4 h-4 text-neutral-600" />
              </div>
            </div>
          </Link>
        ) : (
          <Link href="/auth">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <LogIn className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-400">Đăng nhập</p>
                <p className="text-xs text-neutral-500">Đăng nhập để trải nghiệm đầy đủ</p>
              </div>
            </div>
          </Link>
        )}

        {/* Menu groups */}
        {menuGroups.map((group) => (
          <div key={group.title} className="rounded-2xl border border-white/[0.06] bg-[var(--surface)] overflow-hidden">
            <p className="px-4 pt-3 pb-1 text-[11px] font-bold text-neutral-500 uppercase tracking-[0.15em]">
              {group.title}
            </p>
            {group.items.map((item, idx) => {
              const Icon = item.icon;
              const content = (
                <div className={`flex items-center gap-3 px-4 py-3 transition-all hover:bg-white/[0.03] ${
                  idx < group.items.length - 1 ? "border-b border-white/[0.04]" : ""
                }`}>
                  <Icon className="w-5 h-5 text-neutral-400 shrink-0" />
                  <span className="flex-1 text-sm text-white/80 font-medium">{item.label}</span>
                  {item.badge && (
                    <span
                      className={`text-[12px] font-black px-1.5 py-0.5 rounded ${
                        item.badge === "HOT"
                          ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                          : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-neutral-700" />
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
        ))}

        {/* Logout */}
        {isAuthenticated && (
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-full rounded-2xl border border-red-500/15 bg-red-500/5 p-4 flex items-center gap-3 hover:bg-red-500/10 transition-all cursor-pointer"
          >
            <LogOut className="w-5 h-5 text-red-400" />
            <span className="text-sm font-bold text-red-400">Đăng xuất</span>
          </button>
        )}

        {/* Footer */}
        <p className="text-center text-[12px] text-neutral-700 pt-2">
          Powered by <span className="text-emerald-500/50 font-bold">ADN CAPITAL</span> · v2.0
        </p>
      </div>
    </MainLayout>
  );
}

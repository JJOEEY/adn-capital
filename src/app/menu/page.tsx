"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import {
  Banknote,
  Bell,
  BookOpen,
  ChevronRight,
  Crown,
  FlaskConical,
  LogIn,
  LogOut,
  Moon,
  Settings,
  Shield,
  Sun,
  User,
  type LucideIcon,
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useCurrentDbUser } from "@/hooks/useCurrentDbUser";

type PreferenceKey = "stock_watchlist" | "signal_scan" | "ai_weekly_review";

interface MenuItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

const DEFAULT_PREFERENCES: Record<PreferenceKey, boolean> = {
  stock_watchlist: true,
  signal_scan: true,
  ai_weekly_review: true,
};

const ui = {
  login: "\u0110\u0103ng nh\u1eadp",
  loginHint: "\u0110\u0103ng nh\u1eadp \u0111\u1ec3 tr\u1ea3i nghi\u1ec7m \u0111\u1ea7y \u0111\u1ee7",
  logout: "\u0110\u0103ng xu\u1ea5t",
  notificationTitle: "C\u00e0i \u0111\u1eb7t th\u00f4ng b\u00e1o",
  lightMode: "Ch\u1ebf \u0111\u1ed9 s\u00e1ng",
  darkMode: "Ch\u1ebf \u0111\u1ed9 t\u1ed1i",
  updateError: "Kh\u00f4ng th\u1ec3 c\u1eadp nh\u1eadt t\u00f9y ch\u1ecdn th\u00f4ng b\u00e1o",
};

const preferenceLabels: Array<{ key: PreferenceKey; label: string; description: string }> = [
  {
    key: "stock_watchlist",
    label: "M\u00e3 c\u1ed5 phi\u1ebfu",
    description: "Th\u00f4ng b\u00e1o c\u00e1c m\u00e3 trong danh s\u00e1ch theo d\u00f5i.",
  },
  {
    key: "signal_scan",
    label: "Scan t\u00edn hi\u1ec7u c\u1ed5 phi\u1ebfu",
    description: "Nh\u1eadn th\u00f4ng b\u00e1o khi h\u1ec7 th\u1ed1ng ph\u00e1t hi\u1ec7n t\u00edn hi\u1ec7u m\u1edbi.",
  },
  {
    key: "ai_weekly_review",
    label: "Nh\u1eadn \u0111\u00e1nh gi\u00e1 t\u00e2m l\u00fd h\u00e0ng tu\u1ea7n t\u1eeb ADN AI",
    description:
      "ADN AI g\u1eedi \u0111\u00e1nh gi\u00e1 h\u00e0nh vi v\u00e0 k\u1ef7 lu\u1eadt giao d\u1ecbch \u0111\u1ecbnh k\u1ef3.",
  },
];

export default function MenuPage() {
  const { data: session } = useSession();
  const { theme, toggleTheme } = useTheme();
  const { dbUser, role, vipTier, isAuthenticated, isLoading, isAdmin } = useCurrentDbUser();
  const [avatarError, setAvatarError] = useState(false);
  const [preferences, setPreferences] = useState<Record<PreferenceKey, boolean>>(DEFAULT_PREFERENCES);
  const [savingKey, setSavingKey] = useState<PreferenceKey | null>(null);

  const userName = dbUser?.name || session?.user?.name || "User";
  const userImage = dbUser?.image || session?.user?.image || null;
  const userEmail = dbUser?.email || session?.user?.email || "";
  const isDark = theme === "dark";
  const sessionUser = session?.user as { role?: string; systemRole?: string } | undefined;
  const canManageSystem = isAdmin || sessionUser?.role === "ADMIN" || sessionUser?.systemRole === "ADMIN";
  const userInitial = useMemo(
    () => (userName || userEmail || "User").trim().charAt(0).toUpperCase(),
    [userEmail, userName],
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setPreferences(DEFAULT_PREFERENCES);
      return;
    }

    let cancelled = false;
    fetch("/api/user/notification-preferences", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.preferences) {
          setPreferences({ ...DEFAULT_PREFERENCES, ...data.preferences });
        }
      })
      .catch(() => {
        if (!cancelled) setPreferences(DEFAULT_PREFERENCES);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const togglePreference = async (key: PreferenceKey) => {
    if (!isAuthenticated || savingKey) return;

    const nextValue = !preferences[key];
    setSavingKey(key);
    setPreferences((current) => ({ ...current, [key]: nextValue }));

    try {
      const res = await fetch("/api/user/notification-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, enabled: nextValue }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.preferences) {
        throw new Error(data?.error || ui.updateError);
      }
      setPreferences({ ...DEFAULT_PREFERENCES, ...data.preferences });
    } catch {
      setPreferences((current) => ({ ...current, [key]: !nextValue }));
    } finally {
      setSavingKey(null);
    }
  };

  const menuGroups: MenuGroup[] = [
    {
      title: "C\u00e0i \u0110\u1eb7t",
      items: [
        { href: "/profile", label: "T\u00e0i kho\u1ea3n", icon: User },
        { href: "/app-updates", label: "Th\u00f4ng b\u00e1o c\u1eadp nh\u1eadt", icon: Bell },
      ],
    },
    {
      title: "D\u1ecbch V\u1ee5",
      items: [
        { href: "/backtest", label: "Backtest", icon: FlaskConical },
        { href: "/margin", label: "K\u00fd qu\u1ef9 - Mua nhanh", icon: Banknote, badge: "HOT" },
        { href: "/hdsd", label: "H\u01b0\u1edbng D\u1eabn S\u1eed D\u1ee5ng", icon: BookOpen },
      ],
    },
    ...(canManageSystem
      ? [
          {
            title: "D\u00e0nh ri\u00eang cho Admin",
            items: [{ href: "/admin", label: "Qu\u1ea3n l\u00fd h\u1ec7 th\u1ed1ng", icon: Shield, badge: "ADMIN" }],
          },
        ]
      : []),
  ];

  return (
    <MainLayout>
      <div className="mx-auto max-w-lg space-y-4 p-4 pb-28">
        {isLoading ? (
          <div className="rounded-2xl border bg-[var(--surface)] p-5" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 animate-pulse rounded-full bg-[var(--surface-2)]" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-24 animate-pulse rounded bg-[var(--surface-2)]" />
                <div className="h-3 w-40 animate-pulse rounded bg-[var(--surface-2)]" />
              </div>
            </div>
          </div>
        ) : isAuthenticated ? (
          <div className="rounded-2xl border bg-[var(--surface)] p-5" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-3">
              <Link href="/profile" className="flex min-w-0 flex-1 items-center gap-3">
                {userImage && !avatarError ? (
                  <img
                    src={userImage}
                    alt=""
                    className="h-14 w-14 rounded-full ring-2 ring-emerald-500/20"
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15">
                    <span className="text-xl font-bold text-emerald-500">{userInitial}</span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold" style={{ color: "var(--text-primary)" }}>
                    {userName}
                  </p>
                  <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
                    {userEmail}
                  </p>
                  {role === "VIP" && (
                    <span
                      className="mt-1.5 inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-bold"
                      style={{
                        background: "rgba(245,158,11,0.10)",
                        borderColor: "rgba(245,158,11,0.25)",
                        color: "#f59e0b",
                      }}
                    >
                      <Crown className="h-2.5 w-2.5" />
                      {vipTier === "PREMIUM" ? "PREMIUM" : "VIP"}
                    </span>
                  )}
                </div>
              </Link>
              <button
                type="button"
                onClick={toggleTheme}
                className="flex h-9 w-9 items-center justify-center rounded-full border"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--surface-2)" }}
                title={isDark ? ui.lightMode : ui.darkMode}
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
          </div>
        ) : (
          <Link href="/auth">
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
                <LogIn className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-500">{ui.login}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {ui.loginHint}
                </p>
              </div>
            </div>
          </Link>
        )}

        {isAuthenticated && (
          <div className="rounded-2xl border bg-[var(--surface)] p-4" style={{ borderColor: "var(--border)" }}>
            <div className="mb-3 flex items-center gap-2">
              <Settings className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
              <p className="text-sm font-black" style={{ color: "var(--text-primary)" }}>
                {ui.notificationTitle}
              </p>
            </div>
            <div className="space-y-3">
              {preferenceLabels.map((item) => {
                const enabled = preferences[item.key];
                const disabled = savingKey === item.key;

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => togglePreference(item.key)}
                    disabled={disabled}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-opacity disabled:opacity-60"
                    style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                        {item.label}
                      </span>
                      <span className="mt-0.5 block text-xs" style={{ color: "var(--text-muted)" }}>
                        {item.description}
                      </span>
                    </span>
                    <span
                      className="relative h-7 w-12 shrink-0 rounded-full transition-colors"
                      style={{ background: enabled ? "var(--primary)" : "var(--border)" }}
                    >
                      <span
                        className="absolute top-1 h-5 w-5 rounded-full bg-white transition-transform"
                        style={{ transform: enabled ? "translateX(22px)" : "translateX(4px)" }}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {menuGroups.map((group) => (
          <div key={group.title} className="overflow-hidden rounded-2xl border bg-[var(--surface)]" style={{ borderColor: "var(--border)" }}>
            <p className="px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-[0.15em]" style={{ color: "var(--text-muted)" }}>
              {group.title}
            </p>
            {group.items.map((item, index) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <div
                    className={`flex items-center gap-3 px-4 py-3 transition-colors ${index < group.items.length - 1 ? "border-b" : ""}`}
                    style={{ borderColor: "var(--border)" }}
                  >
                    <Icon className="h-5 w-5 shrink-0" style={{ color: "var(--text-secondary)" }} />
                    <span className="flex-1 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {item.label}
                    </span>
                    {item.badge && (
                      <span
                        className="rounded border px-1.5 py-0.5 text-[11px] font-black"
                        style={{
                          background: item.badge === "ADMIN" ? "rgba(59,130,246,0.10)" : "rgba(249,115,22,0.12)",
                          borderColor: item.badge === "ADMIN" ? "rgba(59,130,246,0.25)" : "rgba(249,115,22,0.30)",
                          color: item.badge === "ADMIN" ? "#3b82f6" : "#f97316",
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
                  </div>
                </Link>
              );
            })}
          </div>
        ))}

        {isAuthenticated && (
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex w-full items-center gap-3 rounded-2xl border border-red-500/15 bg-red-500/5 p-4"
          >
            <LogOut className="h-5 w-5 text-red-500" />
            <span className="text-sm font-bold text-red-500">{ui.logout}</span>
          </button>
        )}

        <p className="pt-2 text-center text-[12px]" style={{ color: "var(--text-muted)" }}>
          Powered by <span className="font-bold" style={{ color: "var(--primary)" }}>ADN CAPITAL</span>
        </p>
      </div>
    </MainLayout>
  );
}

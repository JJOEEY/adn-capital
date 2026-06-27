"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Activity,
  Bell,
  BookOpenText,
  ChevronDown,
  Crown,
  HelpCircle,
  LogIn,
  LogOut,
  Menu,
  Moon,
  Settings,
  Sun,
  X,
  type LucideIcon,
} from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useCurrentDbUser } from "@/hooks/useCurrentDbUser";

type Sheet = "notifications" | "menu" | null;

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  content: string;
  createdAt: string;
};

const supportLinks = [
  { label: "Group Zalo", href: "https://zalo.me/g/penyeg076" },
  { label: "Group Telegram", href: "https://t.me/+8_Dq4X4Y7SI2ZWVl" },
  { label: "Fanpage", href: "https://www.facebook.com/adninvestment" },
  { label: "Zalo/Mess: 0962 977 179", href: "tel:0962977179" },
  { label: "Group Facebook", href: "https://www.facebook.com/groups/859376078997090" },
];

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function SheetFrame({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[70] lg:hidden">
      <button
        type="button"
        aria-label="Đóng"
        className="absolute inset-0 bg-black/45"
        onClick={onClose}
      />
      <section
        className="absolute inset-x-0 bottom-0 max-h-[82vh] overflow-hidden rounded-t-[18px] border-t"
        style={{
          background: "var(--page-background)",
          borderColor: "var(--border)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-base font-black" style={{ color: "var(--text-primary)" }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border"
            style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-secondary)" }}
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[calc(82vh-56px)] overflow-y-auto px-4 py-3">{children}</div>
      </section>
    </div>
  );
}

function MenuRow({
  href,
  icon: Icon,
  label,
  onClick,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <Link href={href} onClick={onClick}>
      <div
        className="flex items-center gap-3 border-b px-1 py-3"
        style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
      >
        <span
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: "var(--surface)", color: "var(--text-secondary)" }}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-sm font-bold">{label}</span>
      </div>
    </Link>
  );
}

export function MobileTopBar() {
  const [sheet, setSheet] = useState<Sheet>(null);
  const [supportOpen, setSupportOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { data: session } = useSession();
  const { dbUser, isAuthenticated } = useCurrentDbUser();
  const pathname = usePathname();

  const userName = dbUser?.name || session?.user?.name || "ADN";
  const initial = useMemo(() => userName.trim().charAt(0).toUpperCase() || "A", [userName]);
  const isDark = theme === "dark";

  useEffect(() => {
    if (sheet !== "notifications") return;
    let cancelled = false;
    setLoadingNotifications(true);
    fetch("/api/notifications?limit=60&scope=updates", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (!cancelled) setNotifications(Array.isArray(payload?.notifications) ? payload.notifications : []);
      })
      .catch(() => {
        if (!cancelled) setNotifications([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingNotifications(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sheet]);

  const closeSheet = () => setSheet(null);

  // /aiden trên mobile chạy full-screen kiểu messenger → ẩn thanh top app (header thừa).
  if (pathname?.startsWith("/aiden")) return null;

  return (
    <>
      <header
        className="fixed left-0 right-0 top-0 z-50 lg:hidden"
        style={{
          background: "color-mix(in srgb, var(--glass-surface-strong) 94%, transparent)",
          borderBottom: "1px solid var(--border)",
          paddingTop: "env(safe-area-inset-top, 0px)",
          backdropFilter: "blur(var(--glass-blur))",
        }}
      >
        <div className="flex h-16 items-center justify-between gap-3 px-4">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2">
            <Image src="/brand/logo-square.png" alt="ADN" width={36} height={36} className="h-9 w-9 shrink-0 rounded-xl" />
            <div className="min-w-0">
              <p className="truncate text-sm font-black" style={{ color: "var(--text-primary)" }}>
                ADN Pulse
              </p>
              <p className="truncate text-[11px]" style={{ color: "var(--text-muted)" }}>
                Chiến lược giao dịch hôm nay
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-10 w-10 items-center justify-center rounded-full border"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-primary)" }}
              aria-label={isDark ? "Giao diện sáng" : "Giao diện tối"}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => setSheet("notifications")}
              className="flex h-10 w-10 items-center justify-center rounded-full border"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-primary)" }}
              aria-label="Thông báo"
            >
              <Bell className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setSheet("menu")}
              className="flex h-10 w-10 items-center justify-center rounded-full border"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-primary)" }}
              aria-label="Menu"
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {sheet === "notifications" && (
        <SheetFrame title="Thông báo" onClose={closeSheet}>
          {loadingNotifications ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-20 animate-pulse rounded-xl" style={{ background: "var(--surface)" }} />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div
              className="rounded-xl border p-5 text-center text-sm"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-secondary)" }}
            >
              Chưa có thông báo mới.
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((item) => (
                <article
                  key={item.id}
                  className="rounded-xl border p-3"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <h3 className="line-clamp-1 text-sm font-black" style={{ color: "var(--text-primary)" }}>
                      {item.title || "Cập nhật thị trường"}
                    </h3>
                    <span className="shrink-0 text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {formatTime(item.createdAt)}
                    </span>
                  </div>
                  <p className="whitespace-pre-line text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {item.content}
                  </p>
                </article>
              ))}
            </div>
          )}
        </SheetFrame>
      )}

      {sheet === "menu" && (
        <SheetFrame title="Menu" onClose={closeSheet}>
          <div
            className="mb-3 flex items-center justify-between rounded-xl border p-3"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full font-black"
                style={{ background: "var(--primary-light)", color: "var(--primary)" }}
              >
                {initial}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-black" style={{ color: "var(--text-primary)" }}>
                  {isAuthenticated ? userName : "Khách"}
                </p>
                <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
                  {isAuthenticated ? "Tài khoản ADN" : "Đăng nhập để đồng bộ dữ liệu"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-full border"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              aria-label={isDark ? "Giao diện sáng" : "Giao diện tối"}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <MenuRow href="/journal" icon={BookOpenText} label="ADN Diary" onClick={closeSheet} />
            <MenuRow href="/art" icon={Activity} label="ADN ART" onClick={closeSheet} />
            <MenuRow href="/pricing" icon={Crown} label="Pricing" onClick={closeSheet} />
            <button
              type="button"
              onClick={() => setSupportOpen((value) => !value)}
              className="flex w-full items-center gap-3 px-1 py-3 text-left"
              style={{ color: "var(--text-primary)" }}
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
              >
                <HelpCircle className="h-4 w-4" />
              </span>
              <span className="flex-1 text-sm font-bold">Hỗ trợ</span>
              <ChevronDown className={`h-4 w-4 transition ${supportOpen ? "rotate-180" : ""}`} />
            </button>
            {supportOpen && (
              <div className="border-t px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                {supportLinks.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    target={item.href.startsWith("http") ? "_blank" : undefined}
                    rel={item.href.startsWith("http") ? "noreferrer" : undefined}
                    className="block rounded-lg px-3 py-2 text-sm font-semibold"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            )}
            <MenuRow href="/menu" icon={Settings} label="Cài đặt cảnh báo" onClick={closeSheet} />
          </div>

          <div className="mt-3">
            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="flex w-full items-center justify-center gap-2 rounded-xl border p-3 text-sm font-black"
                style={{ borderColor: "rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.08)", color: "#ef4444" }}
              >
                <LogOut className="h-4 w-4" />
                Đăng xuất
              </button>
            ) : (
              <Link href="/auth" onClick={closeSheet}>
                <div
                  className="flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-black"
                  style={{ borderColor: "var(--border)", background: "var(--primary-light)", color: "var(--primary)" }}
                >
                  <LogIn className="h-4 w-4" />
                  Đăng nhập
                </div>
              </Link>
            )}
          </div>
        </SheetFrame>
      )}
    </>
  );
}

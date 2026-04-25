"use client";

import { FormEvent, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Bot, ChevronLeft, Moon, Search, Sun } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { isPrimaryAppRoute } from "@/lib/mobileNavigation";

export function PwaTopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [query, setQuery] = useState("");

  const canGoBack = useMemo(() => !isPrimaryAppRoute(pathname), [pathname]);
  const isDark = theme === "dark";

  const openChat = (value?: string) => {
    const trimmed = value?.trim();
    const suffix = trimmed ? `&q=${encodeURIComponent(trimmed)}` : "";
    router.push(`/notifications?tab=chatbot${suffix}`);
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    openChat(query);
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.replace("/dashboard");
  };

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 border-b lg:hidden"
      style={{
        background: "color-mix(in srgb, var(--bg-page) 92%, transparent)",
        borderColor: "var(--border)",
        backdropFilter: "blur(18px)",
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
    >
      <div className="flex h-16 items-center gap-2 px-3">
        {canGoBack && (
          <button
            type="button"
            onClick={handleBack}
            aria-label="Quay lại"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}

        <form onSubmit={handleSearch} className="min-w-0 flex-1">
          <div
            className="flex h-11 items-center gap-2 rounded-full border px-3"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              color: "var(--text-secondary)",
            }}
          >
            <Search className="h-4 w-4 shrink-0" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm mã để tư vấn"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
              style={{ color: "var(--text-primary)" }}
              inputMode="search"
              autoCapitalize="characters"
            />
          </div>
        </form>

        <button
          type="button"
          onClick={() => router.push("/notifications?tab=updates")}
          aria-label="Thông báo"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            color: "var(--text-primary)",
          }}
        >
          <Bell className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => openChat(query)}
          aria-label="Tư vấn đầu tư"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            color: "var(--primary)",
          }}
        >
          <Bot className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Đổi giao diện"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            color: "var(--text-primary)",
          }}
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
}

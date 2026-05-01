"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, Bot, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BRAND, getRouteDisplay } from "@/lib/brand/productNames";

export function AppHeader() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const display = getRouteDisplay(pathname);

  if (!mounted) return <div className="h-14" />;

  return (
    <header
      className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between px-6"
      style={{
        background: "var(--glass-surface-strong)",
        borderBottom: "1px solid var(--border)",
        boxShadow: "var(--shadow-ambient)",
        backdropFilter: "blur(var(--glass-blur))",
      }}
    >
      <div className="flex min-w-0 flex-col">
        <h1 className="truncate text-[17px] font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
          {display.title}
        </h1>
        <p className="truncate text-[13px]" style={{ color: "var(--text-secondary)" }}>
          {display.breadcrumb}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div
          className="hidden items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-medium md:flex"
          style={{ background: "var(--primary-light)", color: "var(--primary)" }}
        >
          <Bot className="h-3 w-3" />
          {BRAND.name.toUpperCase()}
        </div>

        <button
          aria-label="Thông báo"
          className="flex h-9 w-9 items-center justify-center rounded-full transition-all"
          style={{ color: "var(--text-secondary)" }}
          onMouseEnter={(event) => {
            event.currentTarget.style.background = "var(--bg-hover)";
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.background = "transparent";
          }}
        >
          <Bell className="h-4 w-4" />
        </button>

        <Button
          variant="ghost"
          size="sm"
          className="hidden h-9 items-center gap-2 rounded-lg border px-4 sm:flex"
          style={{
            borderColor: "var(--border)",
            color: "var(--text-secondary)",
          }}
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Làm mới
        </Button>
      </div>
    </header>
  );
}

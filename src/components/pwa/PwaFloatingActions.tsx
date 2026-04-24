"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Bot } from "lucide-react";

const actions = [
  {
    href: "/notifications?tab=updates",
    tab: "updates",
    label: "Th\u00f4ng b\u00e1o",
    icon: Bell,
  },
  {
    href: "/notifications?tab=chatbot",
    tab: "chatbot",
    label: "T\u01b0 v\u1ea5n \u0111\u1ea7u t\u01b0",
    icon: Bot,
  },
] as const;

export function PwaFloatingActions() {
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setActiveTab(new URLSearchParams(window.location.search).get("tab"));
  }, [pathname]);

  return (
    <div
      className="fixed right-4 z-50 flex flex-col gap-2 lg:hidden"
      style={{ bottom: "calc(88px + env(safe-area-inset-bottom, 0px))" }}
    >
      {actions.map((action) => {
        const Icon = action.icon;
        const active = pathname === "/notifications" && activeTab === action.tab;

        return (
          <Link
            key={action.href}
            href={action.href}
            aria-label={action.label}
            className="group flex h-11 w-11 items-center justify-center rounded-full border shadow-lg transition-all"
            style={{
              background: active ? "var(--primary)" : "color-mix(in srgb, var(--surface) 92%, transparent)",
              borderColor: active ? "var(--primary)" : "var(--border)",
              color: active ? "var(--primary-foreground, #fff)" : "var(--text-primary)",
              backdropFilter: "blur(18px)",
            }}
          >
            <Icon className="h-5 w-5" />
            <span className="sr-only">{action.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

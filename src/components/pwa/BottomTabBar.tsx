"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Bot, BookOpenText, Home, Menu, Newspaper } from "lucide-react";

const tabs = [
  { href: "/dashboard", label: "Trang ch\u1ee7", icon: Home },
  { href: "/tin-tuc", label: "Tin T\u1ee9c", icon: Newspaper },
  { href: "/dashboard/signal-map", label: "ADN AI Broker", icon: Bot },
  { href: "/art", label: "Ch\u1ec9 b\u00e1o ART", icon: Activity },
  { href: "/journal", label: "Nh\u1eadt k\u00fd", icon: BookOpenText },
  { href: "/menu", label: "Menu", icon: Menu },
];

export function BottomTabBar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname === href || pathname.startsWith(`${href}/`);

  const hapticTap = () => {
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(50);
    }
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t safe-area-bottom lg:hidden"
      style={{
        background: "color-mix(in srgb, var(--surface) 92%, transparent)",
        borderColor: "var(--border)",
        backdropFilter: "blur(18px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="mx-auto grid h-16 max-w-xl grid-cols-6 items-center px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.href);

          return (
            <Link key={tab.href} href={tab.href} className="min-w-0" onClick={hapticTap}>
              <div className="relative flex flex-col items-center gap-0.5 py-1.5">
                {active && (
                  <div
                    className="absolute -top-1.5 h-0.5 w-5 rounded-full"
                    style={{ background: "var(--primary)" }}
                  />
                )}
                <Icon
                  className="h-5 w-5 transition-colors duration-200"
                  style={{ color: active ? "var(--primary)" : "var(--text-muted)" }}
                />
                <span
                  className="text-center text-[10px] font-semibold leading-tight transition-colors duration-200"
                  style={{ color: active ? "var(--primary)" : "var(--text-muted)" }}
                >
                  {tab.label}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

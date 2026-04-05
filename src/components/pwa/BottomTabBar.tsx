"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Home,
  BarChart2,
  BookOpen,
  Zap,
  MessageSquare,
  Menu,
} from "lucide-react";

const tabs = [
  { href: "/dashboard", label: "Trang chủ", icon: Home },
  { href: "/dashboard/rs-rating", label: "Theo dõi", icon: BarChart2 },
  { href: "/journal", label: "Sổ lệnh", icon: BookOpen },
  { href: "/dashboard/signal-map", label: "Sở hữu", icon: Zap },
  { href: "/notifications", label: "Tin nhắn", icon: MessageSquare },
  { href: "/menu", label: "Menu", icon: Menu },
];

/**
 * BottomTabBar — thanh điều hướng dưới cùng giống DNSE app.
 * Hiển thị trên mobile / PWA standalone mode.
 */
export function BottomTabBar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname === href || pathname.startsWith(href + "/");

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-white/[0.06] safe-area-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.href);

          return (
            <Link key={tab.href} href={tab.href} className="flex-1">
              <div className="flex flex-col items-center gap-0.5 py-1.5 relative">
                {active && (
                  <motion.div
                    layoutId="bottomTabIndicator"
                    className="absolute -top-1.5 w-5 h-0.5 bg-emerald-400 rounded-full"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
                <Icon
                  className={`w-5 h-5 transition-colors duration-200 ${
                    active ? "text-emerald-400" : "text-white/35"
                  }`}
                />
                <span
                  className={`text-[9px] font-medium transition-colors duration-200 ${
                    active ? "text-emerald-400" : "text-white/35"
                  }`}
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

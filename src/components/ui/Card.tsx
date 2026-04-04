"use client";

import { cn } from "@/lib/utils";
import { useTheme } from "@/components/providers/ThemeProvider";

interface CardProps {
  className?: string;
  children: React.ReactNode;
  glass?: boolean;
  glow?: "emerald" | "purple" | "yellow" | "red";
}

export function Card({ className, children, glass: isGlass, glow }: CardProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div
      className={cn(
        "glow-card rounded-2xl border transition-all duration-300",
        isGlass
          ? isDark
            ? "bg-white/[0.04] backdrop-blur-2xl border-white/[0.1] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_8px_32px_-8px_rgba(0,0,0,0.4)]"
            : "bg-white/50 backdrop-blur-2xl border-white/60 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.7),0_8px_32px_-8px_rgba(0,0,0,0.1)]"
          : isDark
            ? "bg-[#0c1425]/80 backdrop-blur-xl border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04),0_4px_24px_-4px_rgba(0,0,0,0.3)]"
            : "bg-white/70 backdrop-blur-xl border-white/50 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.08)]",
        glow === "emerald" && "shadow-emerald-500/10 shadow-lg border-emerald-500/20",
        glow === "purple" && "shadow-purple-500/10 shadow-lg border-purple-500/20",
        glow === "yellow" && "shadow-yellow-500/10 shadow-lg border-yellow-500/20",
        glow === "red" && "shadow-red-500/10 shadow-lg border-red-500/20",
        className
      )}
    >
      {children}
    </div>
  );
}

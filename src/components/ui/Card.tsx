"use client";

import { cn } from "@/lib/utils";

interface CardProps {
  className?: string;
  children: React.ReactNode;
  glass?: boolean;
  glow?: "emerald" | "purple" | "yellow" | "red";
}

export function Card({ className, children, glow }: CardProps) {
  return (
    <div
      className={cn(
        "glow-card rounded-[14px] border transition-all duration-200",
        // Solid surfaces per ADN Design System — no backdrop-blur
        "bg-[var(--surface)] border-[var(--border)]",
        "hover:border-[var(--border-strong)] hover:shadow-[0_4px_16px_-4px_rgba(46,77,61,0.10)]",
        glow === "emerald" && "shadow-[0_0_16px_rgba(46,77,61,0.18)] border-[rgba(46,77,61,0.20)]",
        glow === "purple" && "shadow-[0_0_16px_rgba(125,132,113,0.18)] border-[rgba(125,132,113,0.20)]",
        glow === "yellow" && "shadow-[0_0_16px_rgba(160,132,92,0.18)] border-[rgba(160,132,92,0.20)]",
        glow === "red"    && "shadow-[0_0_16px_rgba(192,57,43,0.18)] border-[rgba(192,57,43,0.20)]",
        className
      )}
    >
      {children}
    </div>
  );
}

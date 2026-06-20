"use client";

/**
 * Light/dark toggle for the marketing surface. Drives the app's global theme
 * (ThemeProvider: `.dark`/`.light` on <html>, localStorage `adn-theme`) so the
 * whole site + dashboard share one theme. The marketing dark CSS keys off `.dark`.
 */

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      aria-label="Đổi giao diện sáng tối"
      title={dark ? "Chuyển sáng" : "Chuyển tối"}
      className="grid h-9 w-9 place-items-center rounded-full border border-[var(--hairline)] text-[var(--ink-muted)] transition-colors hover:border-[var(--moss)] hover:text-[var(--ink)]"
    >
      {dark ? <Sun className="h-[18px] w-[18px]" strokeWidth={1.7} /> : <Moon className="h-[18px] w-[18px]" strokeWidth={1.7} />}
    </button>
  );
}

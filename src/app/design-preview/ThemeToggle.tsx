"use client";

/**
 * Light/dark toggle for the design-preview. Flips the `dp-dark` class on the
 * `.dp-root` wrapper and remembers the choice in localStorage. The Shell renders
 * a tiny pre-paint script that applies the saved theme before first paint.
 */

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const root = document.querySelector(".dp-root");
    setDark(root?.classList.contains("dp-dark") ?? false);
  }, []);

  const toggle = () => {
    const root = document.querySelector(".dp-root");
    if (!root) return;
    const next = !root.classList.contains("dp-dark");
    root.classList.toggle("dp-dark", next);
    document.documentElement.style.colorScheme = next ? "dark" : "light";
    try { localStorage.setItem("dp-theme", next ? "dark" : "light"); } catch {}
    setDark(next);
  };

  return (
    <button
      onClick={toggle}
      aria-label="Đổi giao diện sáng tối"
      title={dark ? "Chuyển sáng" : "Chuyển tối"}
      className="grid h-9 w-9 place-items-center rounded-full border border-[var(--hairline)] text-[var(--ink-muted)] transition-colors hover:border-[var(--moss)] hover:text-[var(--ink)]"
    >
      {dark ? <Sun className="h-[18px] w-[18px]" strokeWidth={1.7} /> : <Moon className="h-[18px] w-[18px]" strokeWidth={1.7} />}
    </button>
  );
}

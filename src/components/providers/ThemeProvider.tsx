"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  // Initialize from localStorage, default light
  useEffect(() => {
    const stored = localStorage.getItem("adn-theme") as Theme | null;
    const initial = stored === "dark" ? "dark" : "light";
    setThemeState(initial);
    applyTheme(initial);
  }, []);

  const applyTheme = (t: Theme) => {
    // Remove cả 2 class trước
    document.documentElement.classList.remove("dark", "light");
    // Thêm class tương ứng
    document.documentElement.classList.add(t);
  };

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem("adn-theme", t);
    applyTheme(t);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

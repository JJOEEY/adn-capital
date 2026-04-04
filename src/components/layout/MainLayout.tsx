"use client";

import { Header } from "./Header";
import { Footer } from "./Footer";
import { useTheme } from "@/components/providers/ThemeProvider";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className={`min-h-screen overflow-x-hidden flex flex-col ${isDark ? "bg-city-dark" : "bg-city-light"}`}>
      <Header />
      <main className="pt-14 lg:pt-[88px] overflow-x-hidden overflow-y-auto flex-1 px-3 md:px-0">{children}</main>
      <Footer />
    </div>
  );
}

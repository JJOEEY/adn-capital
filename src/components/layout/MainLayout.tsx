"use client";

import { Header } from "./Header";
import { Footer } from "./Footer";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useSidebarStore } from "@/store/sidebarStore";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { collapsed } = useSidebarStore();

  return (
    <div className={`min-h-screen overflow-x-hidden ${isDark ? "bg-city-dark" : "bg-city-light"}`}>
      <Header />
      <div className={`pt-14 lg:pt-0 transition-all duration-300 min-h-screen flex flex-col ${
        collapsed ? "lg:pl-[68px]" : "lg:pl-[260px]"
      }`}>
        <main className="flex-1 overflow-x-hidden overflow-y-auto px-3 md:px-0">{children}</main>
        <Footer />
      </div>
    </div>
  );
}

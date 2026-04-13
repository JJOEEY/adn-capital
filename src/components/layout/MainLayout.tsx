"use client";

import { useEffect, useState } from "react";
import { Header } from "./Header";
import { AppHeader } from "./AppHeader";
import { Footer } from "./Footer";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useSidebarStore } from "@/store/sidebarStore";
import { BottomTabBar } from "@/components/pwa/BottomTabBar";
import { SplashScreen } from "@/components/pwa/SplashScreen";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";

interface MainLayoutProps {
  children: React.ReactNode;
  disableSwipe?: boolean;
}

export function MainLayout({ children, disableSwipe = false }: MainLayoutProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { collapsed } = useSidebarStore();
  const swipeHandlers = useSwipeNavigation();

  const [isMobile, setIsMobile] = useState(false);
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);

    // Show splash on first load in standalone mode
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone && !sessionStorage.getItem("adn_splash_shown")) {
      setShowSplash(true);
      sessionStorage.setItem("adn_splash_shown", "1");
    }

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Only attach swipe handlers on mobile when not disabled (e.g. chatbot input)
  const touchProps = isMobile && !disableSwipe ? swipeHandlers : {};

  return (
    <div className={`min-h-screen flex ${isDark ? "bg-city-dark" : "bg-city-light"}`}>
      {showSplash && <SplashScreen />}

      {/* Sidebar (fixed on desktop) */}
      <Header />

      {/* Mobile: show bottom tab bar */}
      {isMobile && <BottomTabBar />}

      <div
        {...touchProps}
        className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${
          isMobile
            ? "pt-14 pb-20"
            : collapsed
            ? "pl-[68px]"
            : "pl-[240px]"
        }`}
        style={isMobile ? { paddingBottom: "calc(64px + env(safe-area-inset-bottom, 0px))" } : undefined}
      >
        {/* In-app Header strip */}
        {!isMobile && <AppHeader />}

        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          {children}
        </main>
        
        {!isMobile && <Footer />}
      </div>
    </div>
  );
}


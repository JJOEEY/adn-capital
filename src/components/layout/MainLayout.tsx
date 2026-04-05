"use client";

import { useEffect, useState } from "react";
import { Header } from "./Header";
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
    <div className={`min-h-screen overflow-x-hidden ${isDark ? "bg-city-dark" : "bg-city-light"}`}>
      {showSplash && <SplashScreen />}

      {/* Desktop: keep sidebar */}
      <div className="hidden lg:block">
        <Header />
      </div>

      {/* Mobile: show bottom tab bar, hide sidebar */}
      {isMobile && <BottomTabBar />}

      <div
        {...touchProps}
        className={`transition-all duration-300 min-h-screen flex flex-col ${
          isMobile
            ? "pt-0 pb-20"
            : collapsed
            ? "lg:pl-[68px]"
            : "lg:pl-[260px]"
        }`}
        style={isMobile ? { paddingBottom: "calc(64px + env(safe-area-inset-bottom, 0px))" } : undefined}
      >
        <main className="flex-1 overflow-x-hidden overflow-y-auto px-0 md:px-0">{children}</main>
        {!isMobile && <Footer />}
      </div>
    </div>
  );
}

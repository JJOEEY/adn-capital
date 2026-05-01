"use client";

import { useEffect, useState } from "react";
import { Header } from "./Header";
import { AppHeader } from "./AppHeader";
import { Footer } from "./Footer";
import { useSidebarStore } from "@/store/sidebarStore";
import { BottomTabBar } from "@/components/pwa/BottomTabBar";
import { SplashScreen } from "@/components/pwa/SplashScreen";
import { AppUpdateNotice } from "@/components/pwa/AppUpdateNotice";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";
import { isStandaloneAppRuntime } from "@/lib/mobileRuntime";

interface MainLayoutProps {
  children: React.ReactNode;
  disableSwipe?: boolean;
}

export function MainLayout({ children, disableSwipe = false }: MainLayoutProps) {
  const { collapsed } = useSidebarStore();
  const swipeHandlers = useSwipeNavigation();

  const [isMobile, setIsMobile] = useState(false);
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);

    if (isStandaloneAppRuntime() && !sessionStorage.getItem("adn_splash_shown")) {
      setShowSplash(true);
      sessionStorage.setItem("adn_splash_shown", "1");
    }

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Only attach swipe handlers on mobile when not disabled (e.g. chatbot input)
  const touchProps = isMobile && !disableSwipe ? swipeHandlers : {};

  return (
    <div className="min-h-screen flex" style={{ background: "var(--page-background)" }}>
      {showSplash && <SplashScreen />}

      {/* Sidebar (fixed on desktop) */}
      <Header />

      {/* Mobile: show bottom tab bar */}
      {isMobile && <BottomTabBar />}

      <div
        {...touchProps}
        className={`flex-1 min-w-0 flex flex-col min-h-screen transition-all duration-300 ${
          isMobile
            ? "pb-28"
            : collapsed
            ? "pl-[68px]"
            : "pl-[240px]"
        }`}
        style={
          isMobile
            ? {
                paddingTop: "calc(64px + env(safe-area-inset-top, 0px))",
                paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))",
              }
            : undefined
        }
      >
        {/* In-app Header strip */}
        {!isMobile && <AppHeader />}

        <main className="flex-1 min-w-0 overflow-y-auto">
          {isMobile && <AppUpdateNotice />}
          {children}
        </main>
        
        {!isMobile && <Footer />}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Header } from "./Header";
import { AppHeader } from "./AppHeader";
import { Footer } from "./Footer";
import { useSidebarStore } from "@/store/sidebarStore";
import { BottomTabBar } from "@/components/pwa/BottomTabBar";
import { SplashScreen } from "@/components/pwa/SplashScreen";
import { AppUpdateNotice } from "@/components/pwa/AppUpdateNotice";
import { PwaTopBar } from "@/components/pwa/PwaTopBar";
import { useNativeBackButton } from "@/hooks/useNativeBackButton";
import { isStandaloneAppRuntime } from "@/lib/mobileRuntime";

interface MainLayoutProps {
  children: React.ReactNode;
  disableSwipe?: boolean;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { collapsed } = useSidebarStore();

  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  const [showSplash, setShowSplash] = useState(false);

  useNativeBackButton();

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

  const mobile = isMobile === true;
  const desktop = isMobile === false;

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg-page)" }}>
      {showSplash && <SplashScreen />}

      {/* Sidebar (fixed on desktop) */}
      {desktop && <Header />}

      {mobile && (
        <>
          <PwaTopBar />
          <BottomTabBar />
        </>
      )}

      <div
        className={`flex-1 min-w-0 flex flex-col min-h-screen transition-all duration-300 ${
          mobile
            ? "pb-28"
            : desktop && collapsed
            ? "pl-[68px]"
            : desktop
            ? "pl-[240px]"
            : ""
        }`}
        style={
          mobile
            ? {
                paddingTop: "calc(76px + env(safe-area-inset-top, 0px))",
                paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))",
              }
            : undefined
        }
      >
        {/* In-app Header strip */}
        {desktop && <AppHeader />}

        <main className="flex-1 min-w-0 overflow-y-auto">
          {mobile && <AppUpdateNotice />}
          {children}
        </main>
        
        {desktop && <Footer />}
      </div>
    </div>
  );
}

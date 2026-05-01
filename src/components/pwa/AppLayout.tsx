"use client";

import { useEffect, useState } from "react";
import { BottomTabBar } from "@/components/pwa/BottomTabBar";
import { SplashScreen } from "@/components/pwa/SplashScreen";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";

/**
 * AppLayout — PWA app layout wrapper.
 * - Hiển thị SplashScreen lần đầu mở app
 * - Hiển thị BottomTabBar
 * - Swipe gestures giữa các tab
 * - Safe area insets cho iPhone notch
 */
export function AppLayout({ children }: { children: React.ReactNode }) {
  const [isStandalone, setIsStandalone] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const swipeHandlers = useSwipeNavigation();

  useEffect(() => {
    // Detect PWA standalone mode
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    setIsStandalone(standalone);

    // Show splash only on first load in standalone mode
    if (standalone && !sessionStorage.getItem("adn_splash_shown")) {
      setShowSplash(true);
      sessionStorage.setItem("adn_splash_shown", "1");
    }
  }, []);

  return (
    <>
      {showSplash && <SplashScreen />}

      <div
        {...swipeHandlers}
        className="min-h-screen pb-20"
        style={{
          background: "var(--page-background)",
          color: "var(--text-primary)",
          paddingBottom: "env(safe-area-inset-bottom, 80px)",
        }}
      >
        {children}
      </div>

      <BottomTabBar />
    </>
  );
}

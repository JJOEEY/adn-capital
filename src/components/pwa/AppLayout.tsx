"use client";

import { useEffect, useState } from "react";
import { BottomTabBar } from "@/components/pwa/BottomTabBar";
import { PwaTopBar } from "@/components/pwa/PwaTopBar";
import { SplashScreen } from "@/components/pwa/SplashScreen";
import { useNativeBackButton } from "@/hooks/useNativeBackButton";
import { isStandaloneAppRuntime } from "@/lib/mobileRuntime";

/**
 * AppLayout is kept for mobile-only surfaces that do not use MainLayout.
 * Navigation is explicit through the top bar and bottom tabs; horizontal swipe
 * is intentionally disabled to match native app behavior.
 */
export function AppLayout({ children }: { children: React.ReactNode }) {
  const [showSplash, setShowSplash] = useState(false);

  useNativeBackButton();

  useEffect(() => {
    if (isStandaloneAppRuntime() && !sessionStorage.getItem("adn_splash_shown")) {
      setShowSplash(true);
      sessionStorage.setItem("adn_splash_shown", "1");
    }
  }, []);

  return (
    <>
      {showSplash && <SplashScreen />}
      <PwaTopBar />

      <div
        className="min-h-screen"
        style={{
          background: "var(--bg-page)",
          color: "var(--text-primary)",
          paddingTop: "calc(76px + env(safe-area-inset-top, 0px))",
          paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        {children}
      </div>

      <BottomTabBar />
    </>
  );
}

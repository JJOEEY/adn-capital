"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isPrimaryAppRoute } from "@/lib/mobileNavigation";
import { isAdnNativeRuntime } from "@/lib/mobileRuntime";

type BackButtonEvent = {
  canGoBack?: boolean;
};

type NativeAppPlugin = {
  addListener: (
    eventName: "backButton",
    listenerFunc: (event: BackButtonEvent) => void,
  ) => Promise<{ remove: () => Promise<void> }>;
  minimizeApp?: () => Promise<void>;
  exitApp?: () => Promise<void>;
};

export function useNativeBackButton() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isAdnNativeRuntime()) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    import("@capacitor/app")
      .then(({ App }) => {
        const app = App as NativeAppPlugin;

        return app.addListener("backButton", (event) => {
          if (!isPrimaryAppRoute(pathname)) {
            if (event.canGoBack !== false) {
              router.back();
              return;
            }

            router.replace("/dashboard");
            return;
          }

          if (typeof app.minimizeApp === "function") {
            void app.minimizeApp();
            return;
          }

          if (typeof app.exitApp === "function") {
            void app.exitApp();
          }
        });
      })
      .then((listener) => {
        if (cancelled) {
          void listener.remove();
          return;
        }

        cleanup = () => {
          void listener.remove();
        };
      })
      .catch(() => {
        // Browser/PWA runtime does not need the native App plugin.
      });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [pathname, router]);
}

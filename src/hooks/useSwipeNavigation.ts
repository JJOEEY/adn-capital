"use client";

import { useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";

const TAB_ORDER = [
  "/dashboard",
  "/dashboard/rs-rating",
  "/journal",
  "/dashboard/signal-map",
  "/notifications",
  "/menu",
];

const SWIPE_THRESHOLD = 60;

/**
 * Hook: Vuốt trái/phải để chuyển tab.
 * Trả về touch handlers để gắn vào container.
 */
export function useSwipeNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const touchStart = useRef<{ x: number; y: number; t: number } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY, t: Date.now() };
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart.current) return;

      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStart.current.x;
      const dy = touch.clientY - touchStart.current.y;
      const dt = Date.now() - touchStart.current.t;

      touchStart.current = null;

      // Ignore vertical swipes or slow swipes
      if (Math.abs(dy) > Math.abs(dx) || dt > 500) return;
      if (Math.abs(dx) < SWIPE_THRESHOLD) return;

      // Find current tab index
      const currentIdx = TAB_ORDER.findIndex(
        (href) =>
          href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname === href || pathname.startsWith(href + "/")
      );

      if (currentIdx === -1) return;

      const nextIdx = dx < 0
        ? Math.min(currentIdx + 1, TAB_ORDER.length - 1)  // swipe left → next
        : Math.max(currentIdx - 1, 0);                     // swipe right → prev

      if (nextIdx !== currentIdx) {
        router.push(TAB_ORDER[nextIdx]);
      }
    },
    [pathname, router]
  );

  return { onTouchStart, onTouchEnd };
}

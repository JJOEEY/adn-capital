"use client";

import { useEffect } from "react";

type Props = {
  articleId: string;
  slug: string;
};

const DEPTHS = [25, 50, 75, 100] as const;

export function ArticleAnalyticsTracker({ articleId, slug }: Props) {
  useEffect(() => {
    const startedAt = Date.now();
    const sentDepths = new Set<number>();

    const sendEvent = (eventType: "ARTICLE_VIEW" | "READ_DEPTH", readDepth = 0) => {
      const payload = {
        articleId,
        slug,
        eventType,
        readDepth,
        readTimeSec: Math.round((Date.now() - startedAt) / 1000),
        referrer: document.referrer || null,
        path: window.location.pathname,
      };

      void fetch("/api/articles/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => undefined);
    };

    sendEvent("ARTICLE_VIEW");

    const measureDepth = () => {
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop;
      const viewportBottom = scrollTop + window.innerHeight;
      const totalHeight = Math.max(doc.scrollHeight - window.innerHeight, 1);
      const depth = Math.min(100, Math.max(0, Math.round((viewportBottom / (totalHeight + window.innerHeight)) * 100)));

      for (const milestone of DEPTHS) {
        if (depth >= milestone && !sentDepths.has(milestone)) {
          sentDepths.add(milestone);
          sendEvent("READ_DEPTH", milestone);
        }
      }
    };

    const onScroll = () => window.requestAnimationFrame(measureDepth);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    const initialTimer = window.setTimeout(measureDepth, 1200);

    return () => {
      window.clearTimeout(initialTimer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [articleId, slug]);

  return null;
}

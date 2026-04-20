import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-check";
import { getTopicCacheInspections } from "@/lib/datahub/core";
import { listTopicDefinitions } from "@/lib/datahub/registry";
import { emitObservabilityEvent } from "@/lib/observability";

export const dynamic = "force-dynamic";

export async function GET() {
  const ok = await isAdmin();
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const definitions = listTopicDefinitions();
  const cacheEntries = getTopicCacheInspections();
  const staleCount = cacheEntries.filter((item) => item.freshness === "stale" || item.freshness === "expired" || item.freshness === "error").length;
  const cacheByFamily = cacheEntries.reduce<Record<string, number>>((acc, row) => {
    acc[row.family] = (acc[row.family] ?? 0) + 1;
    return acc;
  }, {});

  emitObservabilityEvent({
    domain: "health",
    event: "topic_health_snapshot",
    meta: {
      definitionsCount: definitions.length,
      cacheEntries: cacheEntries.length,
      staleCount,
    },
  });

  return NextResponse.json({
    now: new Date().toISOString(),
    definitionsCount: definitions.length,
    cacheEntries: cacheEntries.length,
    staleCount,
    cacheByFamily,
    definitions,
    cache: cacheEntries,
  });
}

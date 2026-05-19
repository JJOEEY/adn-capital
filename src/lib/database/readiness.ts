import { getDatabaseEodMarketDataset } from "@/lib/database/eod";
import { getDatabaseNewsHealth } from "@/lib/database/providers/news";
import { getDatabaseRealtimeHealth } from "@/lib/database/radar-realtime";
import { getDatabaseToolLatest } from "@/lib/database/tool-latest";

export async function getDatabaseV2Readiness() {
  const [news, morning, eod, realtime, aiden] = await Promise.all([
    getDatabaseNewsHealth(),
    getDatabaseToolLatest({ tool: "brief", dataset: "brief.morning", key: "latest", maxAgeMs: 36 * 60 * 60_000, ignoreExpires: true }),
    getDatabaseToolLatest({ tool: "eod", dataset: "market.eod", key: "latest", maxAgeMs: 48 * 60 * 60_000, ignoreExpires: true }),
    getDatabaseRealtimeHealth(),
    getDatabaseToolLatest({ tool: "aiden", dataset: "aiden.context", key: "latest", maxAgeMs: 24 * 60 * 60_000, ignoreExpires: true }),
  ]);
  const missingFields = [
    ...news.missingFields.map((field) => `news:${field}`),
    ...(!morning ? ["morning:brief.latest"] : morning.missingFields.map((field) => `morning:${field}`)),
    ...(!eod ? ["eod:market.eod.latest"] : eod.missingFields.map((field) => `eod:${field}`)),
    ...realtime.missingFields.map((field) => `realtime:${field}`),
    ...(!aiden ? ["aiden:context.latest"] : aiden.missingFields.map((field) => `aiden:${field}`)),
  ];
  return {
    ok: missingFields.length === 0,
    status: missingFields.length === 0 ? "ok" : "degraded",
    checkedAt: new Date().toISOString(),
    missingFields,
    checks: {
      news,
      morning: morning
        ? {
            ok: morning.missingFields.length === 0,
            dataset: morning.dataset,
            source: morning.source,
            updatedAt: morning.updatedAt,
            missingFields: morning.missingFields,
          }
        : { ok: false, missingFields: ["brief.morning:latest"] },
      eod: eod
        ? {
            ok: eod.missingFields.length === 0,
            dataset: eod.dataset,
            source: eod.source,
            updatedAt: eod.updatedAt,
            missingFields: eod.missingFields,
          }
        : { ok: false, missingFields: ["market.eod:latest"] },
      realtime,
      aiden: aiden
        ? {
            ok: aiden.missingFields.length === 0,
            dataset: aiden.dataset,
            source: aiden.source,
            updatedAt: aiden.updatedAt,
            missingFields: aiden.missingFields,
          }
        : { ok: false, missingFields: ["aiden.context:latest"] },
    },
  };
}

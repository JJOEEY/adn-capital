import { getDatabaseAidenHealth } from "@/lib/database/aiden";
import { getDatabaseEodMarketDataset } from "@/lib/database/eod";
import { getDatabaseMorningReadiness } from "@/lib/database/morning-readiness";
import { getDatabaseNewsHealth } from "@/lib/database/providers/news";
import { getDatabaseRealtimeHealth } from "@/lib/database/radar-realtime";

export async function getDatabaseV2Readiness() {
  const [news, morning, eod, realtime, aiden] = await Promise.all([
    getDatabaseNewsHealth(),
    getDatabaseMorningReadiness({ useFiinquantFallback: false }),
    getDatabaseEodMarketDataset({ useFiinquantFallback: false }),
    getDatabaseRealtimeHealth(),
    getDatabaseAidenHealth(),
  ]);
  const missingFields = [
    ...news.missingFields.map((field) => `news:${field}`),
    ...morning.missingFields.map((field) => `morning:${field}`),
    ...eod.missingFields.map((field) => `eod:${field}`),
    ...realtime.missingFields.map((field) => `realtime:${field}`),
    ...aiden.missingFields.map((field) => `aiden:${field}`),
  ];
  return {
    ok: missingFields.length === 0,
    status: missingFields.length === 0 ? "ok" : "degraded",
    checkedAt: new Date().toISOString(),
    missingFields,
    checks: {
      news,
      morning,
      eod: {
        ok: eod.ok,
        dataset: eod.dataset,
        providerStatus: eod.providerStatus,
        missingFields: eod.missingFields,
      },
      realtime,
      aiden,
    },
  };
}

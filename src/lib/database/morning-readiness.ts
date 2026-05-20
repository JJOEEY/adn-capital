import { getCachedDatabaseEodMarketDataset, getDatabaseEodMarketDataset } from "@/lib/database/eod";
import { getDatabaseNewsHealth } from "@/lib/database/providers/news";
import type { DatabaseMorningReadiness } from "@/lib/database/providers/news";

function dateKeyInVietnam(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function previousTradingDateKey(date = new Date()) {
  const value = new Date(date);
  do {
    value.setDate(value.getDate() - 1);
    const weekday = value.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh", weekday: "short" });
    if (weekday !== "Sat" && weekday !== "Sun") break;
  } while (true);
  return dateKeyInVietnam(value);
}

function hasIndex(data: Awaited<ReturnType<typeof getDatabaseEodMarketDataset>>["data"], ticker: string) {
  return Boolean(data?.indices?.some((item) => item.ticker === ticker && item.value != null));
}

export async function getDatabaseMorningReadiness(options?: {
  tradingDate?: string;
  previousTradingDate?: string;
  useFiinquantFallback?: boolean;
  useFiinquantEnrichment?: boolean;
}): Promise<DatabaseMorningReadiness> {
  const tradingDate = options?.tradingDate ?? dateKeyInVietnam();
  const previousTradingDate = options?.previousTradingDate ?? previousTradingDateKey();
  const eodPromise = getCachedDatabaseEodMarketDataset({ tradingDate: previousTradingDate })
    .then((cached) => cached ?? getDatabaseEodMarketDataset({
      tradingDate: previousTradingDate,
      useFiinquantEnrichment: options?.useFiinquantEnrichment ?? options?.useFiinquantFallback ?? true,
    }));
  const [news, eod] = await Promise.all([
    getDatabaseNewsHealth({ windowHours: 36 }),
    eodPromise,
  ]);

  const requiredIndices = ["VNINDEX", "VN30"];
  const available = requiredIndices.filter((ticker) => hasIndex(eod.data, ticker));
  const referenceOk = requiredIndices.every((ticker) => available.includes(ticker));
  const newsOk =
    (news.bySource.cafef ?? 0) > 0 &&
    (news.bySource.vietstock ?? 0) > 0 &&
    ((news.byCategory.market ?? 0) > 0 || (news.byCategory.morning ?? 0) > 0) &&
    ((news.byCategory.macro ?? 0) > 0 || (news.byCategory.global ?? 0) > 0);
  const eodOk = eod.data != null && eod.data.runtimeCoverage.latestRows != null && eod.data.runtimeCoverage.latestRows > 0;
  const missingFields = [
    ...(!referenceOk ? requiredIndices.filter((ticker) => !available.includes(ticker)).map((ticker) => `reference_index:${ticker}`) : []),
    ...(!newsOk ? news.missingFields : []),
    ...(!eodOk ? ["market.eod:previous_trading_date"] : []),
    ...(eod.missingFields ?? []).map((field) => `eod:${field}`),
  ];

  return {
    ok: missingFields.length === 0,
    publishAllowed: missingFields.length === 0,
    checkedAt: new Date().toISOString(),
    tradingDate,
    previousTradingDate,
    missingFields,
    checks: {
      referenceIndices: {
        ok: referenceOk,
        required: requiredIndices,
        available,
      },
      news: {
        ok: newsOk,
        cafefCount: news.bySource.cafef ?? 0,
        vietstockCount: news.bySource.vietstock ?? 0,
        marketCount: news.byCategory.market ?? 0,
        macroCount: (news.byCategory.macro ?? 0) + (news.byCategory.global ?? 0),
        latest: news.latest,
      },
      eod: {
        ok: eodOk,
        dataset: eod.dataset,
        providerCode: eod.providerStatus.code ?? null,
        missingFields: eod.missingFields,
      },
    },
  };
}

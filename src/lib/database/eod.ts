import type { DatabaseProviderStatus, DatabaseResult } from "@/lib/database/contracts";
import { databaseError, databaseOk } from "@/lib/database/contracts";
import { fetchEodMarketData } from "@/lib/fiinquantClient";
import { getStoredDnseEodMarketDataset } from "./providers/dnse";
import type { DnseEodMarketData } from "./providers/dnse";

function dateKeyInVietnam(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function needsFiinquantFallback(missingFields: string[]) {
  return missingFields.some((field) => field.includes("requires-fiinquant-fallback"));
}

function hasFallbackData(data: NonNullable<DnseEodMarketData["fallback"]>["fiinquant"]) {
  return Boolean(
    data &&
      (
        data.propTradingTopBuy.length ||
        data.propTradingTopSell.length ||
        data.individualTopBuy.length ||
        data.individualTopSell.length
      ),
  );
}

export async function getDatabaseEodMarketDataset(options?: {
  symbols?: string[];
  tradingDate?: string;
  useFiinquantFallback?: boolean;
}): Promise<DatabaseResult<DnseEodMarketData>> {
  const startedAt = Date.now();
  const tradingDate = options?.tradingDate ?? dateKeyInVietnam();
  const dnse = await getStoredDnseEodMarketDataset({
    symbols: options?.symbols,
    tradingDate,
  });

  let data = dnse.data;
  let missingFields = [...dnse.missingFields];
  let fallbackError: string | null = null;

  if (data && options?.useFiinquantFallback !== false && needsFiinquantFallback(missingFields)) {
    try {
      const fiin = await fetchEodMarketData(tradingDate);
      const fiinFallback: NonNullable<DnseEodMarketData["fallback"]>["fiinquant"] = {
        propTradingTopBuy: fiin?.prop_trading_top_buy ?? [],
        propTradingTopSell: fiin?.prop_trading_top_sell ?? [],
        individualTopBuy: fiin?.individual_top_buy ?? [],
        individualTopSell: fiin?.individual_top_sell ?? [],
        missingFields: fiin?.missingFields ?? [],
        retrievedAt: new Date().toISOString(),
      };
      data = {
        ...data,
        fallback: {
          ...data.fallback,
          fiinquant: fiinFallback,
        },
      };
      if (hasFallbackData(fiinFallback)) {
        missingFields = missingFields.filter((field) => !field.includes("requires-fiinquant-fallback"));
      }
    } catch (error) {
      fallbackError = error instanceof Error ? error.message.slice(0, 180) : String(error).slice(0, 180);
    }
  }

  const providerStatus: DatabaseProviderStatus = {
    provider: "database",
    ok: Boolean(data) && missingFields.length === 0,
    endpoint: "postgres:DatabaseMarketLatest+fiinquant:eod",
    httpStatus: null,
    latencyMs: Date.now() - startedAt,
    code: missingFields.length ? "database_v2_eod_partial" : undefined,
    message: fallbackError
      ? `FiinQuant fallback failed: ${fallbackError}`
      : missingFields.length
        ? "Database v2 EOD is still partial after controlled fallback."
        : undefined,
    retryable: missingFields.length > 0,
  };

  return data
    ? databaseOk("market.eod", "database", data, providerStatus, missingFields)
    : databaseError("market.eod", "database", providerStatus, missingFields.length ? missingFields : ["market.eod:data"]);
}

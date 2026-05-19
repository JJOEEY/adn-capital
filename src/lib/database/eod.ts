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

function formatBillion(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const billion = Math.abs(value) > 1_000_000_000 ? value / 1_000_000_000 : value;
  return `${Number(billion.toFixed(1)).toLocaleString("vi-VN")} tỷ`;
}

function formatPct(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function buildEodBriefFields(data: DnseEodMarketData): NonNullable<DnseEodMarketData["brief"]> {
  const vnindex = data.indices?.find((item) => item.ticker === "VNINDEX") ?? data.indices?.[0] ?? null;
  const liquidity = formatBillion(data.liquidity?.matchedValue);
  const foreignNet = formatBillion(data.foreignFlow?.netValue);
  const fallback = data.fallback?.fiinquant;
  const proprietary = fallback && (fallback.propTradingTopBuy.length || fallback.propTradingTopSell.length)
    ? `Tự doanh mua ròng: ${fallback.propTradingTopBuy.slice(0, 5).join(", ") || "không đáng kể"}. Bán ròng: ${fallback.propTradingTopSell.slice(0, 5).join(", ") || "không đáng kể"}.`
    : null;
  const retail = fallback && (fallback.individualTopBuy.length || fallback.individualTopSell.length)
    ? `Cá nhân mua ròng: ${fallback.individualTopBuy.slice(0, 5).join(", ") || "không đáng kể"}. Bán ròng: ${fallback.individualTopSell.slice(0, 5).join(", ") || "không đáng kể"}.`
    : null;
  const sessionSummary = vnindex?.value != null
    ? `VN-Index ghi nhận ${vnindex.value.toLocaleString("vi-VN")} điểm${formatPct(vnindex.changePct) ? ` (${formatPct(vnindex.changePct)})` : ""}.`
    : null;
  return {
    sessionSummary,
    liquidityDetail: liquidity ? `GTGD khớp lệnh toàn thị trường đạt khoảng ${liquidity}.` : null,
    foreignFlow: foreignNet ? `Khối ngoại ${data.foreignFlow?.netValue != null && data.foreignFlow.netValue >= 0 ? "mua ròng" : "bán ròng"} ${foreignNet}.` : null,
    notableTrades: [proprietary, retail].filter(Boolean).join(" | ") || null,
    outlook: "Ưu tiên kiểm soát tỷ trọng, theo dõi phản ứng dòng tiền ở nhóm dẫn dắt và tuân thủ điểm dừng lỗ.",
  };
}

function applyDerivedEodFields(data: DnseEodMarketData, missingFields: string[]) {
  const brief = buildEodBriefFields(data);
  const nextData = { ...data, brief };
  const hasBrief = Boolean(
    brief.sessionSummary &&
    brief.liquidityDetail &&
    (brief.foreignFlow || data.foreignFlow?.netValue != null) &&
    brief.outlook,
  );
  const nextMissing = missingFields.filter((field) => {
    if (field.includes("session_summary/liquidity_detail/foreign_flow/notable_trades/outlook")) return !hasBrief;
    return true;
  });
  return { data: nextData, missingFields: nextMissing };
}

export async function getDatabaseEodMarketDataset(options?: {
  symbols?: string[];
  tradingDate?: string;
  useFiinquantFallback?: boolean;
  fiinquantTimeoutMs?: number;
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
      const fiin = await fetchEodMarketData(tradingDate, { timeout: options?.fiinquantTimeoutMs ?? 45_000 });
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

  if (data) {
    const derived = applyDerivedEodFields(data, missingFields);
    data = derived.data;
    missingFields = derived.missingFields;
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

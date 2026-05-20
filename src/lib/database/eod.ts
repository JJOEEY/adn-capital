import type { DatabaseProviderStatus, DatabaseResult } from "@/lib/database/contracts";
import { databaseError, databaseOk } from "@/lib/database/contracts";
import { fetchEodMarketData } from "@/lib/fiinquantClient";
import { getDatabaseToolLatest } from "./tool-latest";
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

function needsFiinquantEnrichment(missingFields: string[]) {
  return missingFields.some((field) =>
    field.includes("requires-fiinquant-enrichment") ||
    field.includes("requires-fiinquant-fallback"),
  );
}

function isFiinquantEnrichmentField(field: string) {
  return (
    field.includes("requires-fiinquant-enrichment") ||
    field.includes("requires-fiinquant-fallback") ||
    field.toLowerCase().includes("fiinquant")
  );
}

function hasFiinquantEnrichmentData(data: NonNullable<DnseEodMarketData["enrichment"]>["fiinquant"]) {
  return Boolean(
    data &&
      (
        data.foreignTopBuy.length ||
        data.foreignTopSell.length ||
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
  const fiinquant = data.enrichment?.fiinquant ?? data.fallback?.fiinquant;
  const foreignFlowText = fiinquant?.foreignFlowText?.trim();
  const proprietary = fiinquant && (fiinquant.propTradingTopBuy.length || fiinquant.propTradingTopSell.length)
    ? `Tự doanh mua ròng: ${fiinquant.propTradingTopBuy.slice(0, 5).join(", ") || "không đáng kể"}. Bán ròng: ${fiinquant.propTradingTopSell.slice(0, 5).join(", ") || "không đáng kể"}.`
    : null;
  const retail = fiinquant && (fiinquant.individualTopBuy.length || fiinquant.individualTopSell.length)
    ? `Cá nhân mua ròng: ${fiinquant.individualTopBuy.slice(0, 5).join(", ") || "không đáng kể"}. Bán ròng: ${fiinquant.individualTopSell.slice(0, 5).join(", ") || "không đáng kể"}.`
    : null;
  const sessionSummary = vnindex?.value != null
    ? `VN-Index ghi nhận ${vnindex.value.toLocaleString("vi-VN")} điểm${formatPct(vnindex.changePct) ? ` (${formatPct(vnindex.changePct)})` : ""}.`
    : null;
  return {
    sessionSummary,
    liquidityDetail: liquidity ? `GTGD khớp lệnh toàn thị trường đạt khoảng ${liquidity}.` : null,
    foreignFlow: foreignFlowText || (foreignNet ? `Khối ngoại ${data.foreignFlow?.netValue != null && data.foreignFlow.netValue >= 0 ? "mua ròng" : "bán ròng"} ${foreignNet}.` : null),
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

export async function getCachedDatabaseEodMarketDataset(options?: {
  tradingDate?: string;
  maxAgeMs?: number;
}): Promise<DatabaseResult<DnseEodMarketData> | null> {
  const startedAt = Date.now();
  const record = await getDatabaseToolLatest<DnseEodMarketData>({
    tool: "eod",
    dataset: "market.eod",
    key: "latest",
    tradingDate: options?.tradingDate,
    maxAgeMs: options?.maxAgeMs ?? 48 * 60 * 60_000,
    ignoreExpires: true,
  });
  if (!record?.payload) return null;

  const missingFields = record.missingFields ?? [];
  return databaseOk(
    "market.eod",
    "database",
    record.payload,
    {
      provider: "database",
      ok: missingFields.length === 0,
      endpoint: "postgres:DatabaseToolLatest",
      latencyMs: Date.now() - startedAt,
      code: missingFields.length ? "database_v2_eod_cached_partial" : undefined,
      message: missingFields.length
        ? "Database v2 EOD cached dataset is partial."
        : undefined,
      retryable: missingFields.length > 0,
    },
    missingFields,
  );
}

export async function getDatabaseEodMarketDataset(options?: {
  symbols?: string[];
  tradingDate?: string;
  useFiinquantFallback?: boolean;
  useFiinquantEnrichment?: boolean;
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
  let enrichmentError: string | null = null;
  const shouldUseFiinquantEnrichment = options?.useFiinquantEnrichment ?? options?.useFiinquantFallback ?? true;

  if (data && shouldUseFiinquantEnrichment && needsFiinquantEnrichment(missingFields)) {
    try {
      const fiin = await fetchEodMarketData(tradingDate, { timeout: options?.fiinquantTimeoutMs ?? 45_000 });
      const fiinquantEnrichment: NonNullable<DnseEodMarketData["enrichment"]>["fiinquant"] = {
        foreignFlowText: fiin?.foreign_flow ?? null,
        foreignTopBuy: fiin?.foreign_top_buy ?? [],
        foreignTopSell: fiin?.foreign_top_sell ?? [],
        propTradingTopBuy: fiin?.prop_trading_top_buy ?? [],
        propTradingTopSell: fiin?.prop_trading_top_sell ?? [],
        individualTopBuy: fiin?.individual_top_buy ?? [],
        individualTopSell: fiin?.individual_top_sell ?? [],
        missingFields: fiin?.missingFields ?? [],
        retrievedAt: new Date().toISOString(),
      };
      data = {
        ...data,
        enrichment: {
          ...data.enrichment,
          fiinquant: fiinquantEnrichment,
        },
        fallback: {
          ...data.fallback,
          fiinquant: fiinquantEnrichment,
        },
      };
      if (hasFiinquantEnrichmentData(fiinquantEnrichment)) {
        missingFields = missingFields.filter((field) =>
          !field.includes("requires-fiinquant-enrichment") &&
          !field.includes("requires-fiinquant-fallback"),
        );
      }
    } catch (error) {
      enrichmentError = error instanceof Error ? error.message.slice(0, 180) : String(error).slice(0, 180);
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
    endpoint: "postgres:DatabaseMarketLatest+DatabaseMarketEvent+fiinquant:eod",
    httpStatus: null,
    latencyMs: Date.now() - startedAt,
    code: missingFields.length ? "database_v2_eod_partial" : undefined,
    message: enrichmentError
      ? `FiinQuant enrichment failed: ${enrichmentError}`
      : missingFields.length
        ? missingFields.every(isFiinquantEnrichmentField)
          ? "DNSE market data is ready; FiinQuant investor-flow enrichment is pending."
          : "Database v2 EOD is still partial after DNSE + FiinQuant merge."
        : undefined,
    retryable: missingFields.length > 0,
  };

  return data
    ? databaseOk("market.eod", "database", data, providerStatus, missingFields)
    : databaseError("market.eod", "database", providerStatus, missingFields.length ? missingFields : ["market.eod:data"]);
}

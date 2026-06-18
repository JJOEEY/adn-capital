import { fetchFAData } from "@/lib/stockData";
import { fetchBridgeTaSummary } from "@/lib/database/aiden/context";
import { upsertDatabaseToolLatest } from "@/lib/database/tool-latest";
import { getDatabaseRadarUniverse } from "@/lib/database/radar-realtime";

// Collector nạp FUNDAMENTAL + TECHNICAL per-ticker vào database-v2 (từ bridge FiinQuant),
// để getDatabaseAidenTickerContext đọc thẳng v2 thay vì fallback bridge mỗi lần.
// Ghi đúng 4 dataset mà context.ts đọc: fundamental.financials, fundamental.valuation,
// technical.indicators, technical.levels. Technical lấy từ ta-summary (support/resistance
// đúng thang, KHÔNG phải bollinger). tool="research", key=ticker (readToolRows lọc theo key+dataset).

const RESEARCH_TOOL = "research";
const RESEARCH_SOURCE = "fiinquant-bridge";
const DEFAULT_CONCURRENCY = 6;
const DEFAULT_UNIVERSE_LIMIT = 600;

export type ResearchCollectResult = {
  ok: boolean;
  tradingDate: string;
  universe: number;
  faStored: number;
  taStored: number;
  failed: number;
  errors: string[];
  startedAt: string;
  finishedAt: string;
};

function dateKeyInVietnam(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function errMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 80) : String(error).slice(0, 80);
}

async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let cursor = 0;
  const size = Math.max(1, Math.min(limit, items.length));
  const runners = Array.from({ length: size }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index]);
    }
  });
  await Promise.all(runners);
}

async function collectFundamental(ticker: string, tradingDate: string): Promise<boolean> {
  const fa = await fetchFAData(ticker);
  if (!fa) return false;
  const hasFinancial = fa.eps != null || fa.bookValuePerShare != null || fa.roe != null || fa.roa != null;
  const hasValuation = fa.pe != null || fa.pb != null;
  if (!hasFinancial && !hasValuation) return false;

  if (hasFinancial) {
    await upsertDatabaseToolLatest({
      tool: RESEARCH_TOOL,
      dataset: "fundamental.financials",
      key: ticker,
      tradingDate,
      source: RESEARCH_SOURCE,
      payload: {
        ticker,
        reportPeriod: fa.reportDate ?? null,
        reportDate: fa.reportDate ?? null,
        eps: fa.eps,
        bvps: fa.bookValuePerShare,
        roe: fa.roe,
        roa: fa.roa,
        revenueLastQ: fa.revenueLastQ,
        profitLastQ: fa.profitLastQ,
        revenueGrowthYoY: fa.revenueGrowthYoY,
        profitGrowthYoY: fa.profitGrowthYoY,
      },
    });
  }
  if (hasValuation) {
    await upsertDatabaseToolLatest({
      tool: RESEARCH_TOOL,
      dataset: "fundamental.valuation",
      key: ticker,
      tradingDate,
      source: RESEARCH_SOURCE,
      payload: { ticker, valuationDate: fa.reportDate ?? null, pe: fa.pe, pb: fa.pb },
    });
  }
  return true;
}

async function collectTechnical(ticker: string, tradingDate: string): Promise<boolean> {
  const summary = await fetchBridgeTaSummary(ticker);
  const technical = summary?.technical ?? null;
  if (!technical || !Object.values(technical).some((value) => value != null)) return false;

  await upsertDatabaseToolLatest({
    tool: RESEARCH_TOOL,
    dataset: "technical.indicators",
    key: ticker,
    tradingDate,
    source: RESEARCH_SOURCE,
    payload: {
      ticker,
      ma20: technical.ma20,
      ma50: technical.ma50,
      ma200: technical.ma200,
      rsi14: technical.rsi,
      macdHistogram: technical.macdHistogram,
      volumeMa20: technical.volumeMa20,
    },
  });
  if (technical.support != null || technical.resistance != null) {
    await upsertDatabaseToolLatest({
      tool: RESEARCH_TOOL,
      dataset: "technical.levels",
      key: ticker,
      tradingDate,
      source: RESEARCH_SOURCE,
      payload: { ticker, support: technical.support, resistance: technical.resistance },
    });
  }
  return true;
}

export async function collectDatabaseResearch(
  options: { tickers?: string[]; tradingDate?: string; concurrency?: number; limit?: number } = {},
): Promise<ResearchCollectResult> {
  const startedAt = new Date();
  const tradingDate = options.tradingDate ?? dateKeyInVietnam(startedAt);
  const universe = options.tickers?.length
    ? Array.from(new Set(options.tickers.map((item) => item.trim().toUpperCase()).filter(Boolean)))
    : await getDatabaseRadarUniverse(options.limit ?? DEFAULT_UNIVERSE_LIMIT);

  let faStored = 0;
  let taStored = 0;
  let failed = 0;
  const errors: string[] = [];

  await runWithConcurrency(universe, options.concurrency ?? DEFAULT_CONCURRENCY, async (ticker) => {
    let touched = false;
    try {
      if (await collectFundamental(ticker, tradingDate)) {
        faStored += 1;
        touched = true;
      }
    } catch (error) {
      errors.push(`fa:${ticker}:${errMessage(error)}`);
    }
    try {
      if (await collectTechnical(ticker, tradingDate)) {
        taStored += 1;
        touched = true;
      }
    } catch (error) {
      errors.push(`ta:${ticker}:${errMessage(error)}`);
    }
    if (!touched) failed += 1;
  });

  return {
    ok: faStored > 0 || taStored > 0,
    tradingDate,
    universe: universe.length,
    faStored,
    taStored,
    failed,
    errors: errors.slice(0, 50),
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
  };
}

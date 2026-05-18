import type { DatabaseResult } from "@/lib/database/contracts";
import {
  dnseMarketDocs,
  getDnseBoardDataset,
  getDnseEodMarketDataset,
  getDnseIndicesDataset,
  getDnseInstrumentsDataset,
  getDnseOhlcvDataset,
  getDnseRealtimeDataset,
  getDnseWebsocketStatusDataset,
} from "./client";
import type { DnseBoard, DnseEodMarketData, DnseIndexValue, DnseInstrument, DnseOhlcv, DnseRealtimeQuote, DnseWebsocketStatus } from "./types";

const SAMPLE_STOCKS = ["HPG", "FPT", "DGC"] as const;

export type DnseMarketHealth = {
  ok: boolean;
  status: "ok" | "blocked" | "degraded";
  generatedAt: string;
  docs: readonly string[];
  checks: {
    websocket: DatabaseResult<DnseWebsocketStatus>;
    instruments: DatabaseResult<DnseInstrument[]>;
    ohlcv: Record<string, DatabaseResult<DnseOhlcv>>;
    indices: DatabaseResult<DnseIndexValue[]>;
    eod: DatabaseResult<DnseEodMarketData>;
    realtime: DatabaseResult<DnseRealtimeQuote[]>;
    board: DatabaseResult<DnseBoard>;
  };
  blockers: string[];
  warnings: string[];
};

function collectResultIssues(result: DatabaseResult<unknown>, label: string, blockers: string[], warnings: string[]) {
  if (
    result.providerStatus.code === "dnse_ws_auth_failed" ||
    result.providerStatus.code === "dnse_credentials_missing" ||
    result.providerStatus.code === "dnse_auth_failed"
  ) {
    blockers.push(`${label}:${result.providerStatus.code}`);
    return;
  }
  if (result.providerStatus.code === "dnse_ws_dataset_not_available") {
    warnings.push(`${label}:${result.providerStatus.code}`);
    return;
  }
  if (!result.ok) warnings.push(`${label}:${result.missingFields.join(",") || result.providerStatus.code || "not_ok"}`);
}

export async function runDnseMarketHealth(): Promise<DnseMarketHealth> {
  const [websocket, realtime, board, eod] = await Promise.all([
    getDnseWebsocketStatusDataset([...SAMPLE_STOCKS], { timeoutMs: 6_000, maxMessages: 8 }),
    getDnseRealtimeDataset([...SAMPLE_STOCKS]),
    getDnseBoardDataset([...SAMPLE_STOCKS]),
    getDnseEodMarketDataset({ symbols: [...SAMPLE_STOCKS], timeoutMs: 6_000, maxMessages: 32 }),
  ]);
  const instruments = await getDnseInstrumentsDataset({ symbols: [...SAMPLE_STOCKS] });
  const indices = await getDnseIndicesDataset();
  const ohlcv = Object.fromEntries(
    await Promise.all(SAMPLE_STOCKS.map(async (ticker) => [ticker, await getDnseOhlcvDataset(ticker, { timeframe: "1d", days: 260 })])),
  );

  const blockers: string[] = [];
  const warnings: string[] = [];
  collectResultIssues(websocket as DatabaseResult<unknown>, "websocket", blockers, warnings);
  collectResultIssues(instruments as DatabaseResult<unknown>, "instruments", blockers, warnings);
  collectResultIssues(indices as DatabaseResult<unknown>, "indices", blockers, warnings);
  collectResultIssues(eod as DatabaseResult<unknown>, "eod", blockers, warnings);
  collectResultIssues(realtime as DatabaseResult<unknown>, "realtime", blockers, warnings);
  collectResultIssues(board as DatabaseResult<unknown>, "board", blockers, warnings);
  for (const [ticker, result] of Object.entries(ohlcv)) {
    collectResultIssues(result as DatabaseResult<unknown>, `ohlcv:${ticker}`, blockers, warnings);
  }

  const status = blockers.length ? "blocked" : warnings.length ? "degraded" : "ok";
  return {
    ok: status === "ok",
    status,
    generatedAt: new Date().toISOString(),
    docs: dnseMarketDocs,
    checks: { websocket, instruments, ohlcv, indices, eod, realtime, board },
    blockers,
    warnings,
  };
}

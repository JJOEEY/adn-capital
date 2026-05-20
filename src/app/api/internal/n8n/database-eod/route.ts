import { NextRequest, NextResponse } from "next/server";
import { collectDnseEodMarketToDatabase, getDatabaseEodMarketDataset } from "@/lib/database";
import { formatDatabaseEodTelegramText } from "@/lib/database/telegram-eod";
import {
  isN8nAuthorized,
  readJsonBody,
  readString,
  sendAdminTelegram,
  unauthorizedResponse,
  writeN8nLog,
} from "@/lib/n8n/internal";

export const dynamic = "force-dynamic";

type DatabaseEodBody = {
  dryRun?: unknown;
  sendTelegram?: unknown;
  chatId?: unknown;
  symbols?: unknown;
  collectFirst?: unknown;
  tradingDate?: unknown;
};

function readSymbols(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => readString(item).toUpperCase()).filter(Boolean);
  return readString(value)
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

export async function POST(req: NextRequest) {
  if (!isN8nAuthorized(req)) return unauthorizedResponse();

  const startedAt = Date.now();
  const parsed = await readJsonBody<DatabaseEodBody>(req);
  if (!parsed.ok) return parsed.response;

  const dryRun = parsed.data.dryRun !== false && readString(parsed.data.dryRun).toLowerCase() !== "false";
  const sendTelegram = parsed.data.sendTelegram === true || readString(parsed.data.sendTelegram).toLowerCase() === "true";
  const collectFirst = parsed.data.collectFirst === true || readString(parsed.data.collectFirst).toLowerCase() === "true";
  const chatId = readString(parsed.data.chatId);
  const symbols = readSymbols(parsed.data.symbols);
  const tradingDate = readString(parsed.data.tradingDate) || undefined;

  const collectResult = collectFirst
    ? await collectDnseEodMarketToDatabase({
        symbols: symbols.length ? symbols : undefined,
        tradingDate,
        timeoutMs: 12_000,
        maxMessages: 96,
      })
    : null;
  const eod = await getDatabaseEodMarketDataset({
    symbols: symbols.length ? symbols : undefined,
    tradingDate,
    useFiinquantEnrichment: true,
  });
  const text = formatDatabaseEodTelegramText(eod);
  const telegram = sendTelegram
    ? await sendAdminTelegram(text, {
        chatId: chatId || undefined,
        dryRun,
        dedupeKey: `telegram:database-v2:eod:${eod.retrievedAt.slice(0, 10)}`,
      })
    : { ok: true, skipped: true, reason: "sendTelegram_false" };

  await writeN8nLog(
    "n8n:database-eod",
    telegram.ok === false ? "error" : "success",
    dryRun ? "database_eod_telegram_dry_run" : "database_eod_telegram",
    {
      dataset: eod.dataset,
      source: eod.source,
      ok: eod.ok,
      providerCode: eod.providerStatus.code ?? null,
      missingFields: eod.missingFields,
      collectFirst,
      collected: collectResult
        ? {
            ok: collectResult.ok,
            receivedMessages: collectResult.receivedMessages,
            storedEvents: collectResult.storedEvents,
            updatedLatest: collectResult.updatedLatest,
          }
        : null,
      sentTelegram: sendTelegram && !dryRun,
    },
    startedAt,
  ).catch(() => undefined);

  return NextResponse.json({
    ok: telegram.ok !== false,
    dryRun,
    source: "database_v2",
    dataset: eod.dataset,
    collectResult,
    providerStatus: eod.providerStatus,
    missingFields: eod.missingFields,
    telegram,
    textPreview: text,
  });
}

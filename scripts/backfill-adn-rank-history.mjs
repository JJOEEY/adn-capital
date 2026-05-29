import { existsSync, readFileSync } from "node:fs";

const INITIAL_ENV_KEYS = new Set(Object.keys(process.env));

function loadEnvFile(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && !INITIAL_ENV_KEYS.has(key)) process.env[key] = value;
  }
}

for (const file of [".env", ".env.local", ".env.production", ".env.production.local"]) loadEnvFile(file);

function parseArgs(argv) {
  const args = {};
  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;
    const [key, value] = raw.slice(2).split("=");
    args[key] = value ?? "1";
  }
  return args;
}

function dateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function assertDateKey(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))) {
    throw new Error(`invalid_${label}_date`);
  }
  return String(value);
}

function listWeekdays(from, to) {
  const rows = [];
  const cursor = new Date(`${from}T00:00:00+07:00`);
  const end = new Date(`${to}T00:00:00+07:00`);
  while (cursor.getTime() <= end.getTime()) {
    const weekday = cursor.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh", weekday: "short" });
    if (weekday !== "Sat" && weekday !== "Sun") rows.push(dateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return rows;
}

function readNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readRows(payload) {
  if (!payload || typeof payload !== "object") return [];
  for (const key of ["stocks", "data", "items", "results"]) {
    const rows = payload[key];
    if (Array.isArray(rows)) return rows;
  }
  return [];
}

async function getPrisma() {
  const { PrismaClient } = await import("@prisma/client");
  return new PrismaClient();
}

async function existingRecord(prisma, tradingDate) {
  return prisma.databaseToolLatest.findUnique({
    where: {
      tool_dataset_key_tradingDate: {
        tool: "rank",
        dataset: "rank.rs",
        key: "latest",
        tradingDate,
      },
    },
    select: { id: true, missingFields: true, updatedAt: true },
  });
}

async function upsertRank(prisma, tradingDate, payload, missingFields, providerStatus) {
  const now = new Date();
  await prisma.databaseToolLatest.upsert({
    where: {
      tool_dataset_key_tradingDate: {
        tool: "rank",
        dataset: "rank.rs",
        key: "latest",
        tradingDate,
      },
    },
    create: {
      tool: "rank",
      dataset: "rank.rs",
      key: "latest",
      tradingDate,
      source: "fiinquant_bridge_backfill",
      payload,
      missingFields,
      providerStatus,
      computedAt: now,
      expiresAt: null,
    },
    update: {
      source: "fiinquant_bridge_backfill",
      payload,
      missingFields,
      providerStatus,
      computedAt: now,
      expiresAt: null,
    },
  });
}

async function fetchRank(baseUrl, tradingDate, timeoutMs) {
  const url = new URL("/api/rs-rating", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  url.searchParams.set("date", tradingDate);
  url.searchParams.set("force", "1");
  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`http_${res.status}:${text.slice(0, 180)}`);
  }
  return JSON.parse(text);
}

const args = parseArgs(process.argv.slice(2));
const from = assertDateKey(args.from ?? process.env.ADN_RANK_BACKFILL_FROM ?? "2026-04-01", "from");
const to = assertDateKey(args.to ?? process.env.ADN_RANK_BACKFILL_TO ?? dateKey(), "to");
const dryRun = args["dry-run"] === "1" || process.env.DRY_RUN === "1";
const skipExisting = args["skip-existing"] === "1" || process.env.SKIP_EXISTING === "1";
const allowPartial = args["allow-partial"] === "1" || process.env.ALLOW_PARTIAL === "1";
const minTickerCount = readNumber(args["min-ticker-count"] ?? process.env.ADN_RANK_BACKFILL_MIN_TICKERS, 50);
const partialMinTickerCount = readNumber(args["partial-min-ticker-count"] ?? process.env.ADN_RANK_BACKFILL_PARTIAL_MIN_TICKERS, 20);
const timeoutMs = readNumber(args.timeoutMs ?? process.env.ADN_RANK_BACKFILL_TIMEOUT_MS, 120_000);
const baseUrl = (args.baseUrl ?? process.env.ADN_INTERNAL_BASE_URL ?? process.env.ADN_WEB_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const dates = listWeekdays(from, to);
const prisma = dryRun && !skipExisting ? null : await getPrisma();

const summary = {
  from,
  to,
  dryRun,
  skipExisting,
  allowPartial,
  minTickerCount,
  partialMinTickerCount,
  baseUrl,
  totalDates: dates.length,
  written: 0,
  skipped: 0,
  partial: 0,
  failed: 0,
  rows: [],
};

try {
  for (const tradingDate of dates) {
    if (skipExisting && prisma) {
      const existing = await existingRecord(prisma, tradingDate);
      if (existing && existing.missingFields.length === 0) {
        summary.skipped += 1;
        summary.rows.push({ tradingDate, status: "skipped_existing" });
        continue;
      }
    }

    try {
      const payload = await fetchRank(baseUrl, tradingDate, timeoutMs);
      const rows = readRows(payload);
      const count = rows.length;
      if (count < partialMinTickerCount) {
        summary.skipped += 1;
        summary.rows.push({ tradingDate, status: "skipped_empty_or_too_small", count });
        continue;
      }

      const isPartial = count < minTickerCount;
      if (isPartial && !allowPartial) {
        summary.skipped += 1;
        summary.rows.push({ tradingDate, status: "skipped_partial", count, minTickerCount });
        continue;
      }

      const payloadWithQuality = {
        ...payload,
        asOfDate: payload.asOfDate ?? payload.tradingDate ?? tradingDate,
        quality: isPartial ? "partial" : "ok",
        backfilledAt: new Date().toISOString(),
      };
      const missingFields = isPartial ? ["rank.rs.partial"] : [];
      const providerStatus = {
        provider: "fiinquant_bridge",
        mode: "historical_backfill",
        ok: !isPartial,
        code: isPartial ? "partial_ticker_count" : "ok",
        count,
        minTickerCount,
      };

      if (!dryRun && prisma) {
        await upsertRank(prisma, tradingDate, payloadWithQuality, missingFields, providerStatus);
      }
      summary.written += dryRun ? 0 : 1;
      summary.partial += isPartial ? 1 : 0;
      summary.rows.push({ tradingDate, status: dryRun ? "dry_run_ok" : "written", count, quality: payloadWithQuality.quality });
    } catch (error) {
      summary.failed += 1;
      summary.rows.push({
        tradingDate,
        status: "failed",
        error: error instanceof Error ? error.message.slice(0, 220) : String(error).slice(0, 220),
      });
    }
  }
} finally {
  if (prisma) await prisma.$disconnect();
}

console.log(JSON.stringify(summary, null, 2));
if (summary.failed > 0 && process.env.STRICT === "1") process.exit(1);

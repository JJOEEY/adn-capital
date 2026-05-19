/**
 * API Cron Dispatcher — Smart Scheduler v2
 *
 * Smart Cron Schedule (VN Market Hours):
 * - Chỉ quét tại 4 mốc cố định để bảo toàn quota FiinQuant:
 *   10:00, 10:30, 14:00, 14:25
 *
 * Endpoints:
 * - GET /api/cron?type=prop_trading     → 19:00 T2-T6
 * - GET /api/cron?type=market_stats     → 10:00/11:30/14:00/14:45
 * - GET /api/cron?type=signal_scan_5m   → fixed-slot gate
 */
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { generateText } from "@/lib/gemini";
import {
  validateCronSecret,
  logCron,
  pushNotification,
  saveMarketReport,
  isTradingDay,
  getVNDateString,
  getVNDateISO,
  getSignalWindowInfo,
  findMarketReportForVNDate,
} from "@/lib/cronHelpers";
import {
  getMarketSnapshot,
  formatSnapshotForAI,
  getInvestorTradingText,
  getInvestorTradingData,
  getPropTradingData,
} from "@/lib/marketDataFetcher";
import { fetchEodMarketData, type FiinEodNews } from "@/lib/fiinquantClient";
import { fetchAllCafefNews, buildCafefContext } from "@/lib/cafefScraper";
import { getVnDateLabel, getVnNow } from "@/lib/time";
import { getTopicEnvelope, invalidateTopics } from "@/lib/datahub/core";
import {
  collectDatabaseRadarRealtime,
  collectDatabaseNews,
  collectDnseEodMarketToDatabase,
  getDatabaseRealtimeHealth,
  getDatabaseV2Readiness,
  getDatabaseEodMarketDataset,
  getDatabaseMorningBrief,
  getDatabaseAidenContext,
  isDatabaseV2RadarRealtimeEnabled,
  upsertDatabaseToolLatest,
} from "@/lib/database";
import { formatDatabaseMorningBriefText } from "@/lib/database/morning-brief";
import { getDatabaseMorningReadiness } from "@/lib/database/morning-readiness";
import { formatDatabaseEodPublicBriefText } from "@/lib/database/telegram-eod";
import { getMarketPayloadRows, readMarketNumber } from "@/lib/market-price-normalization";
import { CANONICAL_CRON_TYPES, normalizeCronType, LEGACY_CRON_ALIASES, type CanonicalCronType } from "@/lib/cron-contracts";
import { getPythonBridgeUrl } from "@/lib/runtime-config";
import { emitWorkflowTrigger } from "@/lib/workflows";
import { emitObservabilityEvent } from "@/lib/observability";
import { ingestSignalScanBatch } from "@/lib/signals/ingest";
import { chooseRadarScanMode, RADAR_SCAN_BUDGET, SIGNAL_SCAN_SLOT_SET } from "@/lib/signals/radar-scan-config";
import { calculateRPI, getLatestRPI, type OHLCVData } from "@/lib/rpi/calculator";
import { runDnseMarketDataCoverageCheck } from "@/lib/providers/dnse/market-data";
import {
  sendActiveSignalsToTelegram,
  sendClaimedSignalsToTelegram,
} from "@/lib/signals/telegram-notify";

export const maxDuration = 600;
export const dynamic = "force-dynamic";

const PYTHON_BRIDGE = getPythonBridgeUrl();
const SIGNAL_SCAN_TIMEOUT_MS = 600_000;
const MARKET_OVERVIEW_CACHE_FILE = path.join(process.cwd(), "market_cache.json");
const EOD_FULL_MINUTE_VN = 19 * 60;
const ADN_RANK_REFRESH_MINUTE_VN = 15 * 60;
const ART_DAILY_REFRESH_MINUTE_VN = 19 * 60 + 5;
const ADN_RANK_TOPIC_KEYS = ["research:rs-rating:list", "market:rs:latest", "scan:rs-rating:list"] as const;
const SMARTFLOW_TOPIC_KEY = "pulse:smartflow";
const ART_DAILY_TOPIC_KEY = "vn:historical:VN30:1d";
const DATABASE_RADAR_TOPIC_KEYS = ["signal:market:radar", "radar:watchlist:active", "radar:prefilter:latest"] as const;
const DATABASE_ADNCORE_TOPIC_KEYS = ["market:canonical:latest", "vn:index:overview", "vn:index:snapshot", SMARTFLOW_TOPIC_KEY] as const;
const DATABASE_V2_REPLACES_V1 = process.env.DATABASE_V2_REPLACE_V1 !== "false";

function previousVnTradingDateKey() {
  let value = getVnNow().subtract(1, "day");
  while (value.day() === 0 || value.day() === 6) {
    value = value.subtract(1, "day");
  }
  return value.format("YYYY-MM-DD");
}

function databaseEodReadDateKey() {
  const now = getVnNow();
  const minute = now.hour() * 60 + now.minute();
  return minute >= EOD_FULL_MINUTE_VN ? now.format("YYYY-MM-DD") : previousVnTradingDateKey();
}

interface RadarQuotaEstimate {
  monthlyUsed: number;
  monthlyUsedPct: number;
}

function readRadarQuotaCost(resultData: string | null): number {
  if (!resultData) return 0;
  try {
    const parsed = JSON.parse(resultData) as {
      radarQuota?: { estimatedCost?: unknown };
      radarScan?: { estimatedQuotaCost?: unknown };
    };
    const value = parsed.radarQuota?.estimatedCost ?? parsed.radarScan?.estimatedQuotaCost;
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

async function getRadarMonthlyQuotaEstimate(): Promise<RadarQuotaEstimate> {
  const monthStart = getVnNow().startOf("month").toDate();
  const rows = await prisma.cronLog.findMany({
    where: {
      cronName: "signal_scan_type1",
      createdAt: { gte: monthStart },
    },
    select: { resultData: true },
    take: 500,
    orderBy: { createdAt: "desc" },
  });
  const monthlyUsed = rows.reduce((sum, row) => sum + readRadarQuotaCost(row.resultData), 0);
  return {
    monthlyUsed,
    monthlyUsedPct: RADAR_SCAN_BUDGET.monthlyQuota > 0 ? (monthlyUsed / RADAR_SCAN_BUDGET.monthlyQuota) * 100 : 0,
  };
}

function getVnMinuteOfDay(): number {
  const now = getVnNow();
  return now.hour() * 60 + now.minute();
}

function toDateKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const viMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!viMatch) return null;
  const [, day, month, year] = viMatch;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function saveMarketOverviewCache(overview: unknown) {
  if (!overview || typeof overview !== "object") return;
  try {
    fs.writeFileSync(
      MARKET_OVERVIEW_CACHE_FILE,
      JSON.stringify(
        {
          ...(overview as Record<string, unknown>),
          last_updated: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error("[cron:eod_full_19h] Failed to save ADNCore cache:", error);
  }
}

function buildInternalCronRequest(url: string): NextRequest {
  const headers = new Headers();
  headers.set("x-cron-secret", process.env.CRON_SECRET ?? "adn-cron-dev-key");
  return new NextRequest(url, { headers });
}

async function runCronHandlerWithWorkflowHook(
  cronType: string,
  handler: () => Promise<NextResponse>,
  source: string,
) {
  try {
    const response = await handler();
    const status = response.status < 400 ? "success" : "error";
    await emitWorkflowTrigger({
      type: "cron",
      source,
      payload: {
        cronType,
        status,
        httpStatus: response.status,
      },
    });
    return response;
  } catch (error) {
    await emitWorkflowTrigger({
      type: "cron",
      source,
      payload: {
        cronType,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}

async function handleMorningBrief(forceRun = false): Promise<NextResponse> {
  if (DATABASE_V2_REPLACES_V1) {
    return handleDatabaseMorningPublish(forceRun);
  }
  const mod = await import("@/app/api/cron/morning-report/route");
  const url = new URL("http://localhost/api/cron/morning-report");
  if (forceRun) url.searchParams.set("force", "1");
  return mod.GET(buildInternalCronRequest(url.toString()));
}

async function handleCloseBrief15(forceRun = false): Promise<NextResponse> {
  const mod = await import("@/app/api/cron/afternoon-review/route");
  const url = new URL("http://localhost/api/cron/afternoon-review");
  if (forceRun) url.searchParams.set("force", "1");
  return mod.GET(buildInternalCronRequest(url.toString()));
}

async function handleNewsCrawler(): Promise<NextResponse> {
  const startTime = Date.now();
  try {
    const mod = await import("@/app/api/crawler/run/route");
    const headers = new Headers();
    headers.set("x-cron-secret", process.env.CRON_SECRET ?? "adn-cron-dev-key");
    const response = await mod.POST(
      new Request("http://localhost/api/crawler/run", {
        method: "POST",
        headers,
      }),
    );
    const payload = await response.json().catch(() => ({}));
    const duration = Date.now() - startTime;
    await logCron(
      "news_crawler",
      response.ok ? "success" : "error",
      response.ok ? "News crawler completed" : "News crawler failed",
      duration,
      payload,
    );
    if (response.ok) {
      invalidateTopics({ tags: ["news", "articles", "dashboard"] });
    }
    return NextResponse.json({ type: "news_crawler", ...payload }, { status: response.status });
  } catch (error) {
    const duration = Date.now() - startTime;
    await logCron("news_crawler", "error", String(error), duration);
    return NextResponse.json({ error: "Lỗi cập nhật tin tức" }, { status: 500 });
  }
}

async function handleDatabaseMorningPublish(forceRun = false): Promise<NextResponse> {
  const startTime = Date.now();
  const today = getVNDateString();
  try {
    const existingReport = forceRun
      ? null
      : await findMarketReportForVNDate("morning_brief", undefined, { notBeforeMinuteVN: 8 * 60 });
    if (existingReport) {
      const duration = Date.now() - startTime;
      await logCron("morning_brief", "skipped", "Database v2 morning already generated for today", duration, {
        existingReportId: existingReport.id,
        source: "database_v2",
      });
      return NextResponse.json({
        type: "morning_brief",
        source: "database_v2",
        skipped: true,
        reason: "already_generated_today",
        reportId: existingReport.id,
        report: existingReport.content,
      });
    }

    const collect = await collectDatabaseNews();
    const brief = await getDatabaseMorningBrief({ previousTradingDate: databaseEodReadDateKey() });
    if (!brief.data || !brief.ok) {
      const duration = Date.now() - startTime;
      await logCron("morning_brief", "skipped", "Database v2 morning missing required fields", duration, {
        source: "database_v2",
        newsCollect: summarizeDatabasePayload(collect),
        missingFields: brief.missingFields,
        providerStatus: brief.providerStatus,
      });
      return NextResponse.json({
        type: "morning_brief",
        source: "database_v2",
        published: false,
        reason: "database_v2_missing_required_fields",
        missingFields: brief.missingFields,
      }, { status: 207 });
    }

    const safeReport = formatDatabaseMorningBriefText(brief.data);
    const title = `Bản tin sáng ${today}`;
    const savedReport = await saveMarketReport(
      "morning_brief",
      title,
      safeReport,
      { source: "database_v2", brief, newsCollect: collect },
      { source: "database_v2", missingFields: brief.missingFields, metadata: brief.data.metadata },
    );
    await pushNotification("morning_brief", `☀️ ${title}`, safeReport);
    invalidateTopics({ tags: ["news", "brief", "dashboard", "market"] });
    await emitWorkflowTrigger({
      type: "brief_ready",
      source: "cron:morning_brief:database_v2",
      payload: {
        reportType: "morning_brief",
        title,
        content: safeReport,
        dateLabel: today,
        source: "database_v2",
      },
    });

    const duration = Date.now() - startTime;
    await logCron("morning_brief", "success", `Database v2 morning published in ${duration}ms`, duration, {
      source: "database_v2",
      reportId: savedReport?.id ?? null,
      newsCollect: summarizeDatabasePayload(collect),
      missingFields: brief.missingFields,
      metadata: brief.data.metadata,
    });
    return NextResponse.json({
      type: "morning_brief",
      source: "database_v2",
      published: true,
      reportId: savedReport?.id ?? null,
      report: safeReport,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    await logCron("morning_brief", "error", error instanceof Error ? error.message : String(error), duration, {
      source: "database_v2",
    });
    return NextResponse.json({ error: "Database v2 morning publish failed" }, { status: 500 });
  }
}

function hasDatabaseEodRequiredFields(result: Awaited<ReturnType<typeof getDatabaseEodMarketDataset>>) {
  const data = result.data;
  const hasVnindex = Boolean(data?.indices?.some((item) => item.ticker === "VNINDEX" && item.value != null));
  const hasLiquidity = data?.liquidity?.matchedValue != null;
  const hasBreadth = data?.breadth?.up != null && data?.breadth?.down != null;
  const hasForeign = data?.foreignFlow?.netValue != null;
  const fallback = data?.fallback?.fiinquant;
  const hasInvestorFallback = Boolean(
    fallback &&
      (
        fallback.propTradingTopBuy.length ||
        fallback.propTradingTopSell.length ||
        fallback.individualTopBuy.length ||
        fallback.individualTopSell.length
      ),
  );
  return hasVnindex && hasLiquidity && hasBreadth && hasForeign && hasInvestorFallback;
}

async function handleDatabaseEodPublish(forceRun: boolean, dateISO: string, today: string): Promise<NextResponse> {
  const startTime = Date.now();
  try {
    if (!forceRun && getVnMinuteOfDay() < EOD_FULL_MINUTE_VN) {
      const duration = Date.now() - startTime;
      await logCron("eod_full_19h", "skipped", "Database v2 EOD skipped before 19:00 VN", duration, {
        source: "database_v2",
        nextSlot: "19:00",
      });
      return NextResponse.json({
        type: "eod_full_19h",
        source: "database_v2",
        skipped: true,
        reason: "before_scheduled_slot",
        nextSlot: "19:00",
      });
    }

    const existingReport = forceRun
      ? null
      : await findMarketReportForVNDate("eod_full_19h", dateISO, { notBeforeMinuteVN: 19 * 60 });
    if (existingReport) {
      const duration = Date.now() - startTime;
      await logCron("eod_full_19h", "skipped", "Database v2 EOD already generated for today", duration, {
        source: "database_v2",
        existingReportId: existingReport.id,
      });
      return NextResponse.json({
        type: "eod_full_19h",
        source: "database_v2",
        skipped: true,
        reason: "already_generated_today",
        reportId: existingReport.id,
        report: existingReport.content,
      });
    }

    const eod = await getDatabaseEodMarketDataset({
      tradingDate: dateISO,
      useFiinquantFallback: true,
      fiinquantTimeoutMs: 180_000,
    });
    if (!eod.data || !hasDatabaseEodRequiredFields(eod)) {
      const duration = Date.now() - startTime;
      const retryWindow = !forceRun && getVnMinuteOfDay() <= 20 * 60;
      await logCron("eod_full_19h", "skipped", retryWindow ? "Database v2 EOD waiting for complete data" : "Database v2 EOD missing required fields", duration, {
        source: "database_v2",
        missingFields: eod.missingFields,
        providerStatus: eod.providerStatus,
      });
      return NextResponse.json({
        type: "eod_full_19h",
        source: "database_v2",
        published: false,
        reason: retryWindow ? "skipped_waiting_data" : "database_v2_missing_required_fields",
        missingFields: eod.missingFields,
        providerStatus: eod.providerStatus,
      }, { status: 207 });
    }

    const safeReport = formatDatabaseEodPublicBriefText(eod, today);
    const title = `Bản tin tổng hợp 19:00 ${today}`;
    const savedReport = await saveMarketReport(
      "eod_full_19h",
      title,
      safeReport,
      { source: "database_v2", eod },
      { source: "database_v2", missingFields: eod.missingFields, providerStatus: eod.providerStatus },
    );
    await pushNotification("eod_full_19h", `🌙 ${title}`, safeReport);
    invalidateTopics({ tags: ["news", "brief", "market", "dashboard"] });
    await emitWorkflowTrigger({
      type: "brief_ready",
      source: "cron:eod_full_19h:database_v2",
      payload: {
        reportType: "eod_full_19h",
        title,
        content: safeReport,
        dateLabel: today,
        source: "database_v2",
      },
    });

    const duration = Date.now() - startTime;
    await logCron("eod_full_19h", "success", `Database v2 EOD published in ${duration}ms`, duration, {
      source: "database_v2",
      reportId: savedReport?.id ?? null,
      providerStatus: eod.providerStatus,
      missingFields: eod.missingFields,
    });
    return NextResponse.json({
      type: "eod_full_19h",
      source: "database_v2",
      published: true,
      reportId: savedReport?.id ?? null,
      report: safeReport,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    await logCron("eod_full_19h", "error", error instanceof Error ? error.message : String(error), duration, {
      source: "database_v2",
    });
    return NextResponse.json({ error: "Database v2 EOD publish failed" }, { status: 500 });
  }
}

const DATABASE_V2_CRON_TYPES = new Set<CanonicalCronType>([
  "database_news_collect",
  "database_dnse_market_collect",
  "database_morning_readiness",
  "database_morning_brief",
  "database_eod_collect",
  "database_eod_readiness",
  "database_radar_realtime_collect",
  "database_realtime_health",
  "database_adn_radar_collect",
  "database_adn_radar_readiness",
  "database_adn_art_collect",
  "database_adn_art_readiness",
  "database_adncore_collect",
  "database_adncore_readiness",
  "database_adn_rank_collect",
  "database_adn_rank_readiness",
  "database_aiden_context_collect",
]);

function isDatabaseV2CronType(type: CanonicalCronType) {
  return DATABASE_V2_CRON_TYPES.has(type);
}

async function persistDatabaseToolCronPayload(params: {
  tool: string;
  dataset: string;
  payload: unknown;
  missingFields?: string[];
  providerStatus?: unknown;
  ttlMs?: number;
  tradingDate?: string;
}) {
  return upsertDatabaseToolLatest({
    tool: params.tool,
    dataset: params.dataset,
    key: "latest",
    payload: params.payload,
    tradingDate: params.tradingDate,
    missingFields: params.missingFields ?? [],
    providerStatus: params.providerStatus,
    ttlMs: params.ttlMs,
  }).catch((error) => {
    console.warn("[database-v2] failed to persist tool latest:", error);
    return null;
  });
}

function summarizeDatabasePayload(value: unknown) {
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  return {
    ok: record.ok,
    status: record.status,
    dataset: record.dataset,
    source: record.source,
    missingFields: Array.isArray(record.missingFields) ? record.missingFields.slice(0, 20) : record.missingFields,
    providerStatus: record.providerStatus,
    checkedAt: record.checkedAt,
    topics: record.topics,
    rows: record.rows,
    historyPoints: record.historyPoints,
    latest: record.latest,
    coverage: record.coverage,
    cache: record.cache,
    radar: record.radar,
    retrievedAt: record.retrievedAt,
    collectedAt: record.collectedAt,
    fetched: record.fetched,
    stored: record.stored,
    bySource: record.bySource,
    byCategory: record.byCategory,
    tradingDate: record.tradingDate,
    previousTradingDate: record.previousTradingDate,
    publishAllowed: record.publishAllowed,
    checks: record.checks,
    metadata: (record.data as { metadata?: unknown } | undefined)?.metadata,
  };
}

function countPayloadItems(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (!value || typeof value !== "object") return value ? 1 : 0;
  const record = value as Record<string, unknown>;
  return Object.values(record).reduce<number>((total, item) => {
    if (Array.isArray(item)) return total + item.length;
    if (item && typeof item === "object") return total + countPayloadItems(item);
    return total;
  }, 0);
}

async function collectDatahubTopicsForDatabaseV2(topicKeys: readonly string[], options?: { force?: boolean }) {
  const topics = await Promise.all(
    topicKeys.map(async (topic) => {
      const envelope = await getTopicEnvelope(topic, {
        force: options?.force === true,
        systemRole: "cron",
      });
      return {
        topic,
        freshness: envelope.freshness,
        updatedAt: envelope.updatedAt,
        error: envelope.error ? { code: envelope.error.code, message: envelope.error.message } : null,
        count: countPayloadItems(envelope.value),
      };
    }),
  );
  const missingFields = topics
    .filter((item) => item.freshness === "error" || item.count === 0)
    .map((item) => item.topic);
  return {
    ok: missingFields.length === 0,
    topics,
    missingFields,
    checkedAt: new Date().toISOString(),
  };
}

async function collectDatabaseArtPayload(force: boolean) {
  const envelope = await getTopicEnvelope(ART_DAILY_TOPIC_KEY, {
    force,
    systemRole: "cron",
  });
  const rows = toArtOhlcvRows(envelope.value);
  const history = calculateRPI(rows);
  const latest = getLatestRPI(history);
  const missingFields = [
    envelope.freshness === "error" ? ART_DAILY_TOPIC_KEY : null,
    rows.length === 0 ? "adn_art.ohlcv" : null,
    !latest ? "adn_art.rpi" : null,
  ].filter((item): item is string => Boolean(item));

  return {
    ok: missingFields.length === 0,
    topic: ART_DAILY_TOPIC_KEY,
    freshness: envelope.freshness,
    updatedAt: envelope.updatedAt,
    rows: rows.length,
    historyPoints: history.filter((row) => row.rpi !== null).length,
    latest,
    missingFields,
    checkedAt: new Date().toISOString(),
  };
}

async function handleDatabaseV2Cron(type: CanonicalCronType, forceRun = false): Promise<NextResponse> {
  const startTime = Date.now();
  try {
    if (type === "database_news_collect") {
      const result = await collectDatabaseNews();
      const duration = Date.now() - startTime;
      await logCron(
        type,
        result.ok ? "success" : "error",
        result.ok ? `Database v2 news collected ${result.stored} rows` : "Database v2 news collect failed",
        duration,
        summarizeDatabasePayload(result),
      );
      return NextResponse.json({ type, ...result }, { status: result.ok ? 200 : 502 });
    }

    if (type === "database_dnse_market_collect") {
      if (!forceRun && !isTradingDay()) {
        const duration = Date.now() - startTime;
        await logCron(type, "skipped", "Database v2 DNSE market collect skipped on non-trading day", duration);
        return NextResponse.json({ type, skipped: true, reason: "non_trading_day" });
      }
      const result = await collectDnseEodMarketToDatabase({
        timeoutMs: forceRun ? 30_000 : 15_000,
        maxMessages: forceRun ? 160 : 96,
      });
      const duration = Date.now() - startTime;
      await logCron(
        type,
        result.ok ? "success" : "error",
        result.ok ? `Database v2 DNSE market stored ${result.updatedLatest} latest rows` : "Database v2 DNSE market collect failed",
        duration,
        summarizeDatabasePayload(result),
      );
      return NextResponse.json({ type, ...result }, { status: result.ok ? 200 : 502 });
    }

    if (type === "database_morning_readiness") {
      const result = await getDatabaseMorningReadiness();
      const duration = Date.now() - startTime;
      await logCron(
        type,
        result.ok ? "success" : "skipped",
        result.ok ? "Database v2 morning readiness passed" : "Database v2 morning readiness is partial",
        duration,
        summarizeDatabasePayload(result),
      );
      return NextResponse.json({ type, ...result }, { status: result.ok ? 200 : 207 });
    }

    if (type === "database_morning_brief") {
      const result = await getDatabaseMorningBrief({ previousTradingDate: databaseEodReadDateKey() });
      await persistDatabaseToolCronPayload({
        tool: "brief",
        dataset: "brief.morning",
        payload: result.data,
        missingFields: result.missingFields,
        providerStatus: result.providerStatus,
        ttlMs: 24 * 60 * 60_000,
      });
      const duration = Date.now() - startTime;
      await logCron(
        type,
        result.ok ? "success" : "skipped",
        result.ok ? "Database v2 morning brief built" : "Database v2 morning brief built with missing fields",
        duration,
        summarizeDatabasePayload(result),
      );
      return NextResponse.json({ type, ...result }, { status: result.ok ? 200 : 207 });
    }

    if (type === "database_radar_realtime_collect") {
      if (!isDatabaseV2RadarRealtimeEnabled()) {
        const duration = Date.now() - startTime;
        await logCron(type, "skipped", "Database v2 Radar realtime disabled by feature flag", duration);
        return NextResponse.json({ type, skipped: true, reason: "disabled" });
      }
      if (!forceRun && !isTradingDay()) {
        const duration = Date.now() - startTime;
        await logCron(type, "skipped", "Database v2 Radar realtime skipped on non-trading day", duration);
        return NextResponse.json({ type, skipped: true, reason: "non_trading_day" });
      }
      const result = await collectDatabaseRadarRealtime({
        timeoutMs: forceRun ? 50_000 : 45_000,
        maxMessages: forceRun ? 2_500 : 1_800,
      });
      const duration = Date.now() - startTime;
      await logCron(
        type,
        result.ok ? "success" : "skipped",
        result.ok
          ? `Database v2 Radar realtime covered ${result.data?.coverage.covered ?? 0}/${result.data?.coverage.requested ?? 0}`
          : "Database v2 Radar realtime is partial",
        duration,
        summarizeDatabasePayload(result),
      );
      invalidateTopics({ tags: ["signal", "radar"] });
      return NextResponse.json({ type, ...result }, { status: result.ok ? 200 : 207 });
    }

    if (type === "database_realtime_health") {
      const result = await getDatabaseRealtimeHealth();
      const readiness = await getDatabaseV2Readiness().catch(() => null);
      const duration = Date.now() - startTime;
      await logCron(
        type,
        result.ok ? "success" : "skipped",
        result.ok ? "Database v2 realtime health passed" : "Database v2 realtime health is partial",
        duration,
        summarizeDatabasePayload({ ...result, readinessMissingFields: readiness?.missingFields }),
      );
      return NextResponse.json({ type, ...result, readiness }, { status: result.ok ? 200 : 207 });
    }

    if (type === "database_aiden_context_collect") {
      const result = await getDatabaseAidenContext({
        tickers: ["HPG", "FPT", "DGC"],
        previousTradingDate: databaseEodReadDateKey(),
        useFiinquantFallback: false,
      });
      await persistDatabaseToolCronPayload({
        tool: "aiden",
        dataset: "aiden.context",
        payload: result.data,
        missingFields: result.missingFields,
        providerStatus: result.providerStatus,
        ttlMs: 24 * 60 * 60_000,
      });
      const duration = Date.now() - startTime;
      await logCron(
        type,
        result.ok ? "success" : "skipped",
        result.ok ? "Database v2 AIDEN context ready" : "Database v2 AIDEN context is partial",
        duration,
        summarizeDatabasePayload(result),
      );
      return NextResponse.json({ type, ...result }, { status: result.ok ? 200 : 207 });
    }

    if (type === "database_adn_radar_collect" || type === "database_adn_radar_readiness") {
      const result = await collectDatahubTopicsForDatabaseV2(DATABASE_RADAR_TOPIC_KEYS, {
        force: type === "database_adn_radar_collect",
      });
      await persistDatabaseToolCronPayload({
        tool: "radar",
        dataset: "radar.shadow",
        payload: result,
        missingFields: result.missingFields,
        ttlMs: 5 * 60_000,
      });
      const duration = Date.now() - startTime;
      await logCron(
        type,
        result.ok ? "success" : "skipped",
        result.ok ? "Database v2 ADN Radar shadow data ready" : "Database v2 ADN Radar shadow data is partial",
        duration,
        summarizeDatabasePayload(result),
      );
      return NextResponse.json({ type, ...result }, { status: result.ok ? 200 : 207 });
    }

    if (type === "database_adn_art_collect" || type === "database_adn_art_readiness") {
      if (!forceRun && !isTradingDay()) {
        const duration = Date.now() - startTime;
        await logCron(type, "skipped", "Database v2 ADN ART skipped on non-trading day", duration);
        return NextResponse.json({ type, skipped: true, reason: "non_trading_day" });
      }
      const result = await collectDatabaseArtPayload(type === "database_adn_art_collect");
      await persistDatabaseToolCronPayload({
        tool: "art",
        dataset: "art.rpi",
        payload: result,
        missingFields: result.missingFields,
        ttlMs: 10 * 60_000,
      });
      const duration = Date.now() - startTime;
      await logCron(
        type,
        result.ok ? "success" : "skipped",
        result.ok ? "Database v2 ADN ART RPI computed" : "Database v2 ADN ART RPI is partial",
        duration,
        summarizeDatabasePayload(result),
      );
      return NextResponse.json({ type, ...result }, { status: result.ok ? 200 : 207 });
    }

    if (type === "database_adncore_collect" || type === "database_adncore_readiness") {
      const result = await collectDatahubTopicsForDatabaseV2(DATABASE_ADNCORE_TOPIC_KEYS, {
        force: type === "database_adncore_collect",
      });
      const pulse = await getTopicEnvelope(SMARTFLOW_TOPIC_KEY, {
        force: type === "database_adncore_collect",
        systemRole: "cron",
      }).catch(() => null);
      await Promise.all([
        persistDatabaseToolCronPayload({
          tool: "adncore",
          dataset: "adncore.context",
          payload: result,
          missingFields: result.missingFields,
          ttlMs: 30 * 60_000,
        }),
        pulse?.value
          ? persistDatabaseToolCronPayload({
              tool: "pulse",
              dataset: "pulse.smartflow",
              payload: pulse.value,
              missingFields: pulse.freshness === "error" ? [SMARTFLOW_TOPIC_KEY] : [],
              ttlMs: 30 * 60_000,
            })
          : Promise.resolve(null),
      ]);
      const duration = Date.now() - startTime;
      await logCron(
        type,
        result.ok ? "success" : "skipped",
        result.ok ? "Database v2 ADNCore shadow data ready" : "Database v2 ADNCore shadow data is partial",
        duration,
        summarizeDatabasePayload(result),
      );
      return NextResponse.json({ type, ...result }, { status: result.ok ? 200 : 207 });
    }

    if (type === "database_adn_rank_collect" || type === "database_adn_rank_readiness") {
      const result = await collectDatahubTopicsForDatabaseV2(ADN_RANK_TOPIC_KEYS, {
        force: type === "database_adn_rank_collect",
      });
      const rank = await getTopicEnvelope("research:rs-rating:list", {
        force: type === "database_adn_rank_collect",
        systemRole: "cron",
      }).catch(() => null);
      await persistDatabaseToolCronPayload({
        tool: "rank",
        dataset: "rank.rs",
        payload: rank?.value ?? result,
        missingFields: result.missingFields,
        ttlMs: 24 * 60 * 60_000,
      });
      const duration = Date.now() - startTime;
      await logCron(
        type,
        result.ok ? "success" : "skipped",
        result.ok ? "Database v2 ADN Rank shadow data ready" : "Database v2 ADN Rank shadow data is partial",
        duration,
        summarizeDatabasePayload(result),
      );
      return NextResponse.json({ type, ...result }, { status: result.ok ? 200 : 207 });
    }

    if (type === "database_eod_collect" || type === "database_eod_readiness") {
      const tradingDate = databaseEodReadDateKey();
      const result = await getDatabaseEodMarketDataset({
        tradingDate,
        useFiinquantFallback: true,
        fiinquantTimeoutMs: type === "database_eod_collect" ? 240_000 : 60_000,
      });
      await persistDatabaseToolCronPayload({
        tool: "eod",
        dataset: "market.eod",
        payload: result.data,
        missingFields: result.missingFields,
        providerStatus: result.providerStatus,
        ttlMs: 24 * 60 * 60_000,
        tradingDate,
      });
      const duration = Date.now() - startTime;
      await logCron(
        type,
        result.ok ? "success" : "skipped",
        result.ok ? "Database v2 EOD dataset ready" : "Database v2 EOD dataset is partial",
        duration,
        summarizeDatabasePayload(result),
      );
      return NextResponse.json({ type, ...result }, { status: result.ok ? 200 : 207 });
    }

    return NextResponse.json({ type, error: "Unsupported Database v2 cron" }, { status: 400 });
  } catch (error) {
    const duration = Date.now() - startTime;
    await logCron(type, "error", error instanceof Error ? error.message : String(error), duration);
    return NextResponse.json({ type, error: "Database v2 cron failed" }, { status: 500 });
  }
}

function readArtDate(row: Record<string, unknown>) {
  const value = row.date ?? row.tradingDate ?? row.time ?? row.timestamp;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") return new Date(value).toISOString().slice(0, 10);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d{10}$/.test(trimmed)) return new Date(Number(trimmed) * 1000).toISOString().slice(0, 10);
    if (/^\d{13}$/.test(trimmed)) return new Date(Number(trimmed)).toISOString().slice(0, 10);
    return trimmed.slice(0, 10);
  }
  return null;
}

function toArtOhlcvRows(value: unknown): OHLCVData[] {
  return getMarketPayloadRows(value)
    .map((row) => {
      const date = readArtDate(row);
      const open = readMarketNumber(row.open ?? row.o);
      const high = readMarketNumber(row.high ?? row.h);
      const low = readMarketNumber(row.low ?? row.l);
      const close = readMarketNumber(row.close ?? row.c ?? row.price);
      const volume = readMarketNumber(row.volume ?? row.v ?? row.matchVolume) ?? 0;

      if (!date || open == null || high == null || low == null || close == null) return null;
      if ([open, high, low, close].some((item) => !Number.isFinite(item) || item <= 0)) return null;

      return { date, open, high, low, close, volume };
    })
    .filter((row): row is OHLCVData => row != null)
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function handleArtDaily1905(forceRun = false): Promise<NextResponse> {
  const startTime = Date.now();
  const vnNow = getVnNow();
  const day = vnNow.day();
  const minuteOfDay = vnNow.hour() * 60 + vnNow.minute();

  if (!forceRun && (day === 0 || day === 6)) {
    const duration = Date.now() - startTime;
    await logCron("art_daily_1905", "skipped", "ADN ART refresh skipped on weekend", duration, {
      weekday: day,
    });
    return NextResponse.json({
      type: "art_daily_1905",
      skipped: true,
      reason: "weekend",
    });
  }

  if (!forceRun && minuteOfDay < ART_DAILY_REFRESH_MINUTE_VN) {
    const duration = Date.now() - startTime;
    await logCron("art_daily_1905", "skipped", "ADN ART refresh skipped before 19:05 VN", duration, {
      nextSlot: "19:05",
    });
    return NextResponse.json({
      type: "art_daily_1905",
      skipped: true,
      reason: "before_scheduled_slot",
      nextSlot: "19:05",
    });
  }

  try {
    const invalidated = invalidateTopics({ topics: [ART_DAILY_TOPIC_KEY] });
    const envelope = await getTopicEnvelope(ART_DAILY_TOPIC_KEY, { force: true, systemRole: "cron" });
    const rows = toArtOhlcvRows(envelope.value);
    const history = calculateRPI(rows);
    const latest = getLatestRPI(history);
    const duration = Date.now() - startTime;

    if (envelope.freshness === "error" || !latest) {
      await logCron("art_daily_1905", "error", "ADN ART refresh returned no valid rows", duration, {
        freshness: envelope.freshness,
        error: envelope.error,
        rows: rows.length,
        invalidated,
      });
      return NextResponse.json(
        {
          type: "art_daily_1905",
          published: false,
          reason: "empty_or_error",
          freshness: envelope.freshness,
          error: envelope.error,
        },
        { status: 502 },
      );
    }

    await logCron("art_daily_1905", "success", `ADN ART refreshed ${latest.date}`, duration, {
      topic: ART_DAILY_TOPIC_KEY,
      topicUpdatedAt: envelope.updatedAt,
      freshness: envelope.freshness,
      latest,
      rows: rows.length,
      historyPoints: history.filter((row) => row.rpi !== null).length,
      invalidated,
    });

    return NextResponse.json({
      type: "art_daily_1905",
      published: true,
      topic: ART_DAILY_TOPIC_KEY,
      topicUpdatedAt: envelope.updatedAt,
      freshness: envelope.freshness,
      latest,
      rows: rows.length,
      historyPoints: history.filter((row) => row.rpi !== null).length,
      invalidated,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    await logCron("art_daily_1905", "error", String(error), duration);
    return NextResponse.json(
      {
        type: "art_daily_1905",
        published: false,
        error: "Khong cap nhat duoc ADN ART",
      },
      { status: 500 },
    );
  }
}

async function handleAdnRank15h(forceRun = false): Promise<NextResponse> {
  const startTime = Date.now();
  const vnNow = getVnNow();
  const day = vnNow.day();
  const minuteOfDay = vnNow.hour() * 60 + vnNow.minute();

  if (!forceRun && (day === 0 || day === 6)) {
    const duration = Date.now() - startTime;
    await logCron("adn_rank_15h", "skipped", "ADN Rank refresh skipped on weekend", duration, {
      weekday: day,
    });
    return NextResponse.json({
      type: "adn_rank_15h",
      skipped: true,
      reason: "weekend",
    });
  }

  if (!forceRun && minuteOfDay < ADN_RANK_REFRESH_MINUTE_VN) {
    const duration = Date.now() - startTime;
    await logCron("adn_rank_15h", "skipped", "ADN Rank refresh skipped before 15:00 VN", duration, {
      nextSlot: "15:00",
    });
    return NextResponse.json({
      type: "adn_rank_15h",
      skipped: true,
      reason: "before_scheduled_slot",
      nextSlot: "15:00",
    });
  }

  try {
    const invalidated = invalidateTopics({ topics: [...ADN_RANK_TOPIC_KEYS], tags: ["rs-rating"] });
    const envelope = await getTopicEnvelope("research:rs-rating:list", { force: true });
    const payload = envelope.value as { stocks?: unknown[]; asOfDate?: string | null; updatedAt?: string | null } | null;
    const count = Array.isArray(payload?.stocks) ? payload.stocks.length : 0;
    const duration = Date.now() - startTime;

    if (envelope.freshness === "error" || count === 0) {
      await logCron("adn_rank_15h", "error", "ADN Rank refresh returned no valid rows", duration, {
        freshness: envelope.freshness,
        error: envelope.error,
        invalidated,
      });
      return NextResponse.json(
        {
          type: "adn_rank_15h",
          published: false,
          reason: "empty_or_error",
          freshness: envelope.freshness,
          error: envelope.error,
        },
        { status: 502 },
      );
    }

    await logCron("adn_rank_15h", "success", `ADN Rank refreshed ${count} rows`, duration, {
      artifactType: "datahub_topic",
      topic: "research:rs-rating:list",
      value: payload,
      computedAt: new Date().toISOString(),
      topicUpdatedAt: envelope.updatedAt,
      payloadUpdatedAt: payload?.updatedAt ?? null,
      asOfDate: payload?.asOfDate ?? null,
      count,
      invalidated,
    });
    return NextResponse.json({
      type: "adn_rank_15h",
      published: true,
      count,
      topicUpdatedAt: envelope.updatedAt,
      payloadUpdatedAt: payload?.updatedAt ?? null,
      asOfDate: payload?.asOfDate ?? null,
      invalidated,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    await logCron("adn_rank_15h", "error", String(error), duration);
    return NextResponse.json(
      {
        type: "adn_rank_15h",
        published: false,
        error: "Khong cap nhat duoc ADN Rank",
      },
      { status: 500 },
    );
  }
}

async function handlePulseSmartflowPrecompute(forceRun = false): Promise<NextResponse> {
  const startTime = Date.now();
  const vnNow = getVnNow();
  const day = vnNow.day();

  if (!forceRun && (day === 0 || day === 6)) {
    const duration = Date.now() - startTime;
    await logCron("pulse_smartflow_precompute", "skipped", "ADN Smartflow skipped on weekend", duration, {
      weekday: day,
    });
    return NextResponse.json({ type: "pulse_smartflow_precompute", skipped: true, reason: "weekend" });
  }

  try {
    const invalidated = invalidateTopics({ topics: [SMARTFLOW_TOPIC_KEY], tags: ["smartflow", "dashboard", "market"] });
    const envelope = await getTopicEnvelope(SMARTFLOW_TOPIC_KEY, { force: true });
    const payload = envelope.value as {
      indexImpact?: { positive?: unknown[]; negative?: unknown[] };
      investorFlow?: {
        foreign?: Record<string, { topBuy?: unknown[]; topSell?: unknown[] }>;
        proprietary?: Record<string, { topBuy?: unknown[]; topSell?: unknown[] }>;
      };
      institutionalAccumulation3M?: unknown[];
      sourceStatus?: { publish?: boolean };
      updatedAt?: string | null;
    } | null;
    const oneDayForeign = payload?.investorFlow?.foreign?.["1D"];
    const oneDayProp = payload?.investorFlow?.proprietary?.["1D"];
    const count =
      (Array.isArray(payload?.indexImpact?.positive) ? payload.indexImpact.positive.length : 0) +
      (Array.isArray(payload?.indexImpact?.negative) ? payload.indexImpact.negative.length : 0) +
      (Array.isArray(oneDayForeign?.topBuy) ? oneDayForeign.topBuy.length : 0) +
      (Array.isArray(oneDayForeign?.topSell) ? oneDayForeign.topSell.length : 0) +
      (Array.isArray(oneDayProp?.topBuy) ? oneDayProp.topBuy.length : 0) +
      (Array.isArray(oneDayProp?.topSell) ? oneDayProp.topSell.length : 0) +
      (Array.isArray(payload?.institutionalAccumulation3M) ? payload.institutionalAccumulation3M.length : 0);
    const duration = Date.now() - startTime;

    if (envelope.freshness === "error" || !payload || payload.sourceStatus?.publish === false || count === 0) {
      await logCron("pulse_smartflow_precompute", "error", "ADN Smartflow precompute returned no valid payload", duration, {
        freshness: envelope.freshness,
        error: envelope.error,
        invalidated,
        count,
      });
      return NextResponse.json(
        {
          type: "pulse_smartflow_precompute",
          published: false,
          reason: "empty_or_error",
          freshness: envelope.freshness,
          error: envelope.error,
        },
        { status: 502 },
      );
    }

    await logCron("pulse_smartflow_precompute", "success", `ADN Smartflow precomputed ${count} rows`, duration, {
      artifactType: "datahub_topic",
      topic: SMARTFLOW_TOPIC_KEY,
      value: payload,
      computedAt: new Date().toISOString(),
      topicUpdatedAt: envelope.updatedAt,
      payloadUpdatedAt: payload.updatedAt ?? null,
      count,
      invalidated,
    });
    return NextResponse.json({
      type: "pulse_smartflow_precompute",
      published: true,
      count,
      topicUpdatedAt: envelope.updatedAt,
      payloadUpdatedAt: payload.updatedAt ?? null,
      invalidated,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    await logCron("pulse_smartflow_precompute", "error", String(error), duration);
    return NextResponse.json(
      {
        type: "pulse_smartflow_precompute",
        published: false,
        error: "Khong cap nhat duoc ADN Smartflow",
      },
      { status: 500 },
    );
  }
}

function hasMeaningfulBreadth(snapshot: Awaited<ReturnType<typeof getMarketSnapshot>>): boolean {
  const breadth = snapshot.breadth;
  return !!breadth && breadth.up + breadth.down + breadth.unchanged > 0;
}

function hasMeaningfulLiquidity(snapshot: Awaited<ReturnType<typeof getMarketSnapshot>>): boolean {
  const total = snapshot.liquidity;
  const hose = snapshot.liquidityByExchange.HOSE;
  return total != null && total > 0 && hose != null && hose > 0;
}

function hasFullExchangeLiquidity(snapshot: Awaited<ReturnType<typeof getMarketSnapshot>>): boolean {
  const liq = snapshot.liquidityByExchange;
  return ["HOSE", "HNX", "UPCOM"].every((exchange) => {
    const value = liq[exchange as keyof typeof liq];
    return value != null && Number.isFinite(value) && value > 0;
  });
}

function hasFullExchangeBreadth(snapshot: Awaited<ReturnType<typeof getMarketSnapshot>>): boolean {
  const byExchange = snapshot.breadthByExchange;
  if (!byExchange) return false;

  return ["HOSE", "HNX", "UPCOM"].every((exchange) => {
    const breadth = byExchange[exchange as keyof typeof byExchange];
    if (!breadth) return false;
    return breadth.up + breadth.down + breadth.unchanged > 0;
  });
}

function hasRequiredStatsData(snapshot: Awaited<ReturnType<typeof getMarketSnapshot>>): boolean {
  const hasMainIndex = snapshot.indices.some((item) => item.ticker === "VNINDEX");
  return (
    hasMainIndex &&
    hasMeaningfulLiquidity(snapshot) &&
    hasFullExchangeLiquidity(snapshot) &&
    hasMeaningfulBreadth(snapshot) &&
    hasFullExchangeBreadth(snapshot) &&
    snapshot.investorTrading.availability.foreign
  );
}

function hasRequiredClose15Data(snapshot: Awaited<ReturnType<typeof getMarketSnapshot>>): boolean {
  const hasMainIndex = snapshot.indices.some((item) => item.ticker === "VNINDEX");
  return (
    hasMainIndex &&
    hasMeaningfulLiquidity(snapshot) &&
    hasFullExchangeLiquidity(snapshot) &&
    hasMeaningfulBreadth(snapshot) &&
    snapshot.investorTrading.availability.foreign
  );
}

function hasRequiredFull19Data(snapshot: Awaited<ReturnType<typeof getMarketSnapshot>>): boolean {
  const hasMainIndex = snapshot.indices.some((item) => item.ticker === "VNINDEX");
  return (
    hasMainIndex &&
    hasMeaningfulLiquidity(snapshot) &&
    hasFullExchangeLiquidity(snapshot) &&
    hasMeaningfulBreadth(snapshot) &&
    snapshot.investorTrading.availability.foreign &&
    snapshot.investorTrading.availability.proprietary &&
    snapshot.investorTrading.availability.retail
  );
}

function buildIntradayFallback(today: string, timeLabel: string, vnidx?: { value: number; changePct: number }) {
  const idx = vnidx ? `${vnidx.value} | ${vnidx.changePct >= 0 ? "+" : ""}${vnidx.changePct}%` : "chưa cập nhật";
  return `⚡ *BẢN TIN INTRADAY — ${timeLabel} ${today}*

📊 *CHỈ SỐ:*
🇻🇳 VN-INDEX: ${idx}

⚠️ *GHI CHÚ DỮ LIỆU:*
• Một số dữ liệu intraday đang cập nhật.
• Hệ thống sẽ tự đồng bộ ngay khi nguồn dữ liệu đầy đủ.

_Powered by ADN Capital AI_`;
}

function buildPropTradingFallback(today: string, foreignNet?: number | null, propNet?: number | null, retailNet?: number | null) {
  const format = (value: number | null | undefined) =>
    value == null ? "chưa cập nhật" : `${value >= 0 ? "+" : ""}${value.toFixed(1)} tỷ`;
  return `🌙 *BẢN TIN TỔNG HỢP 19:00 — ${today}*

📊 *DÒNG TIỀN NHÀ ĐẦU TƯ:*
• Khối ngoại: ${format(foreignNet)}
• Tự doanh: ${format(propNet)}
• Cá nhân: ${format(retailNet)}

⚠️ *GHI CHÚ DỮ LIỆU:*
• Một số dữ liệu có thể đang đồng bộ cuối ngày.
• Hệ thống sẽ tự cập nhật lại khi nguồn đầy đủ.

_Powered by ADN Capital AI_`;
}

function formatTy(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "chưa cập nhật";
  return `${Math.abs(value).toLocaleString("vi-VN", { maximumFractionDigits: 0 })} tỷ`;
}

function formatBreadthGroup(
  breadth:
    | { up: number; down: number; unchanged: number; ceiling?: number; floor?: number }
    | null
    | undefined,
): string {
  if (!breadth) return "chưa cập nhật";
  const ceiling = Number(breadth.ceiling ?? 0);
  const floor = Number(breadth.floor ?? 0);
  const extra = ceiling > 0 || floor > 0 ? ` | Trần ${ceiling} | Sàn ${floor}` : "";
  return `Tăng ${breadth.up} | Giảm ${breadth.down} | Đứng ${breadth.unchanged}${extra}`;
}

function buildBreadthSection(snapshot: Awaited<ReturnType<typeof getMarketSnapshot>>): string {
  const byExchange = snapshot.breadthByExchange;
  return [
    "📊 *ĐỘ RỘNG THỊ TRƯỜNG:*",
    `• Toàn thị trường: ${formatBreadthGroup(snapshot.breadth)}`,
    `• HoSE: ${formatBreadthGroup(byExchange?.HOSE)}`,
    `• HNX: ${formatBreadthGroup(byExchange?.HNX)}`,
    `• UPCoM: ${formatBreadthGroup(byExchange?.UPCOM)}`,
  ].join("\n");
}

function buildPropTradingReport(today: string, snapshot: Awaited<ReturnType<typeof getMarketSnapshot>>) {
  {
    const idx = snapshot.indices.find((item) => item.ticker === "VNINDEX");
    const vn30Index = snapshot.indices.find((item) => item.ticker === "VN30");
    const investorLines = getInvestorTradingText(snapshot, "full19");
    const investorSection =
      investorLines.length > 0
        ? investorLines.map((line) => `• ${line}`).join("\n")
        : "• Khối ngoại: chưa cập nhật\n• Tự doanh: chưa cập nhật\n• Cá nhân: chưa cập nhật";
    const exchangeValue = (value: number | null) => (value == null ? "?" : formatTy(value));
    const totalLiquidity = snapshot.liquidity != null ? formatTy(snapshot.liquidity) : "chưa cập nhật";
    const indexDirection =
      (idx?.changePct ?? 0) > 0
        ? "Thị trường duy trì sắc xanh."
        : (idx?.changePct ?? 0) < 0
        ? "Thị trường chịu áp lực điều chỉnh."
        : "Thị trường đi ngang, chưa hình thành xu hướng rõ.";
    const foreignNet = snapshot.investorTrading.foreign.net ?? 0;
    const flowNote =
      foreignNet > 0
        ? "Khối ngoại đang hỗ trợ xu hướng ngắn hạn."
        : foreignNet < 0
        ? "Khối ngoại vẫn bán ròng, cần quản trị rủi ro chặt chẽ."
        : "Dòng tiền khối ngoại trung tính.";

    return `🌙 *BẢN TIN TỔNG HỢP 19:00 — ${today}*

📊 *KẾT QUẢ CHỈ SỐ:*
🇻🇳 VN-INDEX: ${idx ? `${idx.value} | ${idx.changePct >= 0 ? "+" : ""}${idx.changePct}%` : "chưa cập nhật"}
💎 VN30: ${vn30Index ? `${vn30Index.value} | ${vn30Index.changePct >= 0 ? "+" : ""}${vn30Index.changePct}%` : "chưa cập nhật"}

💧 *THANH KHOẢN:*
• Tổng: ${totalLiquidity}
• HoSE/HNX/UPCoM: ${exchangeValue(snapshot.liquidityByExchange.HOSE)} | ${exchangeValue(snapshot.liquidityByExchange.HNX)} | ${exchangeValue(snapshot.liquidityByExchange.UPCOM)}

${buildBreadthSection(snapshot)}

🏦 *DÒNG TIỀN NHÀ ĐẦU TƯ:*
${investorSection}

💡 *NHẬN ĐỊNH SMART MONEY:*
• ${indexDirection}
• ${flowNote}

_Powered by ADN Capital AI_`;
  }

  const vnindex = snapshot.indices.find((item) => item.ticker === "VNINDEX")!;
  const vn30 = snapshot.indices.find((item) => item.ticker === "VN30")!;
  const investorLines = getInvestorTradingText(snapshot, "full19");
  const investorSection =
    investorLines.length > 0
      ? investorLines.map((line) => `• ${line}`).join("\n")
      : "• Khối ngoại: chưa cập nhật\n• Tự doanh: chưa cập nhật\n• Cá nhân: chưa cập nhật";

  const fmtExchange = (value: number | null) => (value == null ? "?" : formatTy(value));
  const liquidityTotal = snapshot.liquidity != null ? formatTy(snapshot.liquidity) : "chưa cập nhật";

  const direction =
    (vnindex?.changePct ?? 0) > 0
      ? "thị trường duy trì sắc xanh."
      : (vnindex?.changePct ?? 0) < 0
      ? "thị trường chịu áp lực điều chỉnh."
      : "thị trường đi ngang, chưa hình thành xu hướng rõ.";

  const foreignNet = snapshot.investorTrading.foreign.net ?? 0;
  const flowNote =
    foreignNet > 0
      ? "Khối ngoại đang hỗ trợ xu hướng ngắn hạn."
      : foreignNet < 0
      ? "Khối ngoại vẫn bán ròng, cần quản trị rủi ro chặt chẽ."
      : "Dòng tiền khối ngoại trung tính.";

  return `🌙 *BẢN TIN TỔNG HỢP 19:00 — ${today}*

📊 *KẾT QUẢ CHỈ SỐ:*
🇻🇳 VN-INDEX: ${vnindex ? `${vnindex.value} | ${vnindex.changePct >= 0 ? "+" : ""}${vnindex.changePct}%` : "chưa cập nhật"}
💎 VN30: ${vn30 ? `${vn30.value} | ${vn30.changePct >= 0 ? "+" : ""}${vn30.changePct}%` : "chưa cập nhật"}

💧 *THANH KHOẢN:*
• Tổng: ${liquidityTotal}
• HoSE/HNX/UPCoM: ${fmtExchange(snapshot.liquidityByExchange.HOSE)} | ${fmtExchange(snapshot.liquidityByExchange.HNX)} | ${fmtExchange(snapshot.liquidityByExchange.UPCOM)}

🏦 *DÒNG TIỀN NHÀ ĐẦU TƯ:*
${investorSection}

💡 *NHẬN ĐỊNH SMART MONEY:*
• ${direction}
• ${flowNote}

_Powered by ADN Capital AI_`;
}

// ═══════════════════════════════════════════════════════════════
//  Router
// ═══════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  if (!validateCronSecret(req)) {
    return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 401 });
  }

  const requestedType = req.nextUrl.searchParams.get("type");
  const type = normalizeCronType(requestedType);
  const sync = req.nextUrl.searchParams.get("sync") === "1";
  const forceRun = req.nextUrl.searchParams.get("force") === "1";
  const backfillDateISO = forceRun ? normalizeBackfillDateParam(req.nextUrl.searchParams.get("date")) : null;
  if (forceRun && req.nextUrl.searchParams.get("date") && !backfillDateISO) {
    return NextResponse.json({ error: "Invalid date. Use YYYY-MM-DD." }, { status: 400 });
  }

  if (!type) {
    return NextResponse.json(
      {
        error: "Thiếu hoặc sai tham số 'type'",
        availableTypes: CANONICAL_CRON_TYPES,
        legacyAliases: LEGACY_CRON_ALIASES,
      },
      { status: 400 }
    );
  }

  emitObservabilityEvent({
    domain: "cron",
    event: "cron_dispatch_received",
    meta: {
      requestedType,
      normalizedType: type,
      sync,
      forceRun,
      legacyAliasUsed: Boolean(requestedType && requestedType !== type),
    },
  });

  if (sync) {
    if (isDatabaseV2CronType(type)) {
      return runCronHandlerWithWorkflowHook(type, () => handleDatabaseV2Cron(type, forceRun), "cron-dispatch:sync");
    }
    if (type === "morning_brief") {
      return runCronHandlerWithWorkflowHook(type, () => handleMorningBrief(forceRun), "cron-dispatch:sync");
    }
    if (type === "close_brief_15h") {
      return runCronHandlerWithWorkflowHook(type, () => handleCloseBrief15(forceRun), "cron-dispatch:sync");
    }
    if (type === "eod_full_19h") {
      return runCronHandlerWithWorkflowHook(type, () => handlePropTrading(forceRun, backfillDateISO), "cron-dispatch:sync");
    }
    if (type === "market_stats_type2") {
      return runCronHandlerWithWorkflowHook(type, () => handleIntraday(forceRun), "cron-dispatch:sync");
    }
    if (type === "news_crawler") {
      return runCronHandlerWithWorkflowHook(type, () => handleNewsCrawler(), "cron-dispatch:sync");
    }
    if (type === "adn_rank_15h") {
      return runCronHandlerWithWorkflowHook(type, () => handleAdnRank15h(forceRun), "cron-dispatch:sync");
    }
    if (type === "pulse_smartflow_precompute") {
      return runCronHandlerWithWorkflowHook(type, () => handlePulseSmartflowPrecompute(forceRun), "cron-dispatch:sync");
    }
    if (type === "art_daily_1905") {
      return runCronHandlerWithWorkflowHook(type, () => handleArtDaily1905(forceRun), "cron-dispatch:sync");
    }
    return runCronHandlerWithWorkflowHook(type, () => handleSignalScan5m(forceRun), "cron-dispatch:sync");
  }

  const queued = await prisma.cronLog.create({
    data: {
      cronName: type,
      status: "skipped",
      message: "queued",
      resultData: JSON.stringify({ type, queuedAt: new Date().toISOString() }),
      duration: 0,
    },
    select: { id: true, createdAt: true },
  });

  const run = async () => {
    try {
      if (isDatabaseV2CronType(type)) {
        await runCronHandlerWithWorkflowHook(type, () => handleDatabaseV2Cron(type, forceRun), "cron-dispatch:async");
      } else if (type === "morning_brief") {
        await runCronHandlerWithWorkflowHook(type, () => handleMorningBrief(forceRun), "cron-dispatch:async");
      } else if (type === "close_brief_15h") {
        await runCronHandlerWithWorkflowHook(type, () => handleCloseBrief15(forceRun), "cron-dispatch:async");
      } else if (type === "eod_full_19h") {
        await runCronHandlerWithWorkflowHook(type, () => handlePropTrading(forceRun, backfillDateISO), "cron-dispatch:async");
      } else if (type === "market_stats_type2") {
        await runCronHandlerWithWorkflowHook(type, () => handleIntraday(forceRun), "cron-dispatch:async");
      } else if (type === "news_crawler") {
        await runCronHandlerWithWorkflowHook(type, () => handleNewsCrawler(), "cron-dispatch:async");
      } else if (type === "adn_rank_15h") {
        await runCronHandlerWithWorkflowHook(type, () => handleAdnRank15h(forceRun), "cron-dispatch:async");
      } else if (type === "pulse_smartflow_precompute") {
        await runCronHandlerWithWorkflowHook(type, () => handlePulseSmartflowPrecompute(forceRun), "cron-dispatch:async");
      } else if (type === "art_daily_1905") {
        await runCronHandlerWithWorkflowHook(type, () => handleArtDaily1905(forceRun), "cron-dispatch:async");
      } else {
        await runCronHandlerWithWorkflowHook(type, () => handleSignalScan5m(forceRun), "cron-dispatch:async");
      }
      await prisma.cronLog.update({
        where: { id: queued.id },
        data: { status: "success", message: "completed" },
      });
    } catch (error) {
      await prisma.cronLog.update({
        where: { id: queued.id },
        data: { status: "error", message: String(error) },
      });
    }
  };

  setTimeout(() => {
    void run();
  }, 0);

  emitObservabilityEvent({
    domain: "cron",
    event: "cron_dispatch_queued",
    meta: {
      requestedType,
      normalizedType: type,
      queuedId: queued.id,
      sync,
      forceRun,
    },
  });

  return NextResponse.json({
    accepted: true,
    jobId: queued.id,
    queuedAt: queued.createdAt.toISOString(),
    type,
    requestedType,
  });
}

// ═══════════════════════════════════════════════════════════════
//  1. EOD FULL 19:00 — Ngoại + Tự doanh + Cá nhân
// ═══════════════════════════════════════════════════════════════

function formatTyPublic(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "chưa cập nhật";
  return `${Math.abs(value).toLocaleString("vi-VN", { maximumFractionDigits: 0 })} tỷ`;
}

function formatPctPublic(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "chưa cập nhật";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatIndexPublic(index: { value: number; changePct: number } | undefined): string {
  if (!index) return "chưa cập nhật";
  return `${index.value.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} (${formatPctPublic(index.changePct)})`;
}

function formatBreadthPublic(
  breadth:
    | { up: number; down: number; unchanged: number; ceiling?: number; floor?: number }
    | null
    | undefined,
): string {
  if (!breadth) return "chưa cập nhật";
  const ceiling = Number(breadth.ceiling ?? 0);
  const floor = Number(breadth.floor ?? 0);
  const limitText = ceiling > 0 || floor > 0 ? ` | Trần ${ceiling} | Sàn ${floor}` : "";
  return `Tăng ${breadth.up} | Giảm ${breadth.down} | Đứng ${breadth.unchanged}${limitText}`;
}

/**
 * Extract per-exchange liquidity from the Python bridge EOD response.
 * The bridge returns hose_val / hnx_val / upcom_val as undeclared raw fields
 * after the trading session ends — same fields used by /api/market-news.
 */
function extractBridgeExchangeLiquidity(
  eodDetail: FiinEodNews | null | undefined,
): { HOSE: number | null; HNX: number | null; UPCOM: number | null } {
  if (!eodDetail) return { HOSE: null, HNX: null, UPCOM: null };
  const raw = eodDetail as unknown as Record<string, unknown>;
  const toNum = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  return {
    HOSE: toNum(raw.hose_val),
    HNX: toNum(raw.hnx_val),
    UPCOM: toNum(raw.upcom_val),
  };
}

function buildFull19PublicReportLegacy(
  today: string,
  snapshot: Awaited<ReturnType<typeof getMarketSnapshot>>,
  eodDetail?: FiinEodNews | null,
) {
  const vnindex = snapshot.indices.find((item) => item.ticker === "VNINDEX");
  const vn30 = snapshot.indices.find((item) => item.ticker === "VN30");
  const investorLines = getInvestorTradingText(snapshot, "full19");
  const investorSection =
    investorLines.length > 0
      ? investorLines.map((line) => `• ${line}`).join("\n")
      : "• Khối ngoại: chưa cập nhật\n• Tự doanh: chưa cập nhật\n• Cá nhân: chưa cập nhật";
  const byExchange = snapshot.breadthByExchange;
  const foreignNet = snapshot.investorTrading.foreign.net ?? 0;

  // Prefer bridge post-session values for per-exchange liquidity (more accurate than intraday snapshot)
  const bridgeLiq = extractBridgeExchangeLiquidity(eodDetail);
  const liqHOSE = bridgeLiq.HOSE ?? snapshot.liquidityByExchange.HOSE;
  const liqHNX  = bridgeLiq.HNX  ?? snapshot.liquidityByExchange.HNX;
  const liqUPCOM = bridgeLiq.UPCOM ?? snapshot.liquidityByExchange.UPCOM;
  const indexDirection =
    (vnindex?.changePct ?? 0) > 0
      ? "Thị trường duy trì sắc xanh, ưu tiên lọc nhóm giữ nền tích cực."
      : (vnindex?.changePct ?? 0) < 0
        ? "Thị trường chịu áp lực điều chỉnh, ưu tiên quản trị rủi ro."
        : "Thị trường đi ngang, chờ xác nhận dòng tiền mới.";
  const flowNote =
    foreignNet > 0
      ? "Khối ngoại mua ròng, hỗ trợ tâm lý ngắn hạn."
      : foreignNet < 0
        ? "Khối ngoại bán ròng, cần kiểm soát tỷ trọng và điểm dừng lỗ."
        : "Dòng tiền khối ngoại trung tính.";

  return `🌙 *BẢN TIN TỔNG HỢP 19:00 — ${today}*

📊 *CHỈ SỐ CHÍNH*
• VN-INDEX: ${formatIndexPublic(vnindex)}
• VN30: ${formatIndexPublic(vn30)}

💧 *THANH KHOẢN THEO SÀN*
• Tổng: ${formatTyPublic(snapshot.liquidity)}
• HoSE: ${formatTyPublic(liqHOSE)}
• HNX: ${formatTyPublic(liqHNX)}
• UPCoM: ${formatTyPublic(liqUPCOM)}

📈 *ĐỘ RỘNG THỊ TRƯỜNG*
• Toàn thị trường: ${formatBreadthPublic(snapshot.breadth)}
• HoSE: ${formatBreadthPublic(byExchange?.HOSE)}
• HNX: ${formatBreadthPublic(byExchange?.HNX)}
• UPCoM: ${formatBreadthPublic(byExchange?.UPCOM)}

🏦 *DÒNG TIỀN NHÀ ĐẦU TƯ*
${investorSection}

💡 *NHẬN ĐỊNH SMART MONEY*
• ${indexDirection}
• ${flowNote}

_Powered by ADN Capital AI_`;
}

function buildFull19PublicReport(
  today: string,
  snapshot: Awaited<ReturnType<typeof getMarketSnapshot>>,
  eodDetail?: FiinEodNews | null,
) {
  const toNumber = (value: unknown): number | null => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };
  const formatNumber = (value: number | null | undefined, digits = 1) => {
    if (value == null || !Number.isFinite(value)) return "-";
    return value.toLocaleString("vi-VN", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  };
  const formatTy = (value: number | null | undefined) => {
    if (value == null || !Number.isFinite(value)) return "-";
    return value.toLocaleString("vi-VN", { maximumFractionDigits: 0 });
  };
  const formatPct = (value: number | null | undefined) => {
    if (value == null || !Number.isFinite(value)) return "-";
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  };
  const stripListPrefix = (value: string) => {
    const prefixes = [
      "T\u0103ng \u0111i\u1ec3m:",
      "Gi\u1ea3m \u0111i\u1ec3m:",
      "Mua r\u00f2ng:",
      "B\u00e1n r\u00f2ng:",
    ];
    const matched = prefixes.find((prefix) => value.startsWith(prefix));
    return matched ? value.slice(matched.length).trim() : value;
  };

  const formatList = (items: string[] | undefined, limit = 8) =>
    (items ?? [])
      .map((item) => String(item ?? "").trim())
      .filter(Boolean)
      .map(stripListPrefix)
      .slice(0, limit)
      .join(", ");
  const addSection = (lines: string[], title: string, body: string | null | undefined) => {
    const content = String(body ?? "").trim();
    if (content) lines.push(`${title}\n${content}`);
  };

  const vnindex = snapshot.indices.find((item) => item.ticker === "VNINDEX");
  const vnIndexValue = toNumber(eodDetail?.vnindex) ?? vnindex?.value ?? null;
  const vnIndexChangePct = toNumber(eodDetail?.change_pct) ?? vnindex?.changePct ?? null;
  const directionIcon = (vnIndexChangePct ?? 0) >= 0 ? "🟢" : "🔴";
  const bridgeLiq = extractBridgeExchangeLiquidity(eodDetail);
  const matchedLiquidity =
    toNumber(eodDetail?.matched_liquidity) ?? toNumber(eodDetail?.liquidity) ?? snapshot.liquidity ?? null;
  const negotiatedLiquidity = toNumber(eodDetail?.negotiated_liquidity);
  const totalLiquidity =
    toNumber(eodDetail?.total_liquidity) ??
    (matchedLiquidity != null && negotiatedLiquidity != null ? matchedLiquidity + negotiatedLiquidity : null) ??
    matchedLiquidity;
  const liquidityByExchange = {
    HOSE: bridgeLiq.HOSE ?? snapshot.liquidityByExchange.HOSE,
    HNX: bridgeLiq.HNX ?? snapshot.liquidityByExchange.HNX,
    UPCOM: bridgeLiq.UPCOM ?? snapshot.liquidityByExchange.UPCOM,
  };
  const breadth = eodDetail?.breadth ?? snapshot.breadth;
  const dateLabel = eodDetail?.date
    ? eodDetail.date.split("-").reverse().join("/")
    : today;
  const sessionSummary =
    eodDetail?.session_summary?.trim() ||
    `VN-Index đóng cửa tại ${formatNumber(vnIndexValue)} điểm (${formatPct(vnIndexChangePct)}). Thanh khoản toàn thị trường đạt ${formatTy(totalLiquidity)} tỷ đồng.`;
  const outlook =
    eodDetail?.outlook?.trim() ||
    `Phiên tới ưu tiên trạng thái trung tính. Thanh khoản toàn thị trường đạt ${formatTy(totalLiquidity)} tỷ đồng; độ rộng ghi nhận ${breadth?.up ?? "-"} mã tăng, ${breadth?.down ?? "-"} mã giảm và ${breadth?.unchanged ?? "-"} mã đứng giá.`;

  const lines: string[] = [
    `📊 EOD FLASH NOTE — ${dateLabel}`,
    "",
    `${directionIcon} VN-INDEX: ${formatNumber(vnIndexValue)} (${formatPct(vnIndexChangePct)})`,
    `💰 TK: ${formatTy(totalLiquidity)} tỷ (HoSE ${formatTy(liquidityByExchange.HOSE)} | HNX ${formatTy(liquidityByExchange.HNX)} | UPCoM ${formatTy(liquidityByExchange.UPCOM)})`,
    `📏 Độ rộng: ↑${breadth?.up ?? "-"} ↓${breadth?.down ?? "-"} ─${breadth?.unchanged ?? "-"}`,
    "",
    `📝 ${sessionSummary}`,
  ];

  const foreignBuy = formatList(eodDetail?.foreign_top_buy, 5);
  const foreignSell = formatList(eodDetail?.foreign_top_sell, 5);
  addSection(
    lines,
    "🏦 Khối ngoại:",
    [
      eodDetail?.foreign_flow?.trim(),
      foreignBuy ? `  🟢 Mua ròng: ${foreignBuy}` : "",
      foreignSell ? `  🔴 Bán ròng: ${foreignSell}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );

  const propBuy = formatList(eodDetail?.prop_trading_top_buy, 5);
  const propSell = formatList(eodDetail?.prop_trading_top_sell, 5);
  addSection(
    lines,
    "🏢 Tự doanh:",
    [propBuy ? `  🟢 Mua: ${propBuy}` : "", propSell ? `  🔴 Bán: ${propSell}` : ""].filter(Boolean).join("\n"),
  );

  const individualBuy = formatList(eodDetail?.individual_top_buy, 5);
  const individualSell = formatList(eodDetail?.individual_top_sell, 5);
  addSection(
    lines,
    "👤 Cá nhân:",
    [individualBuy ? `  🟢 Mua: ${individualBuy}` : "", individualSell ? `  🔴 Bán: ${individualSell}` : ""]
      .filter(Boolean)
      .join("\n"),
  );

  const sectorGainers = formatList(eodDetail?.sector_gainers, 8);
  const sectorLosers = formatList(eodDetail?.sector_losers, 8);
  addSection(
    lines,
    "🏭 Nhóm ảnh hưởng chỉ số:",
    [sectorGainers ? `  🟢 Tăng điểm: ${sectorGainers}` : "", sectorLosers ? `  🔴 Giảm điểm: ${sectorLosers}` : ""]
      .filter(Boolean)
      .join("\n"),
  );

  const buySignals = formatList(eodDetail?.buy_signals, 12);
  const sellSignals = formatList(eodDetail?.sell_signals, 12);
  addSection(
    lines,
    "⚡ Tín hiệu mua/bán chủ động:",
    [buySignals ? `  🟢 Mua chủ động: ${buySignals}` : "", sellSignals ? `  🔴 Bán chủ động: ${sellSignals}` : ""]
      .filter(Boolean)
      .join("\n"),
  );

  addSection(lines, "🚀 Nhóm đột phá:", formatList(eodDetail?.top_breakout, 12));
  addSection(lines, "🏁 Top vượt đỉnh:", formatList(eodDetail?.top_new_high, 8));
  lines.push("", `🔮 Nhận định phiên tới: ${outlook}`, "", "— ADN Capital");

  return lines.join("\n");
}

function countEodDetailBuckets(eodDetail: FiinEodNews | null | undefined): number {
  if (!eodDetail) return 0;
  const buckets = [
    [...(eodDetail.foreign_top_buy ?? []), ...(eodDetail.foreign_top_sell ?? [])],
    [...(eodDetail.prop_trading_top_buy ?? []), ...(eodDetail.prop_trading_top_sell ?? [])],
    [...(eodDetail.individual_top_buy ?? []), ...(eodDetail.individual_top_sell ?? [])],
    [...(eodDetail.sector_gainers ?? []), ...(eodDetail.sector_losers ?? [])],
    [...(eodDetail.buy_signals ?? []), ...(eodDetail.sell_signals ?? [])],
    [...(eodDetail.top_breakout ?? []), ...(eodDetail.top_new_high ?? [])],
  ];
  return buckets.filter((items) => items.some((item) => String(item ?? "").trim().length > 0)).length;
}

function buildEodDetailFromInvestorSnapshot(
  dateISO: string,
  snapshot: Awaited<ReturnType<typeof getMarketSnapshot>>,
  investorRaw: Awaited<ReturnType<typeof getInvestorTradingData>> | null,
): FiinEodNews | null {
  const summary = (investorRaw?.summary ?? {}) as Record<string, any>;
  const toNumber = (value: unknown) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };
  const formatNet = (value: unknown) => {
    const n = toNumber(value);
    if (n == null) return "chưa cập nhật";
    return `${n >= 0 ? "mua ròng" : "bán ròng"} ${Math.abs(n).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tỷ`;
  };
  const formatTop = (items: unknown) =>
    (Array.isArray(items) ? items : [])
      .map((item) => {
        const row = item as Record<string, unknown>;
        const ticker = String(row.ticker ?? row.symbol ?? "").toUpperCase().trim();
        const net = toNumber(row.net_bn ?? row.netBn ?? row.net);
        if (!ticker || net == null) return "";
        return `${ticker} (${Math.abs(net).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tỷ)`;
      })
      .filter(Boolean);
  const rows = Array.isArray(investorRaw?.data) ? (investorRaw.data as Array<Record<string, unknown>>) : [];
  const pickNumber = (row: Record<string, unknown>, keys: string[]) => {
    for (const key of keys) {
      const value = toNumber(row[key]);
      if (value != null) return value;
    }
    return null;
  };
  const toBn = (value: number) => (Math.abs(value) > 1_000_000 ? value / 1_000_000_000 : value);
  const topFromRows = (buyKeys: string[], sellKeys: string[], side: "buy" | "sell") =>
    rows
      .map((row) => {
        const ticker = String(row.ticker ?? row.symbol ?? "").toUpperCase().trim();
        const buy = pickNumber(row, buyKeys);
        const sell = pickNumber(row, sellKeys);
        if (!ticker || buy == null || sell == null) return null;
        return { ticker, net: toBn(buy - sell) };
      })
      .filter((row): row is { ticker: string; net: number } => row != null && (side === "buy" ? row.net > 0 : row.net < 0))
      .sort((a, b) => (side === "buy" ? b.net - a.net : a.net - b.net))
      .slice(0, 5)
      .map((row) => `${row.ticker} (${Math.abs(row.net).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tỷ)`);

  const foreign = (summary.foreign ?? {}) as Record<string, unknown>;
  const proprietary = (summary.proprietary ?? {}) as Record<string, unknown>;
  const retail = (summary.retail ?? summary.individual ?? {}) as Record<string, unknown>;
  const vnindex = snapshot.indices.find((item) => item.ticker === "VNINDEX");
  const breadth = snapshot.breadth;
  if (!vnindex || !breadth || !snapshot.liquidity) return null;

  return {
    date: dateISO,
    vnindex: vnindex.value,
    change_pct: vnindex.changePct,
    liquidity: snapshot.liquidity,
    total_liquidity: snapshot.liquidityByExchange.total ?? snapshot.liquidity,
    matched_liquidity: snapshot.liquidity,
    negotiated_liquidity: 0,
    breadth: { ...breadth, total: breadth.up + breadth.down + breadth.unchanged },
    session_summary: `VN-Index đóng cửa tại ${vnindex.value.toLocaleString("vi-VN")} điểm (${vnindex.changePct >= 0 ? "+" : ""}${vnindex.changePct.toFixed(2)}%). Thanh khoản toàn thị trường đạt ${snapshot.liquidity.toLocaleString("vi-VN", { maximumFractionDigits: 0 })} tỷ đồng.`,
    liquidity_detail: `HoSE ${snapshot.liquidityByExchange.HOSE?.toLocaleString("vi-VN", { maximumFractionDigits: 0 }) ?? "-"} tỷ | HNX ${snapshot.liquidityByExchange.HNX?.toLocaleString("vi-VN", { maximumFractionDigits: 0 }) ?? "-"} tỷ | UPCoM ${snapshot.liquidityByExchange.UPCOM?.toLocaleString("vi-VN", { maximumFractionDigits: 0 }) ?? "-"} tỷ.`,
    foreign_flow: `Khối ngoại ${formatNet(foreign.total_net_bn ?? foreign.totalNetBn ?? snapshot.investorTrading.foreign.net)}.`,
    notable_trades: "",
    outlook: "Phiên tới ưu tiên kiểm soát tỷ trọng, theo dõi phản ứng của dòng tiền tại nhóm cổ phiếu dẫn dắt và tuân thủ điểm dừng lỗ.",
    sub_indices: snapshot.indices.map((item) => ({
      name: item.ticker,
      change_pts: item.change,
      change_pct: item.changePct,
    })),
    foreign_top_buy: formatTop(foreign.top_buy ?? foreign.topBuy),
    foreign_top_sell: formatTop(foreign.top_sell ?? foreign.topSell),
    prop_trading_top_buy: formatTop(proprietary.top_buy ?? proprietary.topBuy),
    prop_trading_top_sell: formatTop(proprietary.top_sell ?? proprietary.topSell),
    individual_top_buy:
      formatTop(retail.top_buy ?? retail.topBuy).length > 0
        ? formatTop(retail.top_buy ?? retail.topBuy)
        : topFromRows(["localIndividualBuyValue", "localIndividualBuyMatchValue"], ["localIndividualSellValue", "localIndividualSellMatchValue"], "buy"),
    individual_top_sell:
      formatTop(retail.top_sell ?? retail.topSell).length > 0
        ? formatTop(retail.top_sell ?? retail.topSell)
        : topFromRows(["localIndividualBuyValue", "localIndividualBuyMatchValue"], ["localIndividualSellValue", "localIndividualSellMatchValue"], "sell"),
    sector_gainers: snapshot.topGainers.slice(0, 8).map((item) => `${item.ticker} (+${item.changePct.toFixed(2)}%)`),
    sector_losers: snapshot.topLosers.slice(0, 8).map((item) => `${item.ticker} (${item.changePct.toFixed(2)}%)`),
    buy_signals: snapshot.topGainers.slice(0, 8).map((item) => item.ticker),
    sell_signals: snapshot.topLosers.slice(0, 8).map((item) => item.ticker),
    top_breakout: snapshot.topGainers.slice(0, 8).map((item) => item.ticker),
    top_new_high: [],
  };
}

function hasCompleteEodDetail(eodDetail: FiinEodNews | null | undefined): boolean {
  if (!eodDetail) return false;
  const liquidity = Number(eodDetail.total_liquidity ?? eodDetail.liquidity ?? 0);
  const hasOutlook = typeof eodDetail.outlook === "string" && eodDetail.outlook.trim().length >= 40;
  return Number.isFinite(liquidity) && liquidity > 0 && hasOutlook && countEodDetailBuckets(eodDetail) >= 3;
}

function normalizeBackfillDateParam(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return trimmed;
}

async function handlePropTrading(
  forceRun = false,
  backfillDateISO: string | null = null,
  notify = true,
): Promise<NextResponse> {
  const startTime = Date.now();
  const dateISO = forceRun && backfillDateISO ? backfillDateISO : getVNDateISO();
  const today = forceRun && backfillDateISO
    ? getVnDateLabel(`${backfillDateISO}T00:00:00+07:00`)
    : getVNDateString();

  try {
    if (DATABASE_V2_REPLACES_V1) {
      return handleDatabaseEodPublish(forceRun, dateISO, today);
    }

    if (!forceRun && getVnMinuteOfDay() < EOD_FULL_MINUTE_VN) {
      const duration = Date.now() - startTime;
      await logCron("eod_full_19h", "skipped", "EOD Full skipped before 19:00 VN", duration, {
        nextSlot: "19:00",
      });
      return NextResponse.json({
        type: "eod_full_19h",
        skipped: true,
        reason: "before_scheduled_slot",
        nextSlot: "19:00",
      });
    }

    const existingReport = forceRun
      ? null
      : await findMarketReportForVNDate("eod_full_19h", dateISO, { notBeforeMinuteVN: 19 * 60 });
    if (existingReport) {
      const duration = Date.now() - startTime;
      await logCron("eod_full_19h", "skipped", "EOD Brief already generated for today", duration, {
        existingReportId: existingReport.id,
      });
      return NextResponse.json({
        type: "eod_full_19h",
        skipped: true,
        reason: "already_generated_today",
        reportId: existingReport.id,
        report: existingReport.content,
      });
    }

    const [propData, snapshot, canonicalEodDetail, investorRaw] = await Promise.all([
      getPropTradingData(),
      getMarketSnapshot(),
      fetchEodMarketData(dateISO).catch(() => null),
      getInvestorTradingData({ fromDate: dateISO, toDate: dateISO }).catch(() => null),
    ]);
    saveMarketOverviewCache(snapshot.marketOverview);
    const bridgeEodDetailDateKey = String(canonicalEodDetail?.date_key || "").slice(0, 10);
    const eodDetail =
      String(canonicalEodDetail?.date_key || "").slice(0, 10) === dateISO
        ? canonicalEodDetail
        : buildEodDetailFromInvestorSnapshot(dateISO, snapshot, investorRaw);

    if (!hasCompleteEodDetail(eodDetail)) {
      const duration = Date.now() - startTime;
      const retryWindow = !forceRun && getVnMinuteOfDay() <= 20 * 60;
      await logCron("eod_full_19h", "skipped", retryWindow ? "EOD waiting for complete data" : "EOD detail incomplete, keep previous complete report", duration, {
        detailBuckets: countEodDetailBuckets(eodDetail),
        eodDetailAvailable: Boolean(eodDetail),
        bridgeEodDetailDateKey,
        expectedDateKey: dateISO,
        canonicalMissingFields: canonicalEodDetail?.missingFields,
        canonicalSourceStatus: canonicalEodDetail?.sourceStatus,
      });
      return NextResponse.json({
        type: "eod_full_19h",
        published: false,
        reason: retryWindow ? "skipped_waiting_data" : "eod_detail_incomplete",
        bridgeEodDetailDateKey,
        expectedDateKey: dateISO,
        retryWindow,
        missingFields: canonicalEodDetail?.missingFields ?? [],
      });
    }

    const eodDetailDateKey = String(eodDetail?.date_key || "").slice(0, 10) || toDateKey(eodDetail?.date);
    if (eodDetailDateKey !== dateISO) {
      const duration = Date.now() - startTime;
      await logCron("eod_full_19h", "skipped", "EOD detail date mismatch, keep previous complete report", duration, {
        eodDetailDateKey,
        expectedDateKey: dateISO,
      });
      return NextResponse.json({
        type: "eod_full_19h",
        published: false,
        reason: "eod_detail_date_mismatch",
        eodDetailDateKey,
        expectedDateKey: dateISO,
      });
    }

    if (
      !hasRequiredFull19Data(snapshot) &&
      !forceRun &&
      process.env.CRON_BLOCK_MISSING_BRIEF === "1"
    ) {
      const duration = Date.now() - startTime;
      await logCron(
        "eod_full_19h",
        "skipped",
        "Thiếu dữ liệu bắt buộc cho bản tin 19:00, không publish công khai",
        duration,
          {
            availability: snapshot.investorTrading.availability,
            liquidity: snapshot.liquidity,
            liquidityByExchange: snapshot.liquidityByExchange,
            breadth: snapshot.breadth,
            breadthByExchange: snapshot.breadthByExchange,
            indices: snapshot.indices.map((item) => item.ticker),
            providerDiagnostics: snapshot.providerDiagnostics,
          },
      );
      return NextResponse.json({
        type: "eod_full_19h",
        published: false,
        reason: "missing_required_fields",
      });
    }

    if (propData) {
      await prisma.propTrading.upsert({
        where: { date: dateISO },
        update: {
          totalBuy: propData.totalBuy,
          totalSell: propData.totalSell,
          netValue: propData.netValue,
          topBuy: JSON.stringify(propData.topBuy),
          topSell: JSON.stringify(propData.topSell),
          rawData: JSON.stringify(propData),
        },
        create: {
          date: dateISO,
          totalBuy: propData.totalBuy,
          totalSell: propData.totalSell,
          netValue: propData.netValue,
          topBuy: JSON.stringify(propData.topBuy),
          topSell: JSON.stringify(propData.topSell),
          rawData: JSON.stringify(propData),
        },
      });
    }

    const safeReport = buildFull19PublicReport(today, snapshot, eodDetail);

    const savedReport = await saveMarketReport(
      "eod_full_19h",
      `Bản tin tổng hợp 19:00 ${today}`,
      safeReport,
      { snapshot, propData, eodDetail },
      {
        investorAvailability: snapshot.investorTrading.availability,
        liquidity: snapshot.liquidity,
        liquidityByExchange: snapshot.liquidityByExchange,
        breadth: snapshot.breadth,
        breadthByExchange: snapshot.breadthByExchange,
        source: snapshot.source,
        eodDetailAvailable: Boolean(eodDetail),
        eodDetailComplete: hasCompleteEodDetail(eodDetail),
        publishBlockers: snapshot.publishBlockers,
      }
    );
    await pushNotification("eod_full_19h", `🌙 Bản tin tổng hợp 19:00 ${today}`, safeReport);
    invalidateTopics({ tags: ["news", "brief", "market", "dashboard"] });
    await emitWorkflowTrigger({
      type: "brief_ready",
      source: "cron:eod_full_19h",
      payload: {
        reportType: "eod_full_19h",
        title: `Bản tin tổng hợp 19:00 ${today}`,
        content: safeReport,
        dateLabel: today,
      },
    });

    const duration = Date.now() - startTime;
    await logCron("eod_full_19h", "success", `EOD full 19h, ${duration}ms`, duration, {
      investorAvailability: snapshot.investorTrading.availability,
      providerDiagnostics: snapshot.providerDiagnostics,
      requestDateVN: snapshot.requestDateVN,
      fallbackUsed: snapshot.providerDiagnostics.length > 0,
    });
    return NextResponse.json({ type: "eod_full_19h", timestamp: new Date().toISOString(), report: safeReport });
  } catch (error) {
    await logCron("eod_full_19h", "error", String(error), Date.now() - startTime);
    return NextResponse.json({ error: "Lỗi Tự Doanh" }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
//  2. INTRADAY — 10:00, 10:30, 14:00, 14:25
//     Format Dashboard chuyên nghiệp
// ═══════════════════════════════════════════════════════════════

async function handleIntraday(forceRun = false): Promise<NextResponse> {
  const startTime = Date.now();
  const today = getVNDateString();
  const vnNow = getVnNow();
  const windowInfo = getSignalWindowInfo(vnNow.toDate(), "type2");
  const notifType = windowInfo.type;
  const timeLabel = windowInfo.label;

  try {
    const [snapshot, cafefNews] = await Promise.all([
      getMarketSnapshot(),
      fetchAllCafefNews(),
    ]);

    if (!hasRequiredStatsData(snapshot)) {
      const duration = Date.now() - startTime;
      await logCron(
        "market_stats_type2",
        "skipped",
        "Thiếu dữ liệu bắt buộc cho bản tin cập nhật thông tin, không publish công khai",
        duration,
        {
          availability: snapshot.investorTrading.availability,
          liquidity: snapshot.liquidity,
          indices: snapshot.indices.map((item) => item.ticker),
          providerDiagnostics: snapshot.providerDiagnostics,
        },
      );
      return NextResponse.json({
        type: "market_stats_type2",
        published: false,
        reason: "missing_required_fields",
      });
    }

    const vnidx = snapshot.indices.find(i => i.ticker === "VNINDEX");
    const vn30  = snapshot.indices.find(i => i.ticker === "VN30");
    const breadth = snapshot.breadth;
    const investorLines = getInvestorTradingText(snapshot, "intraday");
    const investorSection = investorLines.length > 0 ? investorLines.map((line) => `• ${line}`).join("\n") : "• Khối ngoại: chưa cập nhật";
    const liq = snapshot.liquidityByExchange;
    const fmtLiq = (v: number | null) => (v == null ? "?" : `${(v > 1_000_000 ? v / 1_000_000_000 : v).toFixed(0)} tỷ`);

  const prompt = `Bạn là AIDEN Analyst — trợ lý phân tích chuyên nghiệp của ADN Capital.
Data thực: ${formatSnapshotForAI(snapshot, { investorMode: "intraday" })}
Tin CafeF: ${buildCafefContext(cafefNews)}

Hãy viết bản tin intraday theo format Markdown Telegram dưới đây.
TUYỆT ĐỐI CHỈ dùng số liệu từ Data thực được cung cấp:

⚡ *BẢN TIN INTRADAY — ${timeLabel} ${today}*

📊 *CHỈ SỐ:*
🇻🇳 VN\\-INDEX: ${vnidx?.value ?? "N/A"} \\| ${vnidx && vnidx.changePct >= 0 ? "+" : ""}${vnidx?.changePct ?? "N/A"}%
💎 VN30: ${vn30?.value ?? "N/A"} \\| ${vn30 && vn30.changePct >= 0 ? "+" : ""}${vn30?.changePct ?? "N/A"}%

📈 *ĐỘ RỘNG & THANH KHOẢN:*
• ${breadth?.up ?? "?"} Tăng \\| ${breadth?.down ?? "?"} Giảm \\| ${breadth?.unchanged ?? "?"} Đứng
• Thanh khoản: ${snapshot.liquidity ?? "?"} tỷ VNĐ
• Thanh khoản sàn: HoSE ${fmtLiq(liq.HOSE)} \\| HNX ${fmtLiq(liq.HNX)} \\| UPCoM ${fmtLiq(liq.UPCOM)}
${investorSection}

🌐 *TIN NHANH:*
[2 tin quan trọng nhất từ CafeF, 1 dòng/tin]

⚠️ *NHẬN ĐỊNH:*
[1-2 câu ngắn gọn, dứt khoát]

_Powered by ADN Capital AI_`;

    let report = "";
    try {
      report = await generateText(prompt);
    } catch (err) {
      console.warn("[intraday] Gemini fallback:", err);
    }
    const safeReport = report?.trim() ? report : buildIntradayFallback(today, timeLabel, vnidx);
    await saveMarketReport("market_stats_update", `Market Update ${timeLabel}`, safeReport, {
      indices: snapshot.indices, breadth: snapshot.breadth, liquidity: snapshot.liquidity,
    });

    const idxInfo = vnidx ? ` | VN-Index: ${vnidx.value} (${vnidx.changePct >= 0 ? "+" : ""}${vnidx.changePct}%)` : "";
    await pushNotification(notifType, `⚡ Market Update ${timeLabel}${idxInfo}`, safeReport);
    invalidateTopics({ tags: ["market", "dashboard", "news"] });

    const duration = Date.now() - startTime;
    await logCron("market_stats_type2", "success", `${notifType}, ${duration}ms`, duration, {
      providerDiagnostics: snapshot.providerDiagnostics,
      requestDateVN: snapshot.requestDateVN,
      fallbackUsed: snapshot.providerDiagnostics.length > 0,
    });
    return NextResponse.json({ type: "market_stats_type2", notifType, timeLabel, report: safeReport, timestamp: new Date().toISOString() });
  } catch (error) {
    await logCron("market_stats_type2", "error", String(error), Date.now() - startTime);
    return NextResponse.json({ error: "Lỗi market stats" }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
//  3. SIGNAL SCAN — fixed-slot gate
//
//  Chỉ quét khi khớp 4 mốc đã chốt để bảo toàn quota.
// ═══════════════════════════════════════════════════════════════

interface PythonScanSignal {
  ticker: string;
  type: "SIEU_CO_PHIEU" | "TRUNG_HAN" | "DAU_CO" | "TAM_NGAM";
  entryPrice: number;
  reason?: string;
}

async function runSignalScanDnseShadow(signals: PythonScanSignal[]) {
  if (process.env.DNSE_SHADOW_VALIDATE_ON_SCAN !== "true") return null;
  const tickers = Array.from(
    new Set(
      signals
        .map((signal) => signal.ticker?.toUpperCase().trim())
        .filter((ticker): ticker is string => Boolean(ticker)),
    ),
  );
  if (tickers.length === 0) return null;
  return runDnseMarketDataCoverageCheck({
    tickers,
    thresholdPct: 95,
    concurrency: 6,
    limit: 80,
  }).catch((error) => ({
    provider: "dnse" as const,
    checkedAt: new Date().toISOString(),
    requested: tickers.length,
    covered: 0,
    coveragePct: 0,
    thresholdPct: 95,
    passed: false,
    missing: tickers.slice(0, 80),
    durationMs: 0,
    error: error instanceof Error ? error.message : String(error),
  }));
}

async function handleSignalScan5m(forceRun = false): Promise<NextResponse> {
  const startTime = Date.now();
  if (!isTradingDay()) {
    await logCron("signal_scan_type1", "skipped", "Không phải ngày giao dịch", 0);
    return NextResponse.json({ message: "Skipped" });
  }

  const vnNow = getVnNow();
  const hour = vnNow.hour();
  const min = vnNow.minute();
  const timeKey = `${hour}:${min.toString().padStart(2, "0")}`;

  if (!forceRun && !SIGNAL_SCAN_SLOT_SET.has(timeKey)) {
    return NextResponse.json({ message: `Fixed Gate: skip ${timeKey}` });
  }

  try {
    const todayISO = getVNDateISO();
    const windowInfo = getSignalWindowInfo(vnNow.toDate());
    const radarQuota = await getRadarMonthlyQuotaEstimate();
    const scanMode = forceRun ? "hot" : chooseRadarScanMode(timeKey, radarQuota.monthlyUsedPct);
    if (!scanMode) {
      const duration = Date.now() - startTime;
      await logCron("signal_scan_type1", "skipped", "Radar quota guard: skip non-critical scan", duration, {
        radarQuota,
        budget: RADAR_SCAN_BUDGET,
        slot: timeKey,
      });
      return NextResponse.json({
        type: "signal_scan_type1",
        skipped: true,
        reason: "quota_guard",
        radarQuota,
      });
    }

    const slot = forceRun ? "manual" : timeKey;
    const slotLabel = forceRun ? "manual" : windowInfo.label;
    const scanUrl = new URL("/api/v1/scan-now", PYTHON_BRIDGE);
    scanUrl.searchParams.set("mode", scanMode);
    const res = await fetch(scanUrl.toString(), {
      method: "POST",
      signal: AbortSignal.timeout(SIGNAL_SCAN_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Python scanner HTTP ${res.status}`);

    const scanResult: {
      detected?: number;
      estimated_quota_cost?: number;
      scan_mode?: string;
      signals?: PythonScanSignal[];
      universe_size?: number;
      watchlist_size?: number;
    } = await res.json();
    const signals = Array.isArray(scanResult.signals) ? scanResult.signals : [];
    const dnseShadow = await runSignalScanDnseShadow(signals);
    const ingestResult = await ingestSignalScanBatch({
      signals,
      detected: Number.isFinite(scanResult.detected) ? Number(scanResult.detected) : signals.length,
      tradingDate: todayISO,
      slot,
      slotLabel,
      source: "cron",
      scannedAt: new Date(),
    });

    const webNotifySignals = ingestResult.artifact.notifiedSignals;
    let telegramSignalBatchResult: unknown = null;
    let telegramActiveBatchResult: unknown = null;
    if (webNotifySignals.length > 0) {
      const signalText = webNotifySignals
        .map((signal) => `• ${signal.ticker}: ${signal.entryPrice.toLocaleString("vi-VN")} VNĐ${signal.reason ? ` — ${signal.reason}` : ""}`)
        .join("\n");
      await pushNotification(
        windowInfo.type,
        `⚡ ${slotLabel} — ${webNotifySignals.length} tín hiệu mới`,
        `## TÍN HIỆU MỚI (${slotLabel})\n\n${signalText}`,
      );
      telegramSignalBatchResult = await sendClaimedSignalsToTelegram({
        signals: webNotifySignals,
        tradingDate: todayISO,
        slotLabel,
        batchId: ingestResult.artifact.batchId,
      }).catch((error) => ({ ok: false, error: String(error) }));
    }

    if (ingestResult.activatedSignals.length > 0) {
      await Promise.all(
        ingestResult.activatedSignals.map((signal) =>
          emitWorkflowTrigger({
            type: "signal_status_changed",
            source: "cron:signal_scan_type1",
            payload: signal,
          }),
        ),
      );
      telegramActiveBatchResult = await sendActiveSignalsToTelegram({
        signals: ingestResult.activatedSignals,
        tradingDate: todayISO,
        slotLabel,
      }).catch((error) => ({ ok: false, error: String(error) }));
    }

    invalidateTopics({ tags: ["signal", "signal-scan", "broker", "portfolio"] });

    const duration = Date.now() - startTime;
    await logCron(
      "signal_scan_type1",
      "success",
      `Python scan: ${ingestResult.detected} phát hiện, tạo ${ingestResult.created}, cập nhật ${ingestResult.updated}, notify ${ingestResult.notified.length}`,
      duration,
      {
        scanned: ingestResult.detected,
        accepted: ingestResult.accepted,
        processed: ingestResult.processed.length,
        created: ingestResult.created,
        updated: ingestResult.updated,
        notified: ingestResult.notified.length,
        reconciledWebOnly: 0,
        radarScan: {
          requestedMode: scanMode,
          bridgeMode: scanResult.scan_mode ?? scanMode,
          universeSize: scanResult.universe_size ?? null,
          watchlistSize: scanResult.watchlist_size ?? null,
          marketDataShadow: dnseShadow,
          estimatedQuotaCost:
            typeof scanResult.estimated_quota_cost === "number" && Number.isFinite(scanResult.estimated_quota_cost)
              ? scanResult.estimated_quota_cost
              : scanResult.universe_size ?? 0,
        },
        radarQuota: {
          ...radarQuota,
          budget: RADAR_SCAN_BUDGET.monthlyQuota,
          estimatedCost:
            typeof scanResult.estimated_quota_cost === "number" && Number.isFinite(scanResult.estimated_quota_cost)
              ? scanResult.estimated_quota_cost
              : scanResult.universe_size ?? 0,
        },
        scanArtifact: ingestResult.artifact,
        telegramSignalBatchResult,
        telegramActiveBatchResult,
      },
    );
    const totalSignaledToday = await prisma.signalHistory.count({ where: { sentDate: todayISO } });

    return NextResponse.json({
      type: "signal_scan_type1",
      timestamp: new Date().toISOString(),
      batchId: ingestResult.artifact.batchId,
      message:
        ingestResult.created + ingestResult.updated > 0
          ? `Đồng bộ ${ingestResult.created + ingestResult.updated} tín hiệu (mới ${ingestResult.created}, cập nhật ${ingestResult.updated})`
          : "Không có tín hiệu cần đồng bộ",
      created: ingestResult.created,
      updated: ingestResult.updated,
      notified: ingestResult.notified.length,
      scanMode,
      universeSize: scanResult.universe_size ?? null,
      dnseShadowPassed: dnseShadow?.passed ?? null,
      reconciledWebOnly: 0,
      totalSignaledToday,
    });
  } catch (error) {
    await logCron("signal_scan_type1", "error", String(error), Date.now() - startTime);
    return NextResponse.json({ error: "Lỗi quét tín hiệu" }, { status: 500 });
  }
}

async function handleSignalScan5mWithMojibakeRetired(): Promise<NextResponse> {
  const startTime = Date.now();
  if (!isTradingDay()) {
    await logCron("signal_scan_type1", "skipped", "KhÃ´ng pháº£i ngÃ y giao dá»‹ch", 0);
    return NextResponse.json({ message: "Skipped" });
  }

  const vnNow = getVnNow();
  const hour = vnNow.hour();
  const min = vnNow.minute();
  const timeKey = `${hour}:${min.toString().padStart(2, "0")}`;

  if (!SIGNAL_SCAN_SLOT_SET.has(timeKey)) {
    return NextResponse.json({ message: `Fixed Gate: skip ${timeKey}` });
  }

  try {
    const todayISO = getVNDateISO();
    const windowInfo = getSignalWindowInfo(vnNow.toDate());
    const res = await fetch(`${PYTHON_BRIDGE}/api/v1/scan-now`, {
      method: "POST",
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) throw new Error(`Python scanner HTTP ${res.status}`);

    const scanResult: { detected?: number; signals?: PythonScanSignal[] } = await res.json();
    const signals = Array.isArray(scanResult.signals) ? scanResult.signals : [];
    const ingestResult = await ingestSignalScanBatch({
      signals,
      detected: Number.isFinite(scanResult.detected) ? Number(scanResult.detected) : signals.length,
      tradingDate: todayISO,
      slot: timeKey,
      slotLabel: windowInfo.label,
      source: "cron",
      scannedAt: new Date(),
    });

    const webNotifySignals = ingestResult.artifact.notifiedSignals;
    if (webNotifySignals.length > 0) {
      const signalText = webNotifySignals
        .map((signal) => `â€¢ ${signal.ticker}: ${signal.entryPrice.toLocaleString("vi-VN")} VNÄ${signal.reason ? ` â€” ${signal.reason}` : ""}`)
        .join("\n");
      await pushNotification(
        windowInfo.type,
        `âš¡ ${windowInfo.label} â€” ${webNotifySignals.length} tÃ­n hiá»‡u má»›i`,
        `## TÃN HIá»†U Má»šI (${windowInfo.label})\n\n${signalText}`,
      );
      await sendClaimedSignalsToTelegram({
        signals: webNotifySignals,
        tradingDate: todayISO,
        slotLabel: windowInfo.label,
        batchId: ingestResult.artifact.batchId,
      });
    }

    if (ingestResult.activatedSignals.length > 0) {
      await Promise.all(
        ingestResult.activatedSignals.map((signal) =>
          emitWorkflowTrigger({
            type: "signal_status_changed",
            source: "cron:signal_scan_type1",
            payload: signal,
          }),
        ),
      );
    }

    invalidateTopics({ tags: ["signal", "signal-scan", "broker", "portfolio"] });

    const duration = Date.now() - startTime;
    await logCron(
      "signal_scan_type1",
      "success",
      `Python scan: ${ingestResult.detected} phÃ¡t hiá»‡n, táº¡o ${ingestResult.created}, cáº­p nháº­t ${ingestResult.updated}, notify ${ingestResult.notified.length}`,
      duration,
      {
        scanned: ingestResult.detected,
        accepted: ingestResult.accepted,
        processed: ingestResult.processed.length,
        created: ingestResult.created,
        updated: ingestResult.updated,
        notified: ingestResult.notified.length,
        reconciledWebOnly: 0,
        scanArtifact: ingestResult.artifact,
      },
    );

    const totalSignaledToday = await prisma.signalHistory.count({ where: { sentDate: todayISO } });

    return NextResponse.json({
      type: "signal_scan_type1",
      timestamp: new Date().toISOString(),
      batchId: ingestResult.artifact.batchId,
      message:
        ingestResult.created + ingestResult.updated > 0
          ? `Äá»“ng bá»™ ${ingestResult.created + ingestResult.updated} tÃ­n hiá»‡u (má»›i ${ingestResult.created}, cáº­p nháº­t ${ingestResult.updated})`
          : "KhÃ´ng cÃ³ tÃ­n hiá»‡u cáº§n Ä‘á»“ng bá»™",
      created: ingestResult.created,
      updated: ingestResult.updated,
      notified: ingestResult.notified.length,
      reconciledWebOnly: 0,
      totalSignaledToday,
    });
  } catch (error) {
    await logCron("signal_scan_type1", "error", String(error), Date.now() - startTime);
    return NextResponse.json({ error: "Lá»—i quÃ©t tÃ­n hiá»‡u" }, { status: 500 });
  }
}
/* legacy signal scanner retired after DataHub ingest split.
async function handleSignalScan5mLegacy(): Promise<NextResponse> {
  const startTime = Date.now();
  if (!isTradingDay()) {
    await logCron("signal_scan_type1", "skipped", "Không phải ngày giao dịch", 0);
    return NextResponse.json({ message: "Skipped" });
  }

  const vnNow = getVnNow();
  const hour = vnNow.hour();
  const min = vnNow.minute();
  const timeKey = `${hour}:${min.toString().padStart(2, "0")}`;

  // ── Fixed Gate ─────────────────────────────────────────────────────
  //  Chỉ cho phép quét đúng 4 mốc:
  //  10:00, 10:30, 14:00, 14:25
  // ──────────────────────────────────────────────────────────────────
  if (!SIGNAL_SCAN_SLOT_SET.has(timeKey)) {
    return NextResponse.json({ message: `Fixed Gate: skip ${timeKey}` });
  }

  try {
    // Lấy mã đã báo hôm nay
    const todayISO = getVNDateISO();
    const sentTodayRows = await prisma.signalHistory.findMany({
      where: { sentDate: todayISO },
      select: { ticker: true, signalType: true },
    });
    const alreadySent = new Set(sentTodayRows.map((r) => toSignalKey(r.ticker, r.signalType)));

    // 1 API call → Python scanner
    const res = await fetch(`${PYTHON_BRIDGE}/api/v1/scan-now`, { method: "POST", signal: AbortSignal.timeout(90_000) });
    if (!res.ok) throw new Error(`Python scanner HTTP ${res.status}`);
    const scanResult: { detected: number; signals: PythonScanSignal[] } = await res.json();

    const validSignals = scanResult.signals.filter((s) =>
      s?.ticker &&
      typeof s?.entryPrice === "number" &&
      ["SIEU_CO_PHIEU", "TRUNG_HAN", "DAU_CO", "TAM_NGAM"].includes(s?.type)
    );
    const uniqueSignals = Array.from(
      new Map(validSignals.map((s) => [toSignalKey(s.ticker, s.type), s])).values()
    );
    const processed = await processSignals(uniqueSignals);
    const aiBrokerConfig = await getAiBrokerRuntimeConfig();

    const startOfDay = getVnNow().startOf("day").toDate();
    const todaySignals = await prisma.signal.findMany({
      where: { createdAt: { gte: startOfDay } },
      select: { id: true, ticker: true, type: true, status: true, entryPrice: true },
    });
    const existingMap = new Map(todaySignals.map((s) => [toSignalKey(s.ticker, s.type), s]));

    let createdCount = 0;
    let updatedCount = 0;
    const createCandidatesForNotify: PythonScanSignal[] = [];
    const activatedSignals: Array<{
      ticker: string;
      signalType: string;
      fromStatus: string;
      toStatus: string;
      entryPrice: number;
      reason: string | null;
    }> = [];

    const operations = processed.map((s) => {
      const normalizedTicker = s.ticker.toUpperCase().trim();
      const key = toSignalKey(normalizedTicker, s.type);
      const existing = existingMap.get(key);
      const autoActivate = shouldAutoActivateSignal(
        {
          entryPrice: s.entryPrice,
          currentPrice: s.entryPrice,
          winRate: s.winRate,
          rrRatio: s.rrRatio,
        },
        aiBrokerConfig
      );
      const nextStatus =
        existing?.status === "CLOSED"
          ? "CLOSED"
          : autoActivate
          ? "ACTIVE"
          : s.status;

      if (existing) {
        updatedCount += 1;
        if (existing.status !== nextStatus && nextStatus === "ACTIVE") {
          activatedSignals.push({
            ticker: normalizedTicker,
            signalType: s.type,
            fromStatus: existing.status,
            toStatus: nextStatus,
            entryPrice: s.entryPrice,
            reason: s.reason ?? null,
          });
        }
        const isExistingLive = existing.status === "ACTIVE" || existing.status === "HOLD_TO_DIE";
        const isNextLive = nextStatus === "ACTIVE" || nextStatus === "HOLD_TO_DIE";
        const effectiveEntryPrice =
          isExistingLive && isNextLive && existing.entryPrice > 0 ? existing.entryPrice : s.entryPrice;
        const livePayload =
          isNextLive && s.entryPrice > 0 && effectiveEntryPrice > 0
            ? {
                currentPrice: s.entryPrice,
                currentPnl: +(((s.entryPrice - effectiveEntryPrice) / effectiveEntryPrice) * 100).toFixed(2),
              }
            : {};

        return prisma.signal.update({
          where: { id: existing.id },
          data: {
            status: nextStatus,
            entryPrice: effectiveEntryPrice,
            tier: s.tier,
            navAllocation: s.navAllocation,
            target: s.target,
            stoploss: s.stoploss,
            triggerSignal: s.triggerSignal,
            aiReasoning: s.aiReasoning,
            reason: s.reason ?? null,
            winRate: s.winRate,
            sharpeRatio: s.sharpeRatio,
            rrRatio: s.rrRatio,
            ...livePayload,
          },
        });
      }

      createdCount += 1;
      if (nextStatus === "ACTIVE") {
        activatedSignals.push({
          ticker: normalizedTicker,
          signalType: s.type,
          fromStatus: "NEW",
          toStatus: nextStatus,
          entryPrice: s.entryPrice,
          reason: s.reason ?? null,
        });
      }
      createCandidatesForNotify.push({
        ticker: normalizedTicker,
        type: s.type,
        entryPrice: s.entryPrice,
        reason: s.reason,
      });
      return prisma.signal.create({
        data: {
          ticker: normalizedTicker,
          type: s.type,
          status: nextStatus,
          tier: s.tier,
          entryPrice: s.entryPrice,
          target: s.target,
          stoploss: s.stoploss,
          navAllocation: s.navAllocation,
          triggerSignal: s.triggerSignal,
          aiReasoning: s.aiReasoning,
          reason: s.reason ?? null,
          winRate: s.winRate,
          sharpeRatio: s.sharpeRatio,
          rrRatio: s.rrRatio,
          ...(nextStatus === "ACTIVE"
            ? {
                currentPrice: s.entryPrice,
                currentPnl: 0,
              }
            : {}),
        },
      });
    });

    if (operations.length > 0) {
      await prisma.$transaction(operations);
      await rebalanceActiveBasketNav(aiBrokerConfig.maxTotalNav);
    }

    const notifySignals = await claimSignalNotifications(createCandidatesForNotify, todayISO);
    const webNotifySignals = notifySignals;

    if (webNotifySignals.length > 0) {
      const signalText = webNotifySignals
        .map((s) => `• ${s.ticker}: ${s.entryPrice.toLocaleString("vi-VN")} VNĐ${s.reason ? ` — ${s.reason}` : ""}`)
        .join("\n");
      const windowInfo = getSignalWindowInfo(vnNow.toDate());
      await pushNotification(
        windowInfo.type,
        `⚡ ${windowInfo.label} — ${webNotifySignals.length} tín hiệu mới`,
        `## TÍN HIỆU MỚI (${windowInfo.label})\n\n${signalText}`
      );
    }
    if (activatedSignals.length > 0) {
      await Promise.all(
        activatedSignals.map((signal) =>
          emitWorkflowTrigger({
            type: "signal_status_changed",
            source: "cron:signal_scan_type1",
            payload: signal,
          }),
        ),
      );
    }
    invalidateTopics({ tags: ["signal", "broker", "portfolio"] });

    const duration = Date.now() - startTime;
    await logCron("signal_scan_type1", "success",
      `Python scan: ${scanResult.detected} phát hiện, tạo ${createdCount}, cập nhật ${updatedCount}, notify ${notifySignals.length}`,
      duration,
      {
        scanned: scanResult.detected,
        created: createdCount,
        updated: updatedCount,
        notified: notifySignals.length,
        reconciledWebOnly: 0,
      }
    );

    return NextResponse.json({
      type: "signal_scan_type1",
      timestamp: new Date().toISOString(),
      message:
        createdCount + updatedCount > 0
          ? `Đồng bộ ${createdCount + updatedCount} tín hiệu (mới ${createdCount}, cập nhật ${updatedCount})`
          : "Không có tín hiệu cần đồng bộ",
      created: createdCount,
      updated: updatedCount,
      notified: notifySignals.length,
      reconciledWebOnly: 0,
      totalSignaledToday: alreadySent.size + notifySignals.length,
    });
  } catch (error) {
    await logCron("signal_scan_type1", "error", String(error), Date.now() - startTime);
    return NextResponse.json({ error: "Lỗi quét tín hiệu" }, { status: 500 });
  }
}
*/

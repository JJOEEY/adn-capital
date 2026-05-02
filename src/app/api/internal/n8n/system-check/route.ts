import { NextRequest, NextResponse } from "next/server";
import { CANONICAL_CRON_TYPES, cronAliasesForCanonical, normalizeCronType } from "@/lib/cron-contracts";
import { getTopicCacheInspections } from "@/lib/datahub/core";
import { prisma } from "@/lib/prisma";
import {
  getPublicBaseUrl,
  isN8nAuthorized,
  nowForOpsLabel,
  readDataHubTopics,
  sendAdminTelegram,
  topicHasUsableValue,
  unauthorizedResponse,
  writeN8nLog,
} from "@/lib/n8n/internal";
import { getVnDateISO, isVnTradingDay } from "@/lib/time";

export const dynamic = "force-dynamic";

const CRITICAL_TOPICS = [
  "brief:morning:latest",
  "brief:close:latest",
  "brief:eod:latest",
  "signal:market:radar",
  "signal:reported:today",
  "vn:index:overview",
];

function hoursSince(date: Date | null | undefined) {
  if (!date) return Number.POSITIVE_INFINITY;
  return (Date.now() - date.getTime()) / 3_600_000;
}

function formatAge(date: Date | null | undefined) {
  if (!date) return "chua co log";
  const hours = hoursSince(date);
  if (hours < 1) return `${Math.round(hours * 60)} phut truoc`;
  return `${hours.toFixed(1)} gio truoc`;
}

function statusRank(status?: string | null) {
  if (status === "error") return 3;
  if (status === "skipped") return 2;
  if (status === "success") return 1;
  return 0;
}

function latestForCron(
  rows: Array<{ cronName: string; status: string; message: string | null; createdAt: Date }>,
  cronType: string,
) {
  return rows.find((row) => normalizeCronType(row.cronName) === cronType) ?? null;
}

export async function GET(req: NextRequest) {
  if (!isN8nAuthorized(req)) return unauthorizedResponse();

  const startedAt = Date.now();
  const shouldSend = req.nextUrl.searchParams.get("send") === "1";
  const sendOk = req.nextUrl.searchParams.get("sendOk") === "1";
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  const tradingDay = isVnTradingDay();
  const today = getVnDateISO();
  const allCronAliases = Array.from(new Set(CANONICAL_CRON_TYPES.flatMap((cronType) => cronAliasesForCanonical(cronType))));

  const [topics, latestArticles, cronRows, dbCounts, quotaToday, activeOverrides] = await Promise.all([
    readDataHubTopics(CRITICAL_TOPICS),
    prisma.article.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, status: true, createdAt: true, publishedAt: true },
    }),
    prisma.cronLog.findMany({
      where: { cronName: { in: allCronAliases } },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { cronName: true, status: true, message: true, createdAt: true },
    }),
    Promise.all([
      prisma.user.count(),
      prisma.notification.count(),
      prisma.marketReport.count(),
      prisma.signal.count(),
    ]),
    prisma.chatUsageDaily.aggregate({
      where: { dateKey: today },
      _sum: { usedCount: true },
      _max: { usedCount: true },
      _count: { id: true },
    }),
    prisma.adminChatQuotaOverride.findMany({
      where: { active: true },
      select: { usedQuota: true, totalQuota: true },
    }),
  ]);

  const warnings: string[] = [];
  const errors: string[] = [];

  for (const envelope of topics) {
    if (envelope.error || envelope.freshness === "error") {
      errors.push(`${envelope.topic}: ${envelope.error?.code ?? "loi tai du lieu"}`);
    } else if (!topicHasUsableValue(envelope)) {
      warnings.push(`${envelope.topic}: chua co du lieu kha dung`);
    } else if (envelope.freshness === "stale" || envelope.freshness === "expired") {
      warnings.push(`${envelope.topic}: du lieu ${envelope.freshness}`);
    }
  }

  const latestCrons = CANONICAL_CRON_TYPES.map((cronType) => {
    const rows = cronRows.filter((row) => normalizeCronType(row.cronName) === cronType);
    const lastRun = rows[0] ?? null;
    const lastSuccess = rows.find((row) => row.status === "success") ?? null;
    const lastProblem = rows
      .filter((row) => row.status !== "success")
      .sort((a, b) => statusRank(b.status) - statusRank(a.status))[0] ?? null;
    return { cronType, lastRun, lastSuccess, lastProblem };
  });

  const morningCron = latestForCron(cronRows, "morning_brief");
  const closeCron = latestForCron(cronRows, "close_brief_15h");
  const eodCron = latestForCron(cronRows, "eod_full_19h");
  const newsCron = latestForCron(cronRows, "news_crawler");

  if (tradingDay && hoursSince(morningCron?.createdAt) > 36) {
    warnings.push(`Ban tin sang stale: ${formatAge(morningCron?.createdAt)}`);
  }
  if (tradingDay && hoursSince(closeCron?.createdAt) > 36) {
    warnings.push(`Ban tin ket phien stale: ${formatAge(closeCron?.createdAt)}`);
  }
  if (tradingDay && hoursSince(eodCron?.createdAt) > 36) {
    warnings.push(`Ban tin EOD stale: ${formatAge(eodCron?.createdAt)}`);
  }
  if (hoursSince(newsCron?.createdAt) > 36) {
    warnings.push(`Crawler tin tuc stale: ${formatAge(newsCron?.createdAt)}`);
  }

  for (const cron of latestCrons) {
    if (cron.lastRun?.status === "error") {
      errors.push(`${cron.cronType}: ${cron.lastRun.message ?? "cron gan nhat bao loi"}`);
    }
  }

  if (latestArticles.length === 0) {
    warnings.push("Tin tuc: chua co bai crawl trong he thong");
  } else if (hoursSince(latestArticles[0].createdAt) > 72) {
    warnings.push(`Tin tuc: bai moi nhat ${formatAge(latestArticles[0].createdAt)}`);
  }

  const depletedOverrides = activeOverrides.filter((row) => row.usedQuota >= row.totalQuota).length;
  if (depletedOverrides > 0) {
    warnings.push(`AIDEN: ${depletedOverrides} goi quota admin da dung het`);
  }

  const cache = getTopicCacheInspections();
  const staleCacheCount = cache.filter((item) => item.freshness === "stale" || item.freshness === "expired" || item.freshness === "error").length;
  const ok = errors.length === 0 && warnings.length === 0;
  const issues = [...errors.map((message) => ({ level: "error", message })), ...warnings.map((message) => ({ level: "warning", message }))];
  const baseUrl = getPublicBaseUrl();
  const text = [
    `ADN Capital - kiem tra he thong ${nowForOpsLabel()}`,
    ok ? "Trang thai: on dinh" : "Trang thai: can kiem tra",
    "",
    errors.length > 0 ? `Loi:\n${errors.map((item) => `- ${item}`).join("\n")}` : "",
    warnings.length > 0 ? `Canh bao:\n${warnings.map((item) => `- ${item}`).join("\n")}` : "",
    "",
    `Dashboard van hanh: ${baseUrl}/admin/cron-health`,
  ].filter(Boolean).join("\n");

  const telegram = shouldSend && (!ok || sendOk)
    ? await sendAdminTelegram(text, {
        dedupeKey: `telegram:n8n:system-check:${today}:${ok ? "ok" : "issue"}`,
        dryRun,
      })
    : { ok: true, skipped: true, reason: ok ? "healthy_no_send" : "send_not_requested" };

  await writeN8nLog(
    "n8n:system-check",
    ok ? "success" : errors.length > 0 ? "error" : "skipped",
    ok ? "system healthy" : "system has warnings/errors",
    { ok, warnings, errors, issues: issues.length, sent: shouldSend, dryRun, staleCacheCount },
    startedAt,
  );

  return NextResponse.json({
    ok,
    tradingDay,
    dryRun,
    errors,
    warnings,
    issues,
    telegram,
    topics: topics.map((envelope) => ({
      topic: envelope.topic,
      freshness: envelope.freshness,
      hasValue: topicHasUsableValue(envelope),
      error: envelope.error?.code ?? null,
      updatedAt: envelope.updatedAt,
    })),
    cache: {
      total: cache.length,
      staleCount: staleCacheCount,
      byFamily: cache.reduce<Record<string, number>>((acc, row) => {
        acc[row.family] = (acc[row.family] ?? 0) + 1;
        return acc;
      }, {}),
    },
    latestCrons,
    latestArticles,
    quota: {
      dateKey: today,
      activeOverrides: activeOverrides.length,
      depletedOverrides,
      usersWithUsage: quotaToday._count.id,
      totalMessagesToday: quotaToday._sum.usedCount ?? 0,
      maxMessagesByOneUser: quotaToday._max.usedCount ?? 0,
    },
    counts: {
      users: dbCounts[0],
      notifications: dbCounts[1],
      marketReports: dbCounts[2],
      signals: dbCounts[3],
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
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
  "brief:eod:latest",
  "signal:market:radar",
  "signal:reported:today",
  "vn:index:overview",
];

const CANONICAL_CRONS = [
  "morning_brief",
  "eod_brief",
  "signal_scan_type1",
  "market_stats_type2",
  "crawler_news",
];

function hoursSince(date: Date | null | undefined) {
  if (!date) return Number.POSITIVE_INFINITY;
  return (Date.now() - date.getTime()) / 3_600_000;
}

function formatAge(date: Date | null | undefined) {
  if (!date) return "chưa có log";
  const hours = hoursSince(date);
  if (hours < 1) return `${Math.round(hours * 60)} phút trước`;
  return `${hours.toFixed(1)} giờ trước`;
}

export async function GET(req: NextRequest) {
  if (!isN8nAuthorized(req)) return unauthorizedResponse();

  const startedAt = Date.now();
  const shouldSend = req.nextUrl.searchParams.get("send") === "1";
  const sendOk = req.nextUrl.searchParams.get("sendOk") === "1";
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  const tradingDay = isVnTradingDay();

  const [topics, latestArticles, latestCrons, dbCounts] = await Promise.all([
    readDataHubTopics(CRITICAL_TOPICS),
    prisma.article.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, status: true, createdAt: true, publishedAt: true },
    }),
    Promise.all(
      CANONICAL_CRONS.map((cronName) =>
        prisma.cronLog.findFirst({
          where: { cronName },
          orderBy: { createdAt: "desc" },
          select: { cronName: true, status: true, message: true, createdAt: true },
        }),
      ),
    ),
    Promise.all([
      prisma.user.count(),
      prisma.notification.count(),
      prisma.marketReport.count(),
      prisma.signal.count(),
    ]),
  ]);

  const warnings: string[] = [];
  const errors: string[] = [];

  for (const envelope of topics) {
    if (envelope.error || envelope.freshness === "error") {
      errors.push(`${envelope.topic}: ${envelope.error?.code ?? "lỗi tải dữ liệu"}`);
    } else if (!topicHasUsableValue(envelope)) {
      warnings.push(`${envelope.topic}: chưa có dữ liệu usable`);
    }
  }

  const morningCron = latestCrons.find((row) => row?.cronName === "morning_brief");
  const eodCron = latestCrons.find((row) => row?.cronName === "eod_brief");
  if (tradingDay && hoursSince(morningCron?.createdAt) > 36) {
    warnings.push(`Bản tin sáng stale: ${formatAge(morningCron?.createdAt)}`);
  }
  if (tradingDay && hoursSince(eodCron?.createdAt) > 36) {
    warnings.push(`Bản tin EOD stale: ${formatAge(eodCron?.createdAt)}`);
  }

  for (const cron of latestCrons) {
    if (cron?.status === "error") {
      errors.push(`${cron.cronName}: ${cron.message ?? "cron gần nhất báo lỗi"}`);
    }
  }

  if (latestArticles.length === 0) {
    warnings.push("Tin tức: chưa có bài crawl nào trong hệ thống");
  } else if (hoursSince(latestArticles[0].createdAt) > 72) {
    warnings.push(`Tin tức: bài mới nhất ${formatAge(latestArticles[0].createdAt)}`);
  }

  const ok = errors.length === 0 && warnings.length === 0;
  const baseUrl = getPublicBaseUrl();
  const text = [
    `ADN Capital - kiểm tra hệ thống ${nowForOpsLabel()}`,
    ok ? "Trạng thái: ổn định" : "Trạng thái: cần kiểm tra",
    "",
    errors.length > 0 ? `Lỗi:\n${errors.map((item) => `- ${item}`).join("\n")}` : "",
    warnings.length > 0 ? `Cảnh báo:\n${warnings.map((item) => `- ${item}`).join("\n")}` : "",
    "",
    `Dashboard vận hành: ${baseUrl}/admin/cron-health`,
  ].filter(Boolean).join("\n");

  const telegram = shouldSend && (!ok || sendOk)
    ? await sendAdminTelegram(text, {
        dedupeKey: `telegram:n8n:system-check:${getVnDateISO()}:${ok ? "ok" : "issue"}`,
        dryRun,
      })
    : { ok: true, skipped: true, reason: ok ? "healthy_no_send" : "send_not_requested" };

  await writeN8nLog(
    "n8n:system-check",
    ok ? "success" : errors.length > 0 ? "error" : "skipped",
    ok ? "system healthy" : "system has warnings/errors",
    { ok, warnings, errors, sent: shouldSend, dryRun },
    startedAt,
  );

  return NextResponse.json({
    ok,
    tradingDay,
    dryRun,
    errors,
    warnings,
    telegram,
    topics: topics.map((envelope) => ({
      topic: envelope.topic,
      freshness: envelope.freshness,
      hasValue: topicHasUsableValue(envelope),
      error: envelope.error?.code ?? null,
      updatedAt: envelope.updatedAt,
    })),
    latestCrons,
    latestArticles,
    counts: {
      users: dbCounts[0],
      notifications: dbCounts[1],
      marketReports: dbCounts[2],
      signals: dbCounts[3],
    },
  });
}

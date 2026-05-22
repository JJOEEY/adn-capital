import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentDbUser } from "@/lib/current-user";
import { CANONICAL_CRON_TYPES, CanonicalCronType, cronAliasesForCanonical, normalizeCronType } from "@/lib/cron-contracts";
import { emitObservabilityEvent } from "@/lib/observability";
import { getVnNow, isVnTradingDay, isWithinVnTradingSession } from "@/lib/time";

export const dynamic = "force-dynamic";

function isAuthorizedByInternalKey(req: NextRequest) {
  const expected = (process.env.INTERNAL_API_KEY ?? process.env.CRON_SECRET ?? "").trim();
  if (!expected) return false;
  const provided = (req.headers.get("x-internal-key") ?? req.headers.get("x-cron-secret") ?? "").trim();
  return provided === expected;
}

type CronJobPolicy = {
  slotsMinutes: number[];
  staleGraceMinutes: number;
  tradingWindowOnly: boolean;
};

const NEWS_CRAWLER_SLOTS = Array.from({ length: 32 }, (_, index) => 7 * 60 + index * 30);
const SIGNAL_SCAN_INTRADAY_SLOTS = Array.from({ length: 70 }, (_, index) => 9 * 60 + index * 5)
  .filter((minute) => minute <= 14 * 60 + 45);

const CRON_JOB_POLICIES: Record<CanonicalCronType, CronJobPolicy> = {
  signal_scan_type1: {
    slotsMinutes: SIGNAL_SCAN_INTRADAY_SLOTS,
    staleGraceMinutes: 12,
    tradingWindowOnly: true,
  },
  market_stats_type2: {
    slotsMinutes: [10 * 60, 11 * 60 + 30, 14 * 60, 14 * 60 + 45],
    staleGraceMinutes: 45,
    tradingWindowOnly: true,
  },
  morning_brief: {
    slotsMinutes: [8 * 60],
    staleGraceMinutes: 90,
    tradingWindowOnly: false,
  },
  close_brief_15h: {
    slotsMinutes: [15 * 60],
    staleGraceMinutes: 90,
    tradingWindowOnly: false,
  },
  eod_full_19h: {
    slotsMinutes: [19 * 60],
    staleGraceMinutes: 120,
    tradingWindowOnly: false,
  },
  news_crawler: {
    slotsMinutes: NEWS_CRAWLER_SLOTS,
    staleGraceMinutes: 90,
    tradingWindowOnly: false,
  },
  adn_rank_15h: {
    slotsMinutes: [15 * 60],
    staleGraceMinutes: 90,
    tradingWindowOnly: false,
  },
  pulse_smartflow_precompute: {
    slotsMinutes: [15 * 60 + 10, 19 * 60 + 10],
    staleGraceMinutes: 90,
    tradingWindowOnly: false,
  },
  art_daily_1905: {
    slotsMinutes: [19 * 60 + 5],
    staleGraceMinutes: 120,
    tradingWindowOnly: false,
  },
  database_news_collect: {
    slotsMinutes: NEWS_CRAWLER_SLOTS,
    staleGraceMinutes: 90,
    tradingWindowOnly: false,
  },
  database_dnse_market_collect: {
    slotsMinutes: SIGNAL_SCAN_INTRADAY_SLOTS,
    staleGraceMinutes: 15,
    tradingWindowOnly: true,
  },
  database_morning_readiness: {
    slotsMinutes: [7 * 60 + 55],
    staleGraceMinutes: 60,
    tradingWindowOnly: false,
  },
  database_morning_brief: {
    slotsMinutes: [8 * 60],
    staleGraceMinutes: 90,
    tradingWindowOnly: false,
  },
  database_eod_collect: {
    slotsMinutes: [15 * 60 + 10, 19 * 60, 19 * 60 + 5, 19 * 60 + 10, 19 * 60 + 20, 19 * 60 + 30, 19 * 60 + 45],
    staleGraceMinutes: 120,
    tradingWindowOnly: false,
  },
  database_eod_readiness: {
    slotsMinutes: [20 * 60],
    staleGraceMinutes: 120,
    tradingWindowOnly: false,
  },
  database_radar_realtime_collect: {
    slotsMinutes: SIGNAL_SCAN_INTRADAY_SLOTS,
    staleGraceMinutes: 3,
    tradingWindowOnly: true,
  },
  database_realtime_health: {
    slotsMinutes: SIGNAL_SCAN_INTRADAY_SLOTS.filter((minute) => minute % 5 === 0),
    staleGraceMinutes: 10,
    tradingWindowOnly: true,
  },
  database_adn_signal_core_universe_collect: {
    slotsMinutes: [8 * 60 + 20, 15 * 60 + 20],
    staleGraceMinutes: 24 * 60,
    tradingWindowOnly: false,
  },
  database_adn_radar_collect: {
    slotsMinutes: [10 * 60 + 5, 10 * 60 + 35, 14 * 60 + 5, 14 * 60 + 30],
    staleGraceMinutes: 45,
    tradingWindowOnly: true,
  },
  database_adn_radar_readiness: {
    slotsMinutes: [10 * 60 + 40, 14 * 60 + 35],
    staleGraceMinutes: 60,
    tradingWindowOnly: true,
  },
  database_adn_art_collect: {
    slotsMinutes: SIGNAL_SCAN_INTRADAY_SLOTS,
    staleGraceMinutes: 15,
    tradingWindowOnly: true,
  },
  database_adn_art_readiness: {
    slotsMinutes: [10 * 60, 11 * 60 + 30, 14 * 60, 14 * 60 + 45],
    staleGraceMinutes: 45,
    tradingWindowOnly: true,
  },
  database_adncore_collect: {
    slotsMinutes: [15 * 60 + 5, 15 * 60 + 20],
    staleGraceMinutes: 90,
    tradingWindowOnly: false,
  },
  database_adncore_readiness: {
    slotsMinutes: [15 * 60 + 30],
    staleGraceMinutes: 120,
    tradingWindowOnly: false,
  },
  database_adn_rank_collect: {
    slotsMinutes: [15 * 60],
    staleGraceMinutes: 90,
    tradingWindowOnly: false,
  },
  database_adn_rank_readiness: {
    slotsMinutes: [15 * 60 + 10],
    staleGraceMinutes: 90,
    tradingWindowOnly: false,
  },
  database_aiden_context_collect: {
    slotsMinutes: Array.from({ length: 32 }, (_, index) => 8 * 60 + index * 15).filter((minute) => minute <= 15 * 60 + 45),
    staleGraceMinutes: 45,
    tradingWindowOnly: false,
  },
};

function toMinuteLabel(totalMinutes: number) {
  const hh = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const mm = (totalMinutes % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

function getSlotStartForDay(now: Date, totalMinutes: number) {
  const slot = new Date(now);
  slot.setHours(0, 0, 0, 0);
  slot.setMinutes(totalMinutes);
  return slot;
}

function computeStaleness(args: {
  now: Date;
  policy: CronJobPolicy;
  lastSuccessAt?: Date | null;
}) {
  const { now, policy, lastSuccessAt } = args;
  if (!isVnTradingDay(now)) {
    return {
      isStale: false,
      reason: "non_trading_day",
      expectedSlot: null as string | null,
      staleGraceMinutes: policy.staleGraceMinutes,
    };
  }

  if (policy.tradingWindowOnly && !isWithinVnTradingSession(now)) {
    return {
      isStale: false,
      reason: "outside_trading_session",
      expectedSlot: null as string | null,
      staleGraceMinutes: policy.staleGraceMinutes,
    };
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const dueSlots = policy.slotsMinutes.filter((slot) => nowMinutes >= slot + policy.staleGraceMinutes);
  if (dueSlots.length === 0) {
    return {
      isStale: false,
      reason: "not_due_yet",
      expectedSlot: null as string | null,
      staleGraceMinutes: policy.staleGraceMinutes,
    };
  }

  const expectedSlotMinutes = dueSlots[dueSlots.length - 1];
  const expectedSlotAt = getSlotStartForDay(now, expectedSlotMinutes);
  const stale = !lastSuccessAt || lastSuccessAt.getTime() < expectedSlotAt.getTime();

  return {
    isStale: stale,
    reason: stale ? "missing_or_old_success_for_slot" : "ok",
    expectedSlot: toMinuteLabel(expectedSlotMinutes),
    staleGraceMinutes: policy.staleGraceMinutes,
  };
}

function safeDuration(value: number | null) {
  return typeof value === "number" ? value : null;
}

export async function GET(req: NextRequest) {
  try {
    const internalAuthorized = isAuthorizedByInternalKey(req);
    const dbUser = internalAuthorized ? null : await getCurrentDbUser();
    if (!internalAuthorized && (!dbUser || dbUser.systemRole !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allKnownCronNames = Array.from(
      new Set(CANONICAL_CRON_TYPES.flatMap((cronType) => cronAliasesForCanonical(cronType))),
    );

    const [cronRows, lastSignal] = await Promise.all([
      prisma.cronLog.findMany({
        where: {
          OR: allKnownCronNames.map((cronName) => ({ cronName })),
        },
        orderBy: { createdAt: "desc" },
        take: 500,
        select: {
          id: true,
          cronName: true,
          status: true,
          message: true,
          duration: true,
          createdAt: true,
        },
      }),
      prisma.signal.findFirst({
        orderBy: { createdAt: "desc" },
        select: { id: true, ticker: true, type: true, createdAt: true },
      }),
    ]);

    const now = getVnNow().toDate();
    const jobs = CANONICAL_CRON_TYPES.map((cronType) => {
      const aliases = cronAliasesForCanonical(cronType);
      const rows = cronRows.filter((row) => normalizeCronType(row.cronName) === cronType);
      const lastRun = rows[0] ?? null;
      const lastSuccess = rows.find((row) => row.status === "success") ?? null;
      const lastError = rows.find((row) => row.status === "error") ?? null;
      const minutesSinceLastRun = lastRun
        ? Math.floor((now.getTime() - new Date(lastRun.createdAt).getTime()) / 60_000)
        : null;
      const staleness = computeStaleness({
        now,
        policy: CRON_JOB_POLICIES[cronType],
        lastSuccessAt: lastSuccess ? new Date(lastSuccess.createdAt) : null,
      });

      return {
        cronType,
        aliases,
        sourceOfTruth: "canonical",
        usesLegacyAliasInLastRun: !!lastRun && lastRun.cronName !== cronType,
        staleGraceMinutes: staleness.staleGraceMinutes,
        expectedSlot: staleness.expectedSlot,
        staleReason: staleness.reason,
        isStale: staleness.isStale,
        lastRun: lastRun
          ? {
              id: lastRun.id,
              cronName: lastRun.cronName,
              at: lastRun.createdAt,
              status: lastRun.status,
              message: lastRun.message,
              durationMs: safeDuration(lastRun.duration),
            }
          : null,
        lastSuccess: lastSuccess
          ? {
              id: lastSuccess.id,
              cronName: lastSuccess.cronName,
              at: lastSuccess.createdAt,
              message: lastSuccess.message,
              durationMs: safeDuration(lastSuccess.duration),
            }
          : null,
        lastError: lastError
          ? {
              id: lastError.id,
              cronName: lastError.cronName,
              at: lastError.createdAt,
              message: lastError.message,
              durationMs: safeDuration(lastError.duration),
            }
          : null,
        minutesSinceLastRun,
      };
    });

    const signalJob = jobs.find((job) => job.cronType === "signal_scan_type1") ?? null;
    const isStale = jobs.some((job) => job.isStale);

    emitObservabilityEvent({
      domain: "health",
      event: "cron_status_snapshot",
      meta: {
        stale: isStale,
        staleCount: jobs.filter((job) => job.isStale).length,
        jobsCount: jobs.length,
      },
    });

    return NextResponse.json({
      now: now.toISOString(),
      sourceOfTruth: "canonical",
      isStale,
      staleThresholdMinutes: CRON_JOB_POLICIES.signal_scan_type1.staleGraceMinutes,
      jobs,
      scanner: {
        lastRun: signalJob?.lastRun
          ? {
              at: signalJob.lastRun.at,
              status: signalJob.lastRun.status,
              message: signalJob.lastRun.message,
              duration: signalJob.lastRun.durationMs,
            }
          : null,
        lastSuccess: signalJob?.lastSuccess
          ? {
              at: signalJob.lastSuccess.at,
              message: signalJob.lastSuccess.message,
              duration: signalJob.lastSuccess.durationMs,
            }
          : null,
        lastError: signalJob?.lastError
          ? {
              at: signalJob.lastError.at,
              message: signalJob.lastError.message,
            }
          : null,
        minutesSinceLastRun: signalJob?.minutesSinceLastRun ?? null,
      },
      lastSignal: lastSignal
        ? {
            id: lastSignal.id,
            ticker: lastSignal.ticker,
            type: lastSignal.type,
            createdAt: lastSignal.createdAt,
          }
        : null,
    });
  } catch (error) {
    emitObservabilityEvent({
      domain: "health",
      level: "error",
      event: "cron_status_snapshot_failed",
      meta: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
    return NextResponse.json({ error: "Không thể tải trạng thái cron" }, { status: 500 });
  }
}

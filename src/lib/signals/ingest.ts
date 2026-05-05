import { prisma } from "@/lib/prisma";
import { processSignals, type ProcessedSignal, type RawScannerSignal } from "@/lib/UltimateSignalEngine";
import {
  getAiBrokerRuntimeConfig,
  rebalanceActiveBasketNav,
  shouldAutoActivateSignal,
} from "@/lib/aiBroker";
import { getVnNow } from "@/lib/time";
import { claimSignalNotifications, type SignalNotificationCandidate } from "./notification-dedupe";
import { normalizeSignalPrice } from "./price-units";

export const SIGNAL_SCAN_SLOTS = ["10:00", "10:30", "14:00", "14:25"] as const;
export const SIGNAL_SCAN_SLOT_SET = new Set<string>(SIGNAL_SCAN_SLOTS);

type SignalStatus = "RADAR" | "ACTIVE" | "CLOSED" | "HOLD_TO_DIE";

type PersistedSignalRef = {
  id: string;
  ticker: string;
  type: string;
  status: SignalStatus;
  entryPrice: number;
};

export type SignalScanSource = "cron" | "webhook" | "bridge" | "manual";

export interface SignalScanArtifactItem {
  id?: string;
  ticker: string;
  type: string;
  status?: string;
  entryPrice: number;
  target?: number;
  stoploss?: number;
  navAllocation?: number;
  winRate?: number;
  rrRatio?: string;
  reason?: string | null;
  action: "created" | "updated" | "claimed" | "skipped";
}

export interface SignalScanArtifact {
  kind: "signal_scan";
  version: "v1";
  batchId: string;
  tradingDate: string;
  slot: string;
  slotLabel: string;
  source: SignalScanSource;
  timestamp: string;
  publish: boolean;
  summary: {
    detected: number;
    accepted: number;
    processed: number;
    created: number;
    updated: number;
    notified: number;
    activated: number;
  };
  signals: SignalScanArtifactItem[];
  notifiedSignals: SignalScanArtifactItem[];
  activatedSignals: Array<{
    ticker: string;
    signalType: string;
    fromStatus: string;
    toStatus: string;
    entryPrice: number;
    reason: string | null;
  }>;
}

export interface SignalScanIngestResult {
  detected: number;
  accepted: number;
  processed: ProcessedSignal[];
  created: number;
  updated: number;
  notified: SignalNotificationCandidate[];
  activatedSignals: SignalScanArtifact["activatedSignals"];
  artifact: SignalScanArtifact;
}

const VALID_SIGNAL_TYPES = new Set(["SIEU_CO_PHIEU", "TRUNG_HAN", "DAU_CO", "TAM_NGAM"]);
const LIVE_STATUSES = new Set<SignalStatus>(["RADAR", "ACTIVE", "HOLD_TO_DIE"]);

export function toSignalKey(ticker: string, type: string): string {
  return `${ticker.toUpperCase().trim()}|${type}`;
}

export function normalizeIncomingSignals(signals: RawScannerSignal[]): RawScannerSignal[] {
  const valid = signals.filter((signal) => {
    if (
      !signal?.ticker ||
      !signal?.type ||
      typeof signal?.entryPrice !== "number" ||
      !Number.isFinite(signal.entryPrice) ||
      signal.entryPrice <= 0
    ) {
      return false;
    }
    return VALID_SIGNAL_TYPES.has(signal.type);
  });

  return Array.from(
    new Map(
      valid.map((signal) => [
        toSignalKey(signal.ticker, signal.type),
        {
          ...signal,
          ticker: signal.ticker.toUpperCase().trim(),
          entryPrice: normalizeSignalPrice(signal.entryPrice),
        },
      ]),
    ).values(),
  );
}

function isLiveStatus(status: string | null | undefined): boolean {
  return LIVE_STATUSES.has(status as SignalStatus);
}

async function loadExistingSignalMap(): Promise<Map<string, PersistedSignalRef>> {
  const recentCutoff = getVnNow().subtract(120, "day").toDate();
  const rows = await prisma.signal.findMany({
    where: {
      OR: [
        { status: { in: ["RADAR", "ACTIVE", "HOLD_TO_DIE"] } },
        { updatedAt: { gte: recentCutoff } },
        { createdAt: { gte: recentCutoff } },
      ],
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      ticker: true,
      type: true,
      status: true,
      entryPrice: true,
    },
  });

  const map = new Map<string, PersistedSignalRef>();
  for (const row of rows) {
    const key = toSignalKey(row.ticker, row.type);
    const existing = map.get(key);
    if (!existing || (!isLiveStatus(existing.status) && isLiveStatus(row.status))) {
      map.set(key, row as PersistedSignalRef);
    }
  }
  return map;
}

function summarizeSignal(signal: ProcessedSignal, action: SignalScanArtifactItem["action"], id?: string): SignalScanArtifactItem {
  return {
    id,
    ticker: signal.ticker.toUpperCase().trim(),
    type: signal.type,
    status: signal.status,
    entryPrice: signal.entryPrice,
    target: signal.target,
    stoploss: signal.stoploss,
    navAllocation: signal.navAllocation,
    winRate: signal.winRate,
    rrRatio: signal.rrRatio,
    reason: signal.reason ?? null,
    action,
  };
}

function summarizeCandidate(candidate: SignalNotificationCandidate): SignalScanArtifactItem {
  return {
    ticker: candidate.ticker.toUpperCase().trim(),
    type: candidate.type,
    entryPrice: candidate.entryPrice,
    reason: candidate.reason ?? null,
    action: "claimed",
  };
}

export async function ingestSignalScanBatch(params: {
  signals: RawScannerSignal[];
  detected?: number;
  tradingDate: string;
  slot: string;
  slotLabel: string;
  source: SignalScanSource;
  scannedAt?: Date;
}): Promise<SignalScanIngestResult> {
  const scannedAt = params.scannedAt ?? new Date();
  const acceptedSignals = normalizeIncomingSignals(params.signals);
  const processed = acceptedSignals.length > 0 ? await processSignals(acceptedSignals) : [];
  const aiBrokerConfig = await getAiBrokerRuntimeConfig();
  const existingMap = await loadExistingSignalMap();

  let created = 0;
  let updated = 0;
  const candidatesForNotify: SignalNotificationCandidate[] = [];
  const activatedSignals: SignalScanArtifact["activatedSignals"] = [];
  const artifactSignals: SignalScanArtifactItem[] = [];

  const operations = processed.map((signal) => {
    const normalizedTicker = signal.ticker.toUpperCase().trim();
    const key = toSignalKey(normalizedTicker, signal.type);
    const existing = existingMap.get(key);
    const autoActivate = shouldAutoActivateSignal(
      {
        entryPrice: signal.entryPrice,
        currentPrice: signal.entryPrice,
        winRate: signal.winRate,
        rrRatio: signal.rrRatio,
      },
      aiBrokerConfig,
    );
    const nextStatus =
      existing?.status === "CLOSED"
        ? "CLOSED"
        : autoActivate
          ? "ACTIVE"
          : signal.status;

    if (existing) {
      updated += 1;
      if (existing.status !== nextStatus && nextStatus === "ACTIVE") {
        activatedSignals.push({
          ticker: normalizedTicker,
          signalType: signal.type,
          fromStatus: existing.status,
          toStatus: nextStatus,
          entryPrice: signal.entryPrice,
          reason: signal.reason ?? null,
        });
      }

      const isExistingLive = isLiveStatus(existing.status);
      const isNextLive = isLiveStatus(nextStatus);
      const effectiveEntryPrice =
        isExistingLive && isNextLive && existing.entryPrice > 0 ? existing.entryPrice : signal.entryPrice;
      const livePayload =
        isNextLive && signal.entryPrice > 0 && effectiveEntryPrice > 0
          ? {
              currentPrice: signal.entryPrice,
              currentPnl: +(((signal.entryPrice - effectiveEntryPrice) / effectiveEntryPrice) * 100).toFixed(2),
            }
          : {};

      if (isNextLive) {
        candidatesForNotify.push({
          ticker: normalizedTicker,
          type: signal.type,
          entryPrice: signal.entryPrice,
          reason: signal.reason,
        });
      }

      artifactSignals.push(summarizeSignal({ ...signal, ticker: normalizedTicker, status: nextStatus }, "updated", existing.id));
      return prisma.signal.update({
        where: { id: existing.id },
        data: {
          status: nextStatus,
          entryPrice: effectiveEntryPrice,
          tier: signal.tier,
          navAllocation: signal.navAllocation,
          target: signal.target,
          stoploss: signal.stoploss,
          triggerSignal: signal.triggerSignal,
          aiReasoning: signal.aiReasoning,
          reason: signal.reason ?? null,
          winRate: signal.winRate,
          sharpeRatio: signal.sharpeRatio,
          rrRatio: signal.rrRatio,
          ...livePayload,
        },
      });
    }

    created += 1;
    if (nextStatus === "ACTIVE") {
      activatedSignals.push({
        ticker: normalizedTicker,
        signalType: signal.type,
        fromStatus: "NEW",
        toStatus: nextStatus,
        entryPrice: signal.entryPrice,
        reason: signal.reason ?? null,
      });
    }
    candidatesForNotify.push({
      ticker: normalizedTicker,
      type: signal.type,
      entryPrice: signal.entryPrice,
      reason: signal.reason,
    });
    artifactSignals.push(summarizeSignal({ ...signal, ticker: normalizedTicker, status: nextStatus }, "created"));

    return prisma.signal.create({
      data: {
        ticker: normalizedTicker,
        type: signal.type,
        status: nextStatus,
        tier: signal.tier,
        entryPrice: signal.entryPrice,
        target: signal.target,
        stoploss: signal.stoploss,
        navAllocation: signal.navAllocation,
        triggerSignal: signal.triggerSignal,
        aiReasoning: signal.aiReasoning,
        reason: signal.reason ?? null,
        winRate: signal.winRate,
        sharpeRatio: signal.sharpeRatio,
        rrRatio: signal.rrRatio,
        ...(nextStatus === "ACTIVE"
          ? {
              currentPrice: signal.entryPrice,
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

  const notified = await claimSignalNotifications(candidatesForNotify, params.tradingDate);
  const notifiedSignals = notified.map(summarizeCandidate);
  const batchId = `${params.tradingDate}-${params.slot.replace(":", "")}-${scannedAt.getTime()}`;

  const artifact: SignalScanArtifact = {
    kind: "signal_scan",
    version: "v1",
    batchId,
    tradingDate: params.tradingDate,
    slot: params.slot,
    slotLabel: params.slotLabel,
    source: params.source,
    timestamp: scannedAt.toISOString(),
    publish: true,
    summary: {
      detected: params.detected ?? params.signals.length,
      accepted: acceptedSignals.length,
      processed: processed.length,
      created,
      updated,
      notified: notified.length,
      activated: activatedSignals.length,
    },
    signals: artifactSignals,
    notifiedSignals,
    activatedSignals,
  };

  return {
    detected: params.detected ?? params.signals.length,
    accepted: acceptedSignals.length,
    processed,
    created,
    updated,
    notified,
    activatedSignals,
    artifact,
  };
}

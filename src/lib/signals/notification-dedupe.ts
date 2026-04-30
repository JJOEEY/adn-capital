import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { selectFreshSignalCandidates, type ReportedSignalLike } from "./reporting";

export interface SignalNotificationCandidate {
  ticker: string;
  type: string;
  entryPrice: number;
  reason?: string | null;
}

export function toSignalDedupeKey(ticker: string, type: string): string {
  return `${ticker.toUpperCase().trim()}|${type}`;
}

export async function loadSignalNotificationClaims(sentDate: string): Promise<ReportedSignalLike[]> {
  return prisma.signalHistory.findMany({
    where: { sentDate },
    select: {
      id: true,
      ticker: true,
      signalType: true,
      sentDate: true,
      createdAt: true,
    },
  });
}

export async function claimSignalNotifications(
  candidates: SignalNotificationCandidate[],
  sentDate: string,
) {
  const claimed: SignalNotificationCandidate[] = [];
  const existingClaims = await loadSignalNotificationClaims(sentDate);
  const freshCandidates = selectFreshSignalCandidates(candidates, existingClaims, sentDate);

  for (const candidate of freshCandidates) {
    const ticker = candidate.ticker.toUpperCase().trim();
    if (!ticker || !candidate.type) continue;

    try {
      await prisma.signalHistory.create({
        data: {
          ticker,
          signalType: candidate.type,
          sentDate,
        },
      });
      claimed.push({ ...candidate, ticker });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        continue;
      }
      throw error;
    }
  }

  return claimed;
}

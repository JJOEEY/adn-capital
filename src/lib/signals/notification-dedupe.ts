import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface SignalNotificationCandidate {
  ticker: string;
  type: string;
  entryPrice: number;
  reason?: string | null;
}

export function toSignalDedupeKey(ticker: string, type: string): string {
  return `${ticker.toUpperCase().trim()}|${type}`;
}

export async function claimSignalNotifications(
  candidates: SignalNotificationCandidate[],
  sentDate: string,
) {
  const claimed: SignalNotificationCandidate[] = [];

  for (const candidate of candidates) {
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

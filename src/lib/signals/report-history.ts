import { prisma } from "@/lib/prisma";
import { getVnDateISO } from "@/lib/time";
import {
  buildReportedSignalSummary,
  toSignalIdentityKey,
  type ReportedSignalLike,
  type ReportedSignalSummary,
} from "./reporting";

export type ReportedSignalHistoryRow = ReportedSignalLike & {
  id: string;
  createdAt: Date;
};

export async function loadReportedSignalRows(
  tradingDate = getVnDateISO(),
  take = 200,
): Promise<ReportedSignalHistoryRow[]> {
  const historyRows = await prisma.signalHistory.findMany({
    where: { sentDate: tradingDate },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      ticker: true,
      signalType: true,
      sentDate: true,
      createdAt: true,
    },
  });

  if (historyRows.length === 0) return [];

  const identities = Array.from(
    new Map(
      historyRows.map((row) => [
        toSignalIdentityKey(row.ticker, row.signalType),
        {
          ticker: row.ticker.toUpperCase().trim(),
          type: row.signalType.toUpperCase().trim(),
        },
      ]),
    ).values(),
  );

  const signalRows =
    identities.length > 0
      ? await prisma.signal.findMany({
          where: {
            OR: identities.map((identity) => ({
              ticker: identity.ticker,
              type: identity.type,
            })),
          },
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
          select: {
            ticker: true,
            type: true,
            status: true,
            entryPrice: true,
            reason: true,
          },
        })
      : [];

  const signalByIdentity = new Map<string, (typeof signalRows)[number]>();
  for (const signal of signalRows) {
    const key = toSignalIdentityKey(signal.ticker, signal.type);
    if (!signalByIdentity.has(key)) signalByIdentity.set(key, signal);
  }

  return historyRows.map((row) => {
    const signal = signalByIdentity.get(toSignalIdentityKey(row.ticker, row.signalType));
    return {
      ...row,
      ticker: row.ticker.toUpperCase().trim(),
      signalType: row.signalType.toUpperCase().trim(),
      entryPrice: signal?.entryPrice ?? null,
      status: signal?.status ?? null,
      reason: signal?.reason ?? null,
    };
  });
}

export async function loadReportedSignalSummary(
  tradingDate = getVnDateISO(),
): Promise<ReportedSignalSummary> {
  const rows = await loadReportedSignalRows(tradingDate);
  return buildReportedSignalSummary(rows, tradingDate);
}

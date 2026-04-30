import type { ReportedSignalItem, ReportedSignalSummary } from "./reporting";

export type SignalMapSignal = {
  ticker: string;
  type: string;
  [key: string]: unknown;
};

export type SignalMapPayload<T extends SignalMapSignal = SignalMapSignal> = {
  kind: "signal_map";
  version: "v1";
  tradingDate: string;
  signals: Array<T & {
    reportedToday?: boolean;
    reportedAt?: string | null;
    signalLabel?: string;
  }>;
  reportedToday: ReportedSignalSummary;
  reportedSignalKeys: string[];
};

function normalizeTicker(ticker: string): string {
  return ticker.toUpperCase().trim();
}

function normalizeSignalType(signalType: string): string {
  return signalType.toUpperCase().trim();
}

function toSignalIdentityKey(ticker: string, signalType: string): string {
  return `${normalizeTicker(ticker)}|${normalizeSignalType(signalType)}`;
}

function reportedAtMs(row: ReportedSignalItem | undefined): number {
  if (!row?.reportedAt) return 0;
  const value = new Date(row.reportedAt).getTime();
  return Number.isFinite(value) ? value : 0;
}

export function buildSignalMapPayload<T extends SignalMapSignal>(
  signals: T[],
  reportedToday: ReportedSignalSummary,
): SignalMapPayload<T> {
  const reportByIdentity = new Map(
    reportedToday.rows.map((row) => [
      toSignalIdentityKey(row.ticker, row.signalType),
      row,
    ]),
  );

  const decorated = signals.map((signal, index) => {
    const reported = reportByIdentity.get(toSignalIdentityKey(signal.ticker, signal.type));
    return {
      index,
      reported,
      signal: reported
        ? {
            ...signal,
            reportedToday: true,
            reportedAt: reported.reportedAt,
            signalLabel: reported.signalLabel,
          }
        : signal,
    };
  });

  decorated.sort((a, b) => {
    const aReportedAt = reportedAtMs(a.reported);
    const bReportedAt = reportedAtMs(b.reported);
    if (aReportedAt !== bReportedAt) return bReportedAt - aReportedAt;
    if (a.reported && !b.reported) return -1;
    if (!a.reported && b.reported) return 1;
    return a.index - b.index;
  });

  return {
    kind: "signal_map",
    version: "v1",
    tradingDate: reportedToday.tradingDate,
    signals: decorated.map((item) => item.signal),
    reportedToday,
    reportedSignalKeys: reportedToday.rows.map((row) =>
      toSignalIdentityKey(row.ticker, row.signalType),
    ),
  };
}

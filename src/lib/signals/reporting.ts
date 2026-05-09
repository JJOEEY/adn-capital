export interface SignalCandidateLike {
  ticker: string;
  type: string;
  entryPrice: number;
  reason?: string | null;
}

export interface ReportedSignalLike {
  id?: string;
  ticker: string;
  signalType: string;
  sentDate: string;
  createdAt?: Date | string | null;
  entryPrice?: number | null;
  status?: string | null;
  reason?: string | null;
}

export interface ReportedSignalItem {
  id?: string;
  ticker: string;
  signalType: string;
  signalLabel: string;
  sentDate: string;
  reportedAt: string | null;
  entryPrice: number | null;
  status: string | null;
  reason: string | null;
}

export interface ReportedSignalGroup {
  signalType: string;
  label: string;
  total: number;
  tickers: string[];
  rows: ReportedSignalItem[];
}

export interface ReportedSignalSummary {
  kind: "signal_report_history";
  version: "v1";
  tradingDate: string;
  total: number;
  tickers: string[];
  groups: ReportedSignalGroup[];
  rows: ReportedSignalItem[];
}

const SIGNAL_TYPE_LABELS: Record<string, string> = {
  SIEU_CO_PHIEU: "Siêu cổ phiếu",
  TRUNG_HAN: "Trung hạn",
  DAU_CO: "Lướt sóng",
  TAM_NGAM: "Tầm ngắm",
};

function normalizeTicker(ticker: string): string {
  return ticker.toUpperCase().trim();
}

function normalizeSignalType(signalType: string): string {
  return signalType.toUpperCase().trim();
}

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function reportedAtMs(row: ReportedSignalItem): number {
  if (!row.reportedAt) return 0;
  const value = new Date(row.reportedAt).getTime();
  return Number.isFinite(value) ? value : 0;
}

function uniqueKeepOrder(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function getSignalTypeLabel(signalType: string): string {
  const normalized = normalizeSignalType(signalType);
  return SIGNAL_TYPE_LABELS[normalized] ?? normalized;
}

export function toSignalIdentityKey(ticker: string, signalType: string): string {
  return `${normalizeTicker(ticker)}|${normalizeSignalType(signalType)}`;
}

export function toSignalReportKey(ticker: string, signalType: string, sentDate: string): string {
  return `${toSignalIdentityKey(ticker, signalType)}|${sentDate}`;
}

export function selectFreshSignalCandidates<T extends SignalCandidateLike>(
  candidates: T[],
  reportedRows: ReportedSignalLike[],
  sentDate: string,
): T[] {
  const reportedTickers = new Set(
    reportedRows
      .filter((row) => row.sentDate === sentDate)
      .map((row) => normalizeTicker(row.ticker)),
  );
  const seen = new Set<string>();
  const fresh: T[] = [];

  for (const candidate of candidates) {
    const ticker = normalizeTicker(candidate.ticker);
    const type = normalizeSignalType(candidate.type);
    if (!ticker || !type) continue;

    if (reportedTickers.has(ticker) || seen.has(ticker)) continue;

    seen.add(ticker);
    fresh.push({ ...candidate, ticker, type });
  }

  return fresh;
}

export function buildReportedSignalSummary(
  rows: ReportedSignalLike[],
  tradingDate: string,
): ReportedSignalSummary {
  const byReportKey = new Map<string, ReportedSignalItem>();

  for (const row of rows) {
    const ticker = normalizeTicker(row.ticker);
    const signalType = normalizeSignalType(row.signalType);
    if (!ticker || !signalType || row.sentDate !== tradingDate) continue;

    const item: ReportedSignalItem = {
      id: row.id,
      ticker,
      signalType,
      signalLabel: getSignalTypeLabel(signalType),
      sentDate: row.sentDate,
      reportedAt: toIsoString(row.createdAt),
      entryPrice: typeof row.entryPrice === "number" && Number.isFinite(row.entryPrice) ? row.entryPrice : null,
      status: row.status ?? null,
      reason: row.reason ?? null,
    };

    const key = toSignalReportKey(ticker, signalType, row.sentDate);
    const existing = byReportKey.get(key);
    if (!existing || reportedAtMs(item) >= reportedAtMs(existing)) {
      byReportKey.set(key, item);
    }
  }

  const summaryRows = Array.from(byReportKey.values()).sort((a, b) => {
    const diff = reportedAtMs(b) - reportedAtMs(a);
    return diff !== 0 ? diff : a.ticker.localeCompare(b.ticker);
  });

  const groupMap = new Map<string, ReportedSignalItem[]>();
  for (const row of summaryRows) {
    const group = groupMap.get(row.signalType) ?? [];
    group.push(row);
    groupMap.set(row.signalType, group);
  }

  const groups = Array.from(groupMap.entries()).map(([signalType, groupRows]) => ({
    signalType,
    label: getSignalTypeLabel(signalType),
    total: groupRows.length,
    tickers: uniqueKeepOrder(groupRows.map((row) => row.ticker)),
    rows: groupRows,
  }));

  return {
    kind: "signal_report_history",
    version: "v1",
    tradingDate,
    total: summaryRows.length,
    tickers: uniqueKeepOrder(summaryRows.map((row) => row.ticker)),
    groups,
    rows: summaryRows,
  };
}

function formatPrice(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "";
  return ` (${value.toLocaleString("vi-VN", { maximumFractionDigits: 0 })})`;
}

export function formatReportedSignalSummary(
  summary: ReportedSignalSummary,
  options: { limit?: number } = {},
): string {
  const limit = Math.max(1, options.limit ?? 30);
  if (summary.total === 0) {
    return `Chưa có tín hiệu nào đã báo trong ngày ${summary.tradingDate}.`;
  }

  const lines = [`Tín hiệu đã báo ngày ${summary.tradingDate}: ${summary.total} mã`];
  let remaining = limit;

  for (const group of summary.groups) {
    if (remaining <= 0) break;
    const visibleRows = group.rows.slice(0, remaining);
    remaining -= visibleRows.length;
    const suffix = group.rows.length > visibleRows.length ? `, +${group.rows.length - visibleRows.length} mã khác` : "";
    const tickers = visibleRows.map((row) => `${row.ticker}${formatPrice(row.entryPrice)}`).join(", ");
    lines.push(`- ${group.label} (${group.total}): ${tickers}${suffix}`);
  }

  if (summary.total > limit) {
    lines.push(`Đang hiện ${limit}/${summary.total} mã mới nhất.`);
  }

  return lines.join("\n");
}

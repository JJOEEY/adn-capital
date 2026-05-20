import { fetchDnseMarketBoard } from "@/lib/providers/dnse/market-data";

type SnapshotIndex = {
  ticker: string;
  value: number;
  change?: number;
  changePct: number;
  volume?: number;
};

type SnapshotLike = {
  indices?: SnapshotIndex[];
};

export type VnReferenceIndex = {
  ticker: "VNINDEX" | "VN30" | "VN30F1M";
  name: "VN-INDEX" | "VN30" | "VN30F1M";
  value: number | null;
  change: number | null;
  change_pct: number | null;
  icon: string;
};

const REFERENCE_ORDER: VnReferenceIndex["ticker"][] = ["VNINDEX", "VN30", "VN30F1M"];

function normalizeTicker(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function displayName(ticker: VnReferenceIndex["ticker"]): VnReferenceIndex["name"] {
  if (ticker === "VNINDEX") return "VN-INDEX";
  return ticker;
}

function displayIcon(ticker: VnReferenceIndex["ticker"]) {
  if (ticker === "VNINDEX") return "VN";
  if (ticker === "VN30") return "30";
  return "F1";
}

function emptyReference(ticker: VnReferenceIndex["ticker"]): VnReferenceIndex {
  return {
    ticker,
    name: displayName(ticker),
    value: null,
    change: null,
    change_pct: null,
    icon: displayIcon(ticker),
  };
}

function fromSnapshotIndex(ticker: VnReferenceIndex["ticker"], row: SnapshotIndex): VnReferenceIndex {
  return {
    ticker,
    name: displayName(ticker),
    value: Number.isFinite(row.value) ? row.value : null,
    change: typeof row.change === "number" && Number.isFinite(row.change) ? row.change : null,
    change_pct: Number.isFinite(row.changePct) ? row.changePct : null,
    icon: displayIcon(ticker),
  };
}

export function normalizeReferenceIndexName(name: string) {
  const key = normalizeTicker(name);
  if (key === "VNINDEX") return "VN-INDEX";
  if (key === "VN30") return "VN30";
  if (key === "VN30F1M" || key === "VN30F2305" || key.startsWith("VN30F")) return "VN30F1M";
  return "";
}

export function filterVnReferenceIndices<T extends { name: string }>(rows: T[]): Array<T & { name: string }> {
  const byName = new Map<string, T & { name: string }>();
  for (const row of rows) {
    const name = normalizeReferenceIndexName(row.name);
    if (!name || byName.has(name)) continue;
    byName.set(name, { ...row, name });
  }
  return ["VN-INDEX", "VN30", "VN30F1M"]
    .map((name) => byName.get(name))
    .filter((row): row is T => Boolean(row));
}

export async function loadVnReferenceIndices(snapshot?: SnapshotLike | null): Promise<VnReferenceIndex[]> {
  const byTicker = new Map<VnReferenceIndex["ticker"], VnReferenceIndex>();
  const snapshotIndices = Array.isArray(snapshot?.indices) ? snapshot.indices : [];

  for (const ticker of REFERENCE_ORDER) {
    const row = snapshotIndices.find((item) => normalizeTicker(item.ticker) === ticker);
    if (row) byTicker.set(ticker, fromSnapshotIndex(ticker, row));
  }

  if (!byTicker.has("VN30F1M")) {
    const board = await fetchDnseMarketBoard(["VN30F1M"]).catch(() => null);
    const row = board?.prices?.VN30F1M;
    if (row?.close != null && Number.isFinite(row.close)) {
      byTicker.set("VN30F1M", {
        ticker: "VN30F1M",
        name: "VN30F1M",
        value: row.close,
        change: typeof row.change === "number" && Number.isFinite(row.change) ? row.change : null,
        change_pct: typeof row.changePct === "number" && Number.isFinite(row.changePct) ? row.changePct : null,
        icon: "F1",
      });
    }
  }

  return REFERENCE_ORDER.map((ticker) => byTicker.get(ticker) ?? emptyReference(ticker));
}

export function formatReferenceIndexLine(row: VnReferenceIndex) {
  if (row.value == null || row.value <= 0) return `${row.name}: chưa cập nhật`;
  const change = row.change_pct == null ? "N/A" : `${row.change_pct >= 0 ? "+" : ""}${row.change_pct.toFixed(2)}%`;
  return `${row.name}: ${row.value.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} | ${change}`;
}

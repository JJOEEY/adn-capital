import type { OrderTicket } from "@/types/dnse-execution";

type PreviewRecord = {
  previewId: string;
  userId: string;
  ticket: OrderTicket;
  expiresAtMs: number;
  consumedAtMs: number | null;
};

type PreviewStoreState = {
  records: Map<string, PreviewRecord>;
};

const PREVIEW_STORE_KEY = Symbol.for("__adn_dnse_preview_store__");

function getState(): PreviewStoreState {
  const root = globalThis as unknown as Record<string | symbol, unknown>;
  const existing = root[PREVIEW_STORE_KEY] as PreviewStoreState | undefined;
  if (existing) return existing;
  const created: PreviewStoreState = { records: new Map() };
  root[PREVIEW_STORE_KEY] = created;
  return created;
}

function cleanupExpired(nowMs: number) {
  const state = getState();
  for (const [key, record] of state.records.entries()) {
    if (record.expiresAtMs <= nowMs || record.consumedAtMs !== null) {
      state.records.delete(key);
    }
  }
}

export function savePreviewTicket(args: {
  previewId: string;
  userId: string;
  ticket: OrderTicket;
  expiresAtMs: number;
}) {
  const nowMs = Date.now();
  cleanupExpired(nowMs);
  const state = getState();
  state.records.set(args.previewId, {
    previewId: args.previewId,
    userId: args.userId,
    ticket: args.ticket,
    expiresAtMs: args.expiresAtMs,
    consumedAtMs: null,
  });
}

export function getPreviewTicket(previewId: string, userId: string): OrderTicket | null {
  const nowMs = Date.now();
  cleanupExpired(nowMs);
  const state = getState();
  const record = state.records.get(previewId);
  if (!record) return null;
  if (record.userId !== userId) return null;
  if (record.consumedAtMs !== null) return null;
  if (record.expiresAtMs <= nowMs) {
    state.records.delete(previewId);
    return null;
  }
  return record.ticket;
}

export function consumePreviewTicket(previewId: string, userId: string): boolean {
  const nowMs = Date.now();
  cleanupExpired(nowMs);
  const state = getState();
  const record = state.records.get(previewId);
  if (!record) return false;
  if (record.userId !== userId) return false;
  if (record.consumedAtMs !== null) return false;
  if (record.expiresAtMs <= nowMs) {
    state.records.delete(previewId);
    return false;
  }
  record.consumedAtMs = nowMs;
  state.records.set(previewId, record);
  return true;
}

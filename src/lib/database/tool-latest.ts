import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type DatabaseToolLatestRecord<T = unknown> = {
  tool: string;
  dataset: string;
  key: string;
  tradingDate: string;
  source: string;
  payload: T;
  missingFields: string[];
  providerStatus: unknown | null;
  computedAt: string;
  expiresAt: string | null;
  updatedAt: string;
};

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function dateKeyInVietnam(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function rowToRecord<T>(row: {
  tool: string;
  dataset: string;
  key: string;
  tradingDate: string;
  source: string;
  payload: Prisma.JsonValue;
  missingFields: string[];
  providerStatus: Prisma.JsonValue | null;
  computedAt: Date;
  expiresAt: Date | null;
  updatedAt: Date;
}): DatabaseToolLatestRecord<T> {
  return {
    tool: row.tool,
    dataset: row.dataset,
    key: row.key,
    tradingDate: row.tradingDate,
    source: row.source,
    payload: row.payload as T,
    missingFields: row.missingFields,
    providerStatus: row.providerStatus,
    computedAt: row.computedAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function upsertDatabaseToolLatest(params: {
  tool: string;
  dataset: string;
  key?: string;
  tradingDate?: string;
  source?: string;
  payload: unknown;
  missingFields?: string[];
  providerStatus?: unknown;
  ttlMs?: number;
}): Promise<DatabaseToolLatestRecord> {
  const now = new Date();
  const tradingDate = params.tradingDate ?? dateKeyInVietnam(now);
  const key = params.key ?? "latest";
  const expiresAt = params.ttlMs ? new Date(now.getTime() + params.ttlMs) : null;
  const row = await prisma.databaseToolLatest.upsert({
    where: {
      tool_dataset_key_tradingDate: {
        tool: params.tool,
        dataset: params.dataset,
        key,
        tradingDate,
      },
    },
    create: {
      tool: params.tool,
      dataset: params.dataset,
      key,
      tradingDate,
      source: params.source ?? "database_v2",
      payload: toJson(params.payload),
      missingFields: params.missingFields ?? [],
      providerStatus: params.providerStatus == null ? undefined : toJson(params.providerStatus),
      computedAt: now,
      expiresAt,
    },
    update: {
      source: params.source ?? "database_v2",
      payload: toJson(params.payload),
      missingFields: params.missingFields ?? [],
      providerStatus: params.providerStatus == null ? undefined : toJson(params.providerStatus),
      computedAt: now,
      expiresAt,
    },
  });
  return rowToRecord(row);
}

export async function getDatabaseToolLatest<T = unknown>(params: {
  tool: string;
  dataset: string;
  key?: string;
  tradingDate?: string;
  maxAgeMs?: number;
}): Promise<DatabaseToolLatestRecord<T> | null> {
  const row = await prisma.databaseToolLatest.findFirst({
    where: {
      tool: params.tool,
      dataset: params.dataset,
      key: params.key ?? "latest",
      ...(params.tradingDate ? { tradingDate: params.tradingDate } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });
  if (!row) return null;
  if (params.maxAgeMs != null && Date.now() - row.updatedAt.getTime() > params.maxAgeMs) return null;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;
  return rowToRecord<T>(row);
}

export async function listDatabaseToolLatest<T = unknown>(params: {
  tool: string;
  dataset: string;
  tradingDate?: string;
  limit?: number;
  maxAgeMs?: number;
}): Promise<Array<DatabaseToolLatestRecord<T>>> {
  const rows = await prisma.databaseToolLatest.findMany({
    where: {
      tool: params.tool,
      dataset: params.dataset,
      ...(params.tradingDate ? { tradingDate: params.tradingDate } : {}),
      ...(params.maxAgeMs != null ? { updatedAt: { gte: new Date(Date.now() - params.maxAgeMs) } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: params.limit ?? 500,
  });
  return rows.map((row) => rowToRecord<T>(row));
}

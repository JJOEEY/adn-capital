import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDnseAccountContext } from "@/app/api/dnse/_shared";

export const dynamic = "force-dynamic";

type ConfigBody = {
  buyEnabled?: boolean;
  sellEnabled?: boolean;
  useLoanPackage?: boolean;
  loanPackageId?: string | null;
  maxNavPctPerOrder?: number;
  maxOrderValue?: number | null;
  maxDailyValue?: number | null;
  maxDailyOrders?: number;
  allowedTickers?: string[];
  blockedTickers?: string[];
  maxLossPct?: number | null;
  paused?: boolean;
};

const DEFAULT_CONFIG = {
  buyEnabled: false,
  sellEnabled: false,
  useLoanPackage: false,
  loanPackageId: null as string | null,
  maxNavPctPerOrder: 5,
  maxOrderValue: null as number | null,
  maxDailyValue: null as number | null,
  maxDailyOrders: 3,
  allowedTickers: [] as string[],
  blockedTickers: [] as string[],
  maxLossPct: null as number | null,
  paused: false,
};

function parseTickerList(value: unknown) {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,\s]+/)
      : [];
  return Array.from(
    new Set(
      raw
        .map((item) => String(item ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, ""))
        .filter((item) => item.length >= 2 && item.length <= 10),
    ),
  ).slice(0, 100);
}

function parseJsonList(value: string | null | undefined) {
  if (!value) return [];
  try {
    return parseTickerList(JSON.parse(value));
  } catch {
    return parseTickerList(value);
  }
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function nullablePositive(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function shapeConfig(row: {
  accountId: string | null;
  buyEnabled: boolean;
  sellEnabled: boolean;
  useLoanPackage: boolean;
  loanPackageId: string | null;
  maxNavPctPerOrder: number;
  maxOrderValue: number | null;
  maxDailyValue: number | null;
  maxDailyOrders: number;
  allowedTickers: string | null;
  blockedTickers: string | null;
  maxLossPct: number | null;
  paused: boolean;
} | null) {
  return {
    ...DEFAULT_CONFIG,
    ...(row ?? {}),
    allowedTickers: parseJsonList(row?.allowedTickers),
    blockedTickers: parseJsonList(row?.blockedTickers),
  };
}

function shapeAuthorization(row: {
  status: string;
  expiresAt: Date | null;
  authorizedAt: Date | null;
  revokedAt: Date | null;
  lastError: string | null;
} | null) {
  const active =
    row?.status === "ACTIVE" &&
    Boolean(row.expiresAt) &&
    (row.expiresAt?.getTime() ?? 0) > Date.now();
  return {
    active,
    status: active ? "ACTIVE" : row?.status ?? "INACTIVE",
    expiresAt: row?.expiresAt?.toISOString() ?? null,
    authorizedAt: row?.authorizedAt?.toISOString() ?? null,
    revokedAt: row?.revokedAt?.toISOString() ?? null,
    lastError: row?.lastError ?? null,
  };
}

export async function GET() {
  const resolved = await requireDnseAccountContext();
  if (!resolved.ok) return resolved.response;

  const [config, authorization] = await Promise.all([
    prisma.dnseRadarAutoConfig.findUnique({ where: { userId: resolved.context.userId } }),
    prisma.dnseRadarAutoAuthorization.findUnique({ where: { userId: resolved.context.userId } }),
  ]);

  return NextResponse.json({
    success: true,
    accountId: resolved.context.brokerAccountNo,
    config: shapeConfig(config),
    authorization: shapeAuthorization(authorization),
  });
}

export async function PATCH(req: NextRequest) {
  const resolved = await requireDnseAccountContext();
  if (!resolved.ok) return resolved.response;

  const body = (await req.json().catch(() => null)) as ConfigBody | null;
  const allowedTickers = parseTickerList(body?.allowedTickers);
  const blockedTickers = parseTickerList(body?.blockedTickers);

  const saved = await prisma.dnseRadarAutoConfig.upsert({
    where: { userId: resolved.context.userId },
    create: {
      userId: resolved.context.userId,
      accountId: resolved.context.brokerAccountNo,
      buyEnabled: Boolean(body?.buyEnabled),
      sellEnabled: Boolean(body?.sellEnabled),
      useLoanPackage: Boolean(body?.useLoanPackage),
      loanPackageId: body?.loanPackageId?.trim() || null,
      maxNavPctPerOrder: clampNumber(body?.maxNavPctPerOrder, 5, 0.1, 100),
      maxOrderValue: nullablePositive(body?.maxOrderValue),
      maxDailyValue: nullablePositive(body?.maxDailyValue),
      maxDailyOrders: Math.trunc(clampNumber(body?.maxDailyOrders, 3, 1, 100)),
      allowedTickers: JSON.stringify(allowedTickers),
      blockedTickers: JSON.stringify(blockedTickers),
      maxLossPct: nullablePositive(body?.maxLossPct),
      paused: Boolean(body?.paused),
    },
    update: {
      accountId: resolved.context.brokerAccountNo,
      buyEnabled: Boolean(body?.buyEnabled),
      sellEnabled: Boolean(body?.sellEnabled),
      useLoanPackage: Boolean(body?.useLoanPackage),
      loanPackageId: body?.loanPackageId?.trim() || null,
      maxNavPctPerOrder: clampNumber(body?.maxNavPctPerOrder, 5, 0.1, 100),
      maxOrderValue: nullablePositive(body?.maxOrderValue),
      maxDailyValue: nullablePositive(body?.maxDailyValue),
      maxDailyOrders: Math.trunc(clampNumber(body?.maxDailyOrders, 3, 1, 100)),
      allowedTickers: JSON.stringify(allowedTickers),
      blockedTickers: JSON.stringify(blockedTickers),
      maxLossPct: nullablePositive(body?.maxLossPct),
      paused: Boolean(body?.paused),
    },
  });

  return NextResponse.json({
    success: true,
    config: shapeConfig(saved),
  });
}

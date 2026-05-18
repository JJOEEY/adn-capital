import { NextRequest, NextResponse } from "next/server";
import { collectDnseEodMarketToDatabase } from "@/lib/database";

export const dynamic = "force-dynamic";

type CollectBody = {
  symbols?: unknown;
  timeoutMs?: unknown;
  maxMessages?: unknown;
  tradingDate?: unknown;
};

function isInternalAuthorized(req: NextRequest) {
  const expected = (process.env.INTERNAL_API_KEY ?? process.env.CRON_SECRET ?? "").trim();
  if (!expected) return false;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const provided = (req.headers.get("x-internal-key") ?? req.headers.get("x-cron-secret") ?? bearer ?? "").trim();
  return Boolean(provided && provided === expected);
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(readString(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readSymbols(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => readString(item).toUpperCase()).filter(Boolean);
  return readString(value)
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

export async function POST(req: NextRequest) {
  if (!isInternalAuthorized(req)) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 });
  }

  let body: CollectBody = {};
  try {
    body = (await req.json()) as CollectBody;
  } catch {
    body = {};
  }

  const result = await collectDnseEodMarketToDatabase({
    symbols: readSymbols(body.symbols),
    timeoutMs: readNumber(body.timeoutMs, 15_000),
    maxMessages: readNumber(body.maxMessages, 96),
    tradingDate: readString(body.tradingDate) || undefined,
  });

  return NextResponse.json(result, {
    status: result.authenticated ? 200 : 503,
  });
}

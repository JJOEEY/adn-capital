import { NextRequest, NextResponse } from "next/server";
import { invalidateTopics } from "@/lib/datahub/core";

export const dynamic = "force-dynamic";

type Body = {
  job?: string;
  slot?: string;
  status?: "success" | "error" | "skipped";
  invalidateTopics?: string[];
  invalidateTags?: string[];
  invalidatePrefixes?: string[];
};

const MAX_INVALIDATE_ITEMS = 200;

function isAuthorized(req: NextRequest) {
  const expected = process.env.INTERNAL_API_KEY ?? process.env.CRON_SECRET ?? "";
  if (!expected) return false;
  const provided = req.headers.get("x-internal-key") ?? req.headers.get("x-cron-secret") ?? "";
  return provided === expected;
}

function normalizeStringArray(value: unknown, max = MAX_INVALIDATE_ITEMS) {
  const items = Array.isArray(value)
    ? value
        .map((item) => String(item).trim())
        .filter(Boolean)
    : [];
  return Array.from(new Set(items)).slice(0, max);
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const topics = normalizeStringArray(body.invalidateTopics);
  const tags = normalizeStringArray(body.invalidateTags);
  const prefixes = normalizeStringArray(body.invalidatePrefixes);
  const result = invalidateTopics({ topics, tags, prefixes });

  return NextResponse.json({
    ok: true,
    job: body.job ?? "unknown",
    slot: body.slot ?? null,
    status: body.status ?? "success",
    invalidation: result,
    notifiedAt: new Date().toISOString(),
  });
}

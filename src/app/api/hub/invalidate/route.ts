import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { invalidateTopics } from "@/lib/datahub/core";

export const dynamic = "force-dynamic";

type InvalidateBody = {
  topics?: string[];
  tags?: string[];
  prefixes?: string[];
};

const MAX_INVALIDATE_ITEMS = 200;

function isAuthorizedByKey(req: NextRequest) {
  const expected = process.env.INTERNAL_API_KEY ?? process.env.CRON_SECRET ?? "";
  if (!expected) return false;
  const provided = req.headers.get("x-internal-key") ?? "";
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
  const isInternal = isAuthorizedByKey(req);
  let isAdmin = false;
  if (!isInternal) {
    const session = await auth();
    isAdmin = session?.user?.systemRole === "ADMIN";
  }

  if (!isInternal && !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: InvalidateBody;
  try {
    body = (await req.json()) as InvalidateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const topics = normalizeStringArray(body.topics);
  const tags = normalizeStringArray(body.tags);
  const prefixes = normalizeStringArray(body.prefixes);
  const result = invalidateTopics({ topics, tags, prefixes });

  return NextResponse.json({
    ok: true,
    ...result,
    invalidatedAt: new Date().toISOString(),
  });
}

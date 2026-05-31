import { NextRequest, NextResponse } from "next/server";
import { isDatabaseInternalAuthorized } from "@/lib/database/internal-auth";
import { collectDatabaseNews, type DatabaseNewsSourceName } from "@/lib/database";

export const dynamic = "force-dynamic";

function readSources(value: unknown): DatabaseNewsSourceName[] | undefined {
  const raw = Array.isArray(value) ? value : String(value ?? "").split(",");
  const sources = raw
    .map((item) => String(item ?? "").trim().toLowerCase())
    .filter((item): item is DatabaseNewsSourceName => item === "cafef" || item === "vietstock" || item === "vnstock_news");
  return sources.length ? Array.from(new Set(sources)) : undefined;
}

export async function POST(req: NextRequest) {
  if (!isDatabaseInternalAuthorized(req)) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 });
  }
  const body = await req.json().catch(() => ({})) as { sources?: unknown };
  const result = await collectDatabaseNews({ sources: readSources(body.sources) });
  return NextResponse.json(result, { status: result.ok ? 200 : 207 });
}

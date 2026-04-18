import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  const nowIso = new Date().toISOString();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      {
        status: "ok",
        timestamp: nowIso,
        latencyMs: Date.now() - startedAt,
        checks: {
          app: "ok",
          db: "ok",
        },
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "degraded",
        timestamp: nowIso,
        latencyMs: Date.now() - startedAt,
        checks: {
          app: "ok",
          db: "error",
        },
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 503 },
    );
  }
}

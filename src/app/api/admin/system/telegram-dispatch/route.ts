import { NextRequest, NextResponse } from "next/server";

import { getCurrentDbUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function isAuthorizedByInternalKey(req: NextRequest) {
  const expected = (process.env.INTERNAL_API_KEY ?? process.env.CRON_SECRET ?? "").trim();
  if (!expected) return false;
  const provided = (req.headers.get("x-internal-key") ?? req.headers.get("x-cron-secret") ?? "").trim();
  return provided === expected;
}

export async function GET(req: NextRequest) {
  const internalAuthorized = isAuthorizedByInternalKey(req);
  const dbUser = internalAuthorized ? null : await getCurrentDbUser();
  if (!internalAuthorized && (!dbUser || dbUser.systemRole !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limitParam = Number(new URL(req.url).searchParams.get("limit"));
  const take = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 50;
  const rows = await prisma.telegramDispatchLog.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      eventKey: true,
      eventType: true,
      tradingDate: true,
      slot: true,
      payloadHash: true,
      status: true,
      targetChatIdHash: true,
      sentAt: true,
      error: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ items: rows, count: rows.length });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  setPaperPositionLock,
  manualSellPaperPosition,
  manualBuyPaperPosition,
  adjustPaperPosition,
} from "@/lib/radar-paper-account";

export const dynamic = "force-dynamic";

async function requireAdminUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, systemRole: true },
  });
  if (!admin || admin.systemRole !== "ADMIN") return null;
  return admin;
}

type PaperActionBody = {
  action?: "lock" | "sell" | "buy" | "adjust";
  positionId?: string;
  locked?: boolean;
  ticker?: string;
  navPct?: number;
  tier?: string;
  stoploss?: number | null;
  target?: number | null;
};

/**
 * POST /api/signals/paper — Can thiệp tay tài khoản paper ADN Radar (admin-only).
 * action: lock | sell | buy | adjust
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: PaperActionBody;
  try {
    body = (await request.json()) as PaperActionBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    switch (body.action) {
      case "lock": {
        if (!body.positionId) return NextResponse.json({ error: "Missing positionId" }, { status: 400 });
        const result = await setPaperPositionLock(body.positionId, body.locked !== false);
        return NextResponse.json(result, { status: result.ok ? 200 : 409 });
      }
      case "sell": {
        if (!body.positionId) return NextResponse.json({ error: "Missing positionId" }, { status: 400 });
        const result = await manualSellPaperPosition(body.positionId);
        return NextResponse.json(result, { status: result.ok ? 200 : 409 });
      }
      case "buy": {
        if (!body.ticker || typeof body.navPct !== "number") {
          return NextResponse.json({ error: "Missing ticker/navPct" }, { status: 400 });
        }
        const result = await manualBuyPaperPosition({ ticker: body.ticker, navPct: body.navPct, tier: body.tier });
        return NextResponse.json(result, { status: result.ok ? 200 : 409 });
      }
      case "adjust": {
        if (!body.positionId) return NextResponse.json({ error: "Missing positionId" }, { status: 400 });
        const result = await adjustPaperPosition({
          positionId: body.positionId,
          navPct: body.navPct,
          stoploss: body.stoploss,
          target: body.target,
        });
        return NextResponse.json(result, { status: result.ok ? 200 : 409 });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("[POST /api/signals/paper] Lỗi:", error);
    return NextResponse.json({ error: "Lỗi can thiệp paper" }, { status: 500 });
  }
}

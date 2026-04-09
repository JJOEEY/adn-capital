import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin-check";

export const dynamic = "force-dynamic";

/** GET /api/admin/signals — Danh sách tất cả signals */
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const signals = await prisma.signal.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ signals });
}

/** POST /api/admin/signals — Tạo signal thủ công */
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const {
    ticker, type, tier, status,
    entryPrice, target, stoploss,
    navAllocation, triggerSignal, aiReasoning,
    winRate, sharpeRatio,
  } = body;

  if (!ticker || !entryPrice) {
    return NextResponse.json({ error: "ticker và entryPrice là bắt buộc" }, { status: 400 });
  }

  const typeMap: Record<string, string> = {
    LEADER: "SIEU_CO_PHIEU",
    TRUNG_HAN: "TRUNG_HAN",
    NGAN_HAN: "DAU_CO",
    TAM_NGAM: "TAM_NGAM",
  };

  const signal = await prisma.signal.create({
    data: {
      ticker: ticker.toUpperCase().trim(),
      type: type ?? typeMap[tier ?? "NGAN_HAN"] ?? "DAU_CO",
      tier: tier ?? "NGAN_HAN",
      status: status ?? "RADAR",
      entryPrice: parseFloat(entryPrice),
      target: target ? parseFloat(target) : null,
      stoploss: stoploss ? parseFloat(stoploss) : null,
      navAllocation: navAllocation ? parseFloat(navAllocation) : 0,
      triggerSignal: triggerSignal || null,
      aiReasoning: aiReasoning || null,
      winRate: winRate ? parseFloat(winRate) : null,
      sharpeRatio: sharpeRatio ? parseFloat(sharpeRatio) : null,
    },
  });

  return NextResponse.json({ signal });
}

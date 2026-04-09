import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin-check";

export const dynamic = "force-dynamic";

/** PATCH /api/admin/signals/[id] — Cập nhật signal */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { action, ...fields } = body;

  let data: Record<string, unknown> = {};

  if (action === "activate") {
    // RADAR → ACTIVE
    const currentPrice = fields.currentPrice ? parseFloat(fields.currentPrice) : undefined;
    data = {
      status: "ACTIVE",
      currentPrice: currentPrice ?? null,
      currentPnl: 0,
    };
  } else if (action === "close") {
    // ACTIVE → CLOSED
    const closePrice = parseFloat(fields.closePrice);
    const signal = await prisma.signal.findUnique({ where: { id: params.id } });
    if (!signal) return NextResponse.json({ error: "Signal not found" }, { status: 404 });
    const pnl = +((closePrice - signal.entryPrice) / signal.entryPrice * 100).toFixed(2);
    data = {
      status: "CLOSED",
      closePrice,
      currentPrice: closePrice,
      currentPnl: pnl,
      pnl,
      closedReason: fields.closedReason || "Đóng thủ công",
      closedAt: new Date(),
    };
  } else if (action === "reopen") {
    // CLOSED/ACTIVE → RADAR
    data = { status: "RADAR", closePrice: null, currentPrice: null, currentPnl: null, pnl: null, closedReason: null, closedAt: null };
  } else {
    // General update
    if (fields.status !== undefined) data.status = fields.status;
    if (fields.entryPrice !== undefined) data.entryPrice = parseFloat(fields.entryPrice);
    if (fields.target !== undefined) data.target = fields.target ? parseFloat(fields.target) : null;
    if (fields.stoploss !== undefined) data.stoploss = fields.stoploss ? parseFloat(fields.stoploss) : null;
    if (fields.currentPrice !== undefined) data.currentPrice = parseFloat(fields.currentPrice);
    if (fields.currentPnl !== undefined) data.currentPnl = parseFloat(fields.currentPnl);
    if (fields.closePrice !== undefined) data.closePrice = parseFloat(fields.closePrice);
    if (fields.pnl !== undefined) data.pnl = parseFloat(fields.pnl);
    if (fields.closedReason !== undefined) data.closedReason = fields.closedReason;
    if (fields.navAllocation !== undefined) data.navAllocation = parseFloat(fields.navAllocation);
    if (fields.triggerSignal !== undefined) data.triggerSignal = fields.triggerSignal;
  }

  const signal = await prisma.signal.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json({ signal });
}

/** DELETE /api/admin/signals/[id] — Xóa signal */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.signal.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}

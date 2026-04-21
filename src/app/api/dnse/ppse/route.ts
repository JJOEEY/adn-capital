import { NextRequest, NextResponse } from "next/server";
import { getDnseTradingClient } from "@/lib/providers/dnse/trading-client";
import { requireDnseAccountContext } from "@/app/api/dnse/_shared";

export const dynamic = "force-dynamic";

/**
 * GET /api/dnse/ppse?symbol=HPG
 * Lấy sức mua theo mã cổ phiếu.
 */
export async function GET(request: NextRequest) {
  const resolved = await requireDnseAccountContext();
  if (!resolved.ok) return resolved.response;

  const symbolRaw = request.nextUrl.searchParams.get("symbol") ?? "";
  const symbol = symbolRaw.trim().toUpperCase();
  if (!symbol) {
    return NextResponse.json(
      { error: "Thiếu mã cổ phiếu (symbol)" },
      { status: 400 },
    );
  }

  try {
    const client = getDnseTradingClient();
    const ppse = await client.getPPSE(resolved.context.accountNo, symbol);
    return NextResponse.json({
      success: true,
      ppse,
      source: "dnse_api",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Không thể lấy dữ liệu PPSE DNSE";
    console.error("[DNSE_PPSE_ROUTE] error", { message, symbol });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

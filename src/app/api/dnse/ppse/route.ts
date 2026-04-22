import { NextRequest, NextResponse } from "next/server";
import { getDnseTradingClient } from "@/lib/providers/dnse/trading-client";
import { requireDnseAccountContext } from "@/app/api/dnse/_shared";

export const dynamic = "force-dynamic";

/**
 * GET /api/dnse/ppse?symbol=HPG
 * Lấy sức mua theo mã cổ phiếu.
 */
export async function GET(request: NextRequest) {
  try {
    console.log("[DNSE PPSE API] Start");

    const resolved = await requireDnseAccountContext();
    if (!resolved.ok) {
      console.warn("[DNSE PPSE API] Context failed");
      return resolved.response;
    }

    const symbolRaw = request.nextUrl.searchParams.get("symbol") ?? "";
    const symbol = symbolRaw.trim().toUpperCase();
    if (!symbol) {
      return NextResponse.json({ error: "Thiếu mã cổ phiếu (symbol)" }, { status: 400 });
    }

    console.log("[DNSE PPSE API] Context account:", resolved.context.accountNo, "symbol:", symbol);

    const client = getDnseTradingClient({
      userJwtToken: resolved.context.userJwtToken,
      isolated: true,
    });
    const ppse = await client.getPPSE(resolved.context.accountNo, symbol);

    console.log("[DNSE PPSE API] Result:", ppse);

    return NextResponse.json({
      success: true,
      ppse,
      source: "dnse_api",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Không thể lấy dữ liệu PPSE DNSE";
    console.error("[DNSE PPSE API] Error:", message);
    if (error instanceof Error) {
      console.error("[DNSE PPSE API] Stack:", error.stack);
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

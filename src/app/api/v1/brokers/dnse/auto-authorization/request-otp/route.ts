import { NextResponse } from "next/server";
import { requireDnseAccountContext } from "@/app/api/dnse/_shared";
import { getDnseTradingClient } from "@/lib/providers/dnse/trading-client";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const resolved = await requireDnseAccountContext();
    if (!resolved.ok) return resolved.response;

    const client = getDnseTradingClient({
      userJwtToken: resolved.context.userJwtToken,
      isolated: true,
    });
    await client.sendEmailOTP();

    return NextResponse.json({
      success: true,
      message: "Đã gửi mã xác thực. Vui lòng kiểm tra email hoặc ứng dụng xác thực của tài khoản liên kết.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không thể gửi mã xác thực.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

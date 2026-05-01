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
    console.warn("[DNSE auto-authorization] request OTP failed", {
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return NextResponse.json(
      {
        error:
          "Không gửi được mã xác thực. Vui lòng kiểm tra tài khoản DNSE đã bật Email OTP hoặc đăng nhập lại DNSE.",
      },
      { status: 502 },
    );
  }
}

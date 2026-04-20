import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { completeDnseOAuthLink, consumeDnseOAuthState } from "@/lib/brokers/dnse/connection";
import { invalidateDnseBrokerTopicsForUser } from "@/lib/brokers/dnse/topics";

export const dynamic = "force-dynamic";

function buildRedirectUrl(req: NextRequest, status: "ok" | "error", message?: string) {
  const url = new URL("/dashboard/dnse-trading", req.url);
  url.searchParams.set("oauth", status);
  if (message) {
    url.searchParams.set("message", message);
  }
  return url;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.redirect(
      buildRedirectUrl(req, "error", "Bạn cần đăng nhập lại trước khi kết nối DNSE."),
    );
  }

  const state = req.nextUrl.searchParams.get("state")?.trim() ?? "";
  const code = req.nextUrl.searchParams.get("code")?.trim() ?? "";
  const oauthError = req.nextUrl.searchParams.get("error")?.trim() ?? "";

  if (oauthError) {
    return NextResponse.redirect(
      buildRedirectUrl(req, "error", `DNSE OAuth trả lỗi: ${oauthError}`),
    );
  }
  if (!state || !code) {
    return NextResponse.redirect(
      buildRedirectUrl(req, "error", "Thiếu state hoặc code từ DNSE."),
    );
  }

  const stateRow = await consumeDnseOAuthState({ userId, state });
  if (!stateRow) {
    return NextResponse.redirect(
      buildRedirectUrl(req, "error", "State OAuth không hợp lệ hoặc đã hết hạn."),
    );
  }

  try {
    await completeDnseOAuthLink({
      userId,
      code,
      codeVerifier: stateRow.codeVerifier,
    });
    await invalidateDnseBrokerTopicsForUser(userId);
    return NextResponse.redirect(
      buildRedirectUrl(req, "ok", "Kết nối DNSE thành công."),
    );
  } catch (error) {
    return NextResponse.redirect(
      buildRedirectUrl(
        req,
        "error",
        error instanceof Error ? error.message : "Kết nối DNSE thất bại",
      ),
    );
  }
}

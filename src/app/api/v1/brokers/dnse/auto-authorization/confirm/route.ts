import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDnseAccountContext } from "@/app/api/dnse/_shared";
import { encryptDnseToken } from "@/lib/brokers/dnse/crypto";
import { getDnseTradingClient } from "@/lib/providers/dnse/trading-client";

export const dynamic = "force-dynamic";

function parseOtp(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const raw = (value as Record<string, unknown>).otp;
  return typeof raw === "string" ? raw.trim() : "";
}

export async function POST(req: NextRequest) {
  try {
    const resolved = await requireDnseAccountContext();
    if (!resolved.ok) return resolved.response;

    const otp = parseOtp(await req.json().catch(() => null));
    if (!otp) {
      return NextResponse.json({ error: "Vui lòng nhập mã xác thực." }, { status: 400 });
    }

    const client = getDnseTradingClient({
      userJwtToken: resolved.context.userJwtToken,
      isolated: true,
    });
    const tradingToken = await client.createTradingToken(otp);
    const expiresIn = Math.max(60, Math.min(tradingToken.expiresIn, 8 * 60 * 60));
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    await prisma.dnseRadarAutoAuthorization.upsert({
      where: { userId: resolved.context.userId },
      create: {
        userId: resolved.context.userId,
        accountId: resolved.context.brokerAccountNo,
        status: "ACTIVE",
        tradingTokenEnc: encryptDnseToken(tradingToken.token),
        expiresAt,
        authorizedAt: new Date(),
        revokedAt: null,
        lastError: null,
      },
      update: {
        accountId: resolved.context.brokerAccountNo,
        status: "ACTIVE",
        tradingTokenEnc: encryptDnseToken(tradingToken.token),
        expiresAt,
        authorizedAt: new Date(),
        revokedAt: null,
        lastError: null,
      },
    });

    return NextResponse.json({
      success: true,
      authorization: {
        active: true,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.warn("[DNSE auto-authorization] confirm failed", {
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return NextResponse.json(
      {
        error:
          "Không xác nhận được quyền giao dịch. Vui lòng kiểm tra mã xác thực còn hiệu lực hoặc gửi lại mã mới.",
      },
      { status: 502 },
    );
  }
}

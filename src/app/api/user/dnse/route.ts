import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/dnse
 * Trả trạng thái kết nối DNSE của user hiện tại.
 * Luồng chuẩn: API key + liên kết tài khoản DNSE đã xác minh.
 */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      dnseId: true,
      dnseVerified: true,
      dnseAppliedAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Không tìm thấy tài khoản" }, { status: 404 });
  }

  const apiKeyConfigured = Boolean(process.env.DNSE_API_KEY?.trim());
  const accountId = user.dnseId?.trim() || null;
  const connectionLinked = Boolean(user.dnseVerified && accountId);

  return NextResponse.json({
    dnseId: user.dnseId,
    dnseVerified: user.dnseVerified,
    dnseAppliedAt: user.dnseAppliedAt,
    auth: {
      mode: apiKeyConfigured ? "api_key" : "unconfigured",
      configured: apiKeyConfigured,
      hasApiKey: apiKeyConfigured,
    },
    connection: {
      linked: connectionLinked,
      accountId,
      accountName: null,
      subAccountId: null,
      status: user.dnseVerified ? "ACTIVE" : "PENDING",
      scope: null,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      lastSyncedAt: null,
      lastError: null,
      updatedAt: user.dnseAppliedAt,
      source: "api_key_linked",
    },
  });
}

/**
 * POST /api/user/dnse
 * Lưu DNSE ID cho user hiện tại.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { dnseId?: unknown } | null;
  const dnseIdRaw = typeof body?.dnseId === "string" ? body.dnseId : "";
  const dnseId = dnseIdRaw.trim().toUpperCase();
  if (dnseId.length < 3) {
    return NextResponse.json({ error: "ID DNSE không hợp lệ" }, { status: 400 });
  }

  const [user, existing] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, dnseVerified: true },
    }),
    prisma.user.findUnique({
      where: { dnseId },
      select: { id: true },
    }),
  ]);

  if (!user) {
    return NextResponse.json({ error: "Không tìm thấy tài khoản" }, { status: 404 });
  }
  if (existing && existing.id !== user.id) {
    return NextResponse.json(
      { error: "ID DNSE này đã thuộc tài khoản khác" },
      { status: 409 },
    );
  }
  if (user.dnseVerified) {
    return NextResponse.json(
      {
        error:
          "Tài khoản DNSE đã xác minh. Vui lòng liên hệ admin nếu cần đổi tài khoản.",
      },
      { status: 403 },
    );
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      dnseId,
      dnseVerified: false,
      dnseAppliedAt: new Date(),
    },
    select: {
      dnseId: true,
      dnseVerified: true,
      dnseAppliedAt: true,
    },
  });

  return NextResponse.json({
    message:
      "Đã ghi nhận ID DNSE. Vui lòng đăng nhập DNSE rồi bấm liên kết để hệ thống đồng bộ NAV/danh mục.",
    ...updated,
  });
}

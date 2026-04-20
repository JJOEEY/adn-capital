import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDnseOAuthConfig } from "@/lib/brokers/dnse/oauth";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/dnse
 * Trả trạng thái kết nối DNSE theo user hiện tại.
 */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const [user, connection] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        dnseId: true,
        dnseVerified: true,
        dnseAppliedAt: true,
      },
    }),
    prisma.dnseConnection.findUnique({
      where: { userId },
      select: {
        accountId: true,
        accountName: true,
        subAccountId: true,
        status: true,
        scope: true,
        accessTokenExpiresAt: true,
        refreshTokenExpiresAt: true,
        lastSyncedAt: true,
        lastError: true,
        updatedAt: true,
      },
    }),
  ]);

  if (!user) {
    return NextResponse.json({ error: "Không tìm thấy tài khoản" }, { status: 404 });
  }

  const oauthConfig = getDnseOAuthConfig();
  return NextResponse.json({
    dnseId: user.dnseId,
    dnseVerified: user.dnseVerified,
    dnseAppliedAt: user.dnseAppliedAt,
    oauth: {
      configured: oauthConfig.configured,
      missing: oauthConfig.missing,
      startUrl: "/api/user/dnse/oauth/start",
      disconnectUrl: "/api/user/dnse/oauth/disconnect",
    },
    connection: connection
      ? {
          linked: connection.status === "ACTIVE",
          accountId: connection.accountId,
          accountName: connection.accountName,
          subAccountId: connection.subAccountId,
          status: connection.status,
          scope: connection.scope,
          accessTokenExpiresAt: connection.accessTokenExpiresAt,
          refreshTokenExpiresAt: connection.refreshTokenExpiresAt,
          lastSyncedAt: connection.lastSyncedAt,
          lastError: connection.lastError,
          updatedAt: connection.updatedAt,
          source: "oauth",
        }
      : {
          linked: false,
          accountId: user.dnseId,
          accountName: null,
          subAccountId: null,
          status: user.dnseVerified ? "ACTIVE_MANUAL" : "PENDING",
          scope: null,
          accessTokenExpiresAt: null,
          refreshTokenExpiresAt: null,
          lastSyncedAt: null,
          lastError: null,
          updatedAt: null,
          source: "legacy_manual",
        },
  });
}

/**
 * POST /api/user/dnse
 * Fallback tương thích cũ: lưu DNSE ID thủ công.
 * Lưu ý: luồng khuyến nghị là OAuth /api/user/dnse/oauth/start.
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
          "Tài khoản DNSE đã xác minh. Vui lòng ngắt kết nối hiện tại hoặc liên hệ admin để đổi tài khoản.",
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
      "Đã ghi nhận ID DNSE thủ công. Khuyến nghị chuyển sang kết nối OAuth để đồng bộ NAV và danh mục realtime.",
    ...updated,
  });
}

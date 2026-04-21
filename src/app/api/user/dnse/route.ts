import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/dnse
 * Tra trang thai ket noi DNSE theo user hien tai.
 */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Chua dang nhap" }, { status: 401 });
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
    return NextResponse.json({ error: "Khong tim thay tai khoan" }, { status: 404 });
  }

  const apiKeyConfigured = Boolean(process.env.DNSE_API_KEY?.trim());
  const authConfigured = apiKeyConfigured;
  const connectionLinked = Boolean(
    user.dnseVerified && (connection?.status === "ACTIVE" || user.dnseId),
  );

  return NextResponse.json({
    dnseId: user.dnseId,
    dnseVerified: user.dnseVerified,
    dnseAppliedAt: user.dnseAppliedAt,
    auth: {
      mode: apiKeyConfigured ? "api_key" : "unconfigured",
      configured: authConfigured,
      requiresOAuth: false,
      hasApiKey: apiKeyConfigured,
    },
    oauth: {
      // Giu key "oauth" de tuong thich voi UI/clients cu.
      configured: authConfigured,
      missing: authConfigured ? [] : ["DNSE_API_KEY"],
      startUrl: "/api/user/dnse/oauth/start",
      disconnectUrl: "/api/user/dnse/oauth/disconnect",
    },
    connection: connection
      ? {
          linked: connectionLinked,
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
          source: connection.status === "ACTIVE" ? "api_key" : "api_key_manual",
        }
      : {
          linked: connectionLinked,
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
          source: "api_key_manual",
        },
  });
}

/**
 * POST /api/user/dnse
 * Luu DNSE ID thu cong cho user hien tai.
 * Luong khuyen nghi hien tai la API key + trading token.
 * OAuth route van duoc giu de tuong thich nguoc.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Chua dang nhap" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { dnseId?: unknown } | null;
  const dnseIdRaw = typeof body?.dnseId === "string" ? body.dnseId : "";
  const dnseId = dnseIdRaw.trim().toUpperCase();
  if (dnseId.length < 3) {
    return NextResponse.json({ error: "ID DNSE khong hop le" }, { status: 400 });
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
    return NextResponse.json({ error: "Khong tim thay tai khoan" }, { status: 404 });
  }
  if (existing && existing.id !== user.id) {
    return NextResponse.json(
      { error: "ID DNSE nay da thuoc tai khoan khac" },
      { status: 409 },
    );
  }
  if (user.dnseVerified) {
    return NextResponse.json(
      {
        error:
          "Tai khoan DNSE da xac minh. Vui long lien he admin neu can doi tai khoan.",
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
      "Da ghi nhan ID DNSE. He thong se dung API key/trading token de dong bo NAV va danh muc.",
    ...updated,
  });
}

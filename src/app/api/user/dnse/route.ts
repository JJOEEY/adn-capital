import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DNSE_SESSION_EXP_COOKIE, DNSE_SESSION_TOKEN_COOKIE } from "@/lib/brokers/dnse/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/dnse
 * Trả trạng thái kết nối DNSE hiện tại của user.
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

  const store = await cookies();
  const token = store.get(DNSE_SESSION_TOKEN_COOKIE)?.value?.trim() || "";
  const expiresAtRaw = store.get(DNSE_SESSION_EXP_COOKIE)?.value?.trim() || "";
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;
  const hasSession =
    Boolean(token) &&
    Boolean(expiresAt) &&
    !Number.isNaN(expiresAt?.getTime() ?? NaN) &&
    (expiresAt?.getTime() ?? 0) > Date.now();

  const accountId = connection?.accountId ?? user.dnseId ?? null;
  const linked = Boolean(user.dnseVerified && accountId);

  return NextResponse.json({
    dnseId: user.dnseId,
    dnseVerified: user.dnseVerified,
    dnseAppliedAt: user.dnseAppliedAt,
    auth: {
      mode: "dnse_user_session",
      configured: Boolean(process.env.DNSE_API_KEY?.trim()),
      hasApiKey: Boolean(process.env.DNSE_API_KEY?.trim()),
      hasSession,
      sessionExpiresAt: hasSession && expiresAt ? expiresAt.toISOString() : null,
    },
    connection: {
      linked,
      accountId,
      accountName: connection?.accountName ?? null,
      subAccountId: connection?.subAccountId ?? null,
      status: linked ? connection?.status ?? "ACTIVE" : "PENDING",
      scope: connection?.scope ?? null,
      accessTokenExpiresAt: connection?.accessTokenExpiresAt ?? null,
      refreshTokenExpiresAt: connection?.refreshTokenExpiresAt ?? null,
      lastSyncedAt: connection?.lastSyncedAt ?? null,
      lastError: connection?.lastError ?? null,
      updatedAt: connection?.updatedAt ?? user.dnseAppliedAt ?? null,
      source: "dnse_user_session",
    },
  });
}

/**
 * POST /api/user/dnse
 * Dự phòng cho luồng cũ nhập ID DNSE giảm giá.
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
    return NextResponse.json({ error: "ID DNSE này đã thuộc tài khoản khác" }, { status: 409 });
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
      "Đã ghi nhận ID DNSE. Vui lòng đăng nhập DNSE và bấm liên kết để đồng bộ tài khoản thật.",
    ...updated,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/user/dnse
 * - User gửi yêu cầu liên kết ID DNSE
 * - Nếu tài khoản đã verified trước đó thì chặn đổi ID trực tiếp để tránh takeover
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, dnseVerified: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Không tìm thấy tài khoản" }, { status: 404 });
  }

  if (user.dnseVerified) {
    return NextResponse.json(
      { error: "Tài khoản DNSE đã xác minh. Vui lòng liên hệ admin nếu cần đổi ID DNSE." },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => null)) as { dnseId?: unknown } | null;
  const dnseIdRaw = typeof body?.dnseId === "string" ? body.dnseId : "";
  const trimmed = dnseIdRaw.trim().toUpperCase();
  if (trimmed.length < 3) {
    return NextResponse.json({ error: "ID DNSE không hợp lệ" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { dnseId: trimmed } });
  if (existing && existing.id !== user.id) {
    return NextResponse.json(
      { error: "ID DNSE này đã được sử dụng bởi tài khoản khác" },
      { status: 409 },
    );
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      dnseId: trimmed,
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
    message: "Đã ghi nhận yêu cầu liên kết DNSE. Vui lòng chờ admin xác minh.",
    ...updated,
  });
}

/**
 * GET /api/user/dnse
 * - Lấy trạng thái DNSE của user hiện tại
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      dnseId: true,
      dnseVerified: true,
      dnseAppliedAt: true,
    },
  });

  return NextResponse.json(user);
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/user/dnse — User tự nhập ID DNSE vào tài khoản
 * Body: { dnseId: string }
 * Logic: Lưu dnseId, set dnseVerified = false, chờ admin duyệt
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const { dnseId } = await req.json();
  if (!dnseId || typeof dnseId !== "string" || dnseId.trim().length < 3) {
    return NextResponse.json({ error: "ID DNSE không hợp lệ" }, { status: 400 });
  }

  const trimmed = dnseId.trim();

  // Kiểm tra ID đã được user khác dùng chưa
  const existing = await prisma.user.findUnique({ where: { dnseId: trimmed } });
  if (existing && existing.id !== session.user.id) {
    return NextResponse.json({ error: "ID DNSE này đã được sử dụng bởi tài khoản khác" }, { status: 409 });
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
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
    message: "Đã ghi nhận ID DNSE. Vui lòng chờ admin xác minh (~1 tiếng).",
    ...updated,
  });
}

/**
 * GET /api/user/dnse — Lấy trạng thái DNSE của user hiện tại
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

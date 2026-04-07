import { NextRequest, NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/user/settings — Lấy cài đặt journal của user
 * PATCH /api/user/settings — Cập nhật cài đặt journal
 */
export async function GET() {
  const dbUser = await getCurrentDbUser();
  if (!dbUser) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  return NextResponse.json({
    enableAIReview: dbUser.enableAIReview,
    initialJournalNAV: dbUser.initialJournalNAV,
  });
}

export async function PATCH(req: NextRequest) {
  const dbUser = await getCurrentDbUser();
  if (!dbUser) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  try {
    const body = await req.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};

    if (typeof body.enableAIReview === "boolean") {
      updateData.enableAIReview = body.enableAIReview;
    }

    if (body.initialJournalNAV !== undefined) {
      const nav = parseFloat(body.initialJournalNAV);
      if (isNaN(nav) || nav < 0) {
        return NextResponse.json({ error: "Số dư vốn không hợp lệ" }, { status: 400 });
      }
      updateData.initialJournalNAV = nav;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Không có gì để cập nhật" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: dbUser.id },
      data: updateData,
      select: {
        enableAIReview: true,
        initialJournalNAV: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PATCH /api/user/settings] Error:", error);
    return NextResponse.json({ error: "Lỗi cập nhật cài đặt" }, { status: 500 });
  }
}

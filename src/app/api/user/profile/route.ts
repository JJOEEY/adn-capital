import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/user/profile — Cập nhật tên hiển thị, avatar, initialJournalNAV, enableAIReview
 */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (typeof body.name === "string") {
    const name = body.name.trim().slice(0, 100);
    if (!name) {
      return NextResponse.json({ error: "Tên không được để trống" }, { status: 400 });
    }
    data.name = name;
  }

  if (typeof body.image === "string") {
    // Chỉ chấp nhận URL hợp lệ hoặc chuỗi rỗng (xóa avatar)
    if (body.image && !body.image.startsWith("http")) {
      return NextResponse.json({ error: "URL avatar không hợp lệ" }, { status: 400 });
    }
    data.image = body.image || null;
  }

  // initialJournalNAV — Số dư vốn ban đầu nhật ký
  if (body.initialJournalNAV !== undefined) {
    const nav = parseFloat(body.initialJournalNAV);
    if (isNaN(nav) || nav < 0) {
      return NextResponse.json({ error: "Số dư vốn ban đầu không hợp lệ" }, { status: 400 });
    }
    data.initialJournalNAV = nav;
  }

  // enableAIReview — Bật/tắt AI đánh giá tâm lý hàng tuần
  if (typeof body.enableAIReview === "boolean") {
    data.enableAIReview = body.enableAIReview;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Không có dữ liệu để cập nhật" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: {
      id: true,
      name: true,
      image: true,
      initialJournalNAV: true,
      enableAIReview: true,
    },
  });

  return NextResponse.json(updated);
}

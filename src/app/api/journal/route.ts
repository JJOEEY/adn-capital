import { NextRequest, NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const dbUser = await getCurrentDbUser();
  if (!dbUser) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);
  const skip = (page - 1) * limit;

  try {
    const [entries, total] = await prisma.$transaction([
      prisma.tradingJournal.findMany({
        where: { userId: dbUser.id },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.tradingJournal.count({ where: { userId: dbUser.id } }),
    ]);

    return NextResponse.json({ entries, total, page, limit });
  } catch (error) {
    console.error("[GET /api/journal] Error:", error);
    return NextResponse.json({ error: "Lỗi tải nhật ký" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const dbUser = await getCurrentDbUser();
  if (!dbUser) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { ticker, action, price, quantity, psychology } = body;

    if (!ticker || !action || !price || !quantity || !psychology) {
      return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
    }

    if (!["BUY", "SELL"].includes(action)) {
      return NextResponse.json({ error: "Loại lệnh không hợp lệ" }, { status: 400 });
    }

    const entry = await prisma.tradingJournal.create({
      data: {
        userId: dbUser.id,
        ticker: ticker.toUpperCase().trim(),
        action,
        price: parseFloat(price),
        quantity: parseInt(quantity),
        psychology,
      },
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/journal] Error:", error);
    return NextResponse.json({ error: "Lỗi lưu nhật ký" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const dbUser = await getCurrentDbUser();
  if (!dbUser) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Thiếu ID" }, { status: 400 });

  try {
    const entry = await prisma.tradingJournal.findUnique({ where: { id } });
    if (!entry || entry.userId !== dbUser.id) {
      return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    }

    await prisma.tradingJournal.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/journal] Error:", error);
    return NextResponse.json({ error: "Lỗi xóa nhật ký" }, { status: 500 });
  }
}

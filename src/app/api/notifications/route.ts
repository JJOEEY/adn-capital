import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/notifications?limit=30&type=signal_5m
 * Trả về danh sách notifications gần nhất.
 * Optional: filter theo type.
 */
export async function GET(request: NextRequest) {
  try {
    const limit = Math.min(
      parseInt(request.nextUrl.searchParams.get("limit") ?? "30", 10) || 30,
      100
    );
    const type = request.nextUrl.searchParams.get("type");

    const where = type ? { type } : {};

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error("[/api/notifications] Lỗi:", error);
    return NextResponse.json(
      { error: "Lỗi tải thông báo" },
      { status: 500 }
    );
  }
}

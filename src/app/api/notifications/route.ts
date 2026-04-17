import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentDbUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

const APP_UPDATES_ALLOWED_TYPES = [
  "signal",
  "signal_scan",
  "signal_10h",
  "signal_1030",
  "signal_14h",
  "signal_1420",
  "signal_1130", // legacy
  "signal_1445", // legacy
  "stats_scan",
  "stats_10h",
  "stats_1130",
  "stats_14h",
  "stats_1445",
] as const;

/**
 * GET /api/notifications?limit=30&type=signal_5m
 * Trả về danh sách notifications gần nhất.
 * Optional: filter theo type.
 * Private notifications (userId != null) chỉ hiện cho đúng user đó.
 * Global notifications (userId = null) hiện cho tất cả.
 */
export async function GET(request: NextRequest) {
  try {
    const limit = Math.min(
      parseInt(request.nextUrl.searchParams.get("limit") ?? "30", 10) || 30,
      100
    );
    const type = request.nextUrl.searchParams.get("type");
    const scope = request.nextUrl.searchParams.get("scope");

    // Lấy user hiện tại (nếu đã đăng nhập)
    const dbUser = await getCurrentDbUser();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (type) {
      where.type = type;
    } else if (scope === "updates") {
      where.type = { in: APP_UPDATES_ALLOWED_TYPES };
    }

    // Private notification logic:
    // - userId = null: Global, hiện cho tất cả
    // - userId != null: Chỉ hiện cho đúng user đó
    if (dbUser) {
      where.OR = [
        { userId: null },       // Global notifications
        { userId: dbUser.id },  // Private notifications cho user này
      ];
    } else {
      where.userId = null; // Guest chỉ xem global
    }

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

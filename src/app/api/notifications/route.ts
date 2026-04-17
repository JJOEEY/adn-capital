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
  "signal_1130",
  "signal_1445",
  "stats_scan",
  "stats_10h",
  "stats_1130",
  "stats_14h",
  "stats_1445",
] as const;

/**
 * GET /api/notifications?limit=30&type=signal_10h&scope=updates|all
 * - Mặc định scope=updates để feed app chỉ hiển thị scan mã + scan thị trường.
 * - scope=all dùng cho trang quản trị/điều tra khi cần xem toàn bộ.
 */
export async function GET(request: NextRequest) {
  try {
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") ?? "30", 10) || 30, 100);
    const type = request.nextUrl.searchParams.get("type");
    const scope = request.nextUrl.searchParams.get("scope") ?? "updates";
    const dbUser = await getCurrentDbUser();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (type) {
      where.type = type;
    } else if (scope !== "all") {
      where.type = { in: APP_UPDATES_ALLOWED_TYPES };
    }

    if (dbUser) {
      where.OR = [{ userId: null }, { userId: dbUser.id }];
    } else {
      where.userId = null;
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error("[/api/notifications] Lỗi:", error);
    return NextResponse.json({ error: "Lỗi tải thông báo" }, { status: 500 });
  }
}

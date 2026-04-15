/**
 * /api/internal/notifications/route.ts
 * Internal endpoint để Bridge API lưu Morning/EOD news vào DB sau khi gửi Telegram.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  // Xác thực bằng CRON_SECRET
  const secret = req.headers.get("x-cron-secret") ?? req.headers.get("authorization")?.replace("Bearer ", "");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json() as { type: string; content: unknown };
    const { type, content } = body;

    if (!type || !content) {
      return NextResponse.json({ error: "Thiếu type hoặc content" }, { status: 400 });
    }

    // Lưu vào Notification (model đã có sẵn trong schema.prisma)
    // Map type sang title
    const normalizedType = type === "morning" ? "morning_brief" : type === "eod" ? "eod_brief" : type;
    const safeContent = typeof content === "string" ? content.trim() : JSON.stringify(content);

    const typeLabels: Record<string, string> = {
      morning_brief: "Bản tin sáng 08:00",
      eod_brief: "Bản tin EOD 15:00",
      signal: "Tín hiệu",
      foreign: "Dòng tiền ngoại",
      art: "ART Alert",
    };
    const title = typeLabels[normalizedType] ?? normalizedType;

    const notification = await prisma.notification.create({
      data: {
        type: normalizedType,
        title,
        content: safeContent.length > 0 ? safeContent : "Dữ liệu đang cập nhật.",
        userId: null, // global notification
      },
    });

    return NextResponse.json({ ok: true, id: notification.id });
  } catch (error) {
    console.error("[Internal Notifications] Lỗi:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

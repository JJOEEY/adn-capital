/**
 * /api/internal/notifications/route.ts
 * Internal endpoint để Bridge API lưu Morning/EOD news vào DB sau khi gửi Telegram.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSignalWindowInfo } from "@/lib/cronHelpers";

export async function POST(req: NextRequest) {
  // Xác thực bằng CRON_SECRET
  const secret = req.headers.get("x-cron-secret") ?? req.headers.get("authorization")?.replace("Bearer ", "");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json() as { type: string; content: unknown; title?: string };
    const { type, content } = body;

    if (!type || !content) {
      return NextResponse.json({ error: "Thiếu type hoặc content" }, { status: 400 });
    }

    // Lưu vào Notification (model đã có sẵn trong schema.prisma)
    // Map type sang title
    const normalizedType = type === "morning" ? "morning_brief" : type === "eod" ? "close_brief_15h" : type;
    const finalType =
      normalizedType === "signal" || normalizedType === "signal_scan"
        ? getSignalWindowInfo().type
        : normalizedType;
    const safeContent = typeof content === "string" ? content.trim() : JSON.stringify(content);

    const typeLabels: Record<string, string> = {
      morning_brief: "Bản tin sáng 08:00",
      eod_brief: "Bản tin kết phiên 15:00",
      close_brief_15h: "Bản tin kết phiên 15:00",
      eod_full_19h: "Bản tin tổng hợp 19:00",
      signal: "Tín hiệu",
      signal_scan: "Tín hiệu",
      signal_10h: "Cập nhật tín hiệu 10:00",
      signal_1130: "Cập nhật tín hiệu 11:30",
      signal_14h: "Cập nhật tín hiệu 14:00",
      signal_1445: "Cập nhật tín hiệu 14:45",
      foreign: "Dòng tiền ngoại",
      art: "ART Alert",
    };
    const fallbackTitle = typeLabels[finalType] ?? finalType;
    const title = (body.title?.trim() || fallbackTitle).slice(0, 255);

    // Dedupe trong cùng time window để web feed không bị trùng khi source retry.
    const dedupeCutoff = new Date(Date.now() - 15 * 60 * 1000);
    const existing = await prisma.notification.findFirst({
      where: {
        type: finalType,
        title,
        createdAt: { gte: dedupeCutoff },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({ ok: true, id: existing.id, deduped: true });
    }

    const notification = await prisma.notification.create({
      data: {
        type: finalType,
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

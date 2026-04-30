/**
 * /api/internal/notifications/route.ts
 * Internal endpoint để Bridge API lưu Morning/EOD news vào DB sau khi gửi Telegram.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSignalWindowInfo } from "@/lib/cronHelpers";
import { invalidateTopics } from "@/lib/datahub/core";

const BRIEF_REPORT_TYPES = new Set(["morning_brief", "close_brief_15h", "eod_full_19h"]);

function normalizeBridgeType(type: string): string {
  if (type === "morning") return "morning_brief";
  if (type === "eod") return "eod_full_19h";
  if (type === "close" || type === "eod_brief") return "close_brief_15h";
  return type;
}

function stringifyBridgeContent(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (content && typeof content === "object") {
    const record = content as Record<string, unknown>;
    for (const key of ["markdown", "report", "content", "text", "message"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return JSON.stringify(content);
}

async function persistBridgeMarketReport(
  type: string,
  title: string,
  content: string,
  rawPayload: unknown,
) {
  if (!BRIEF_REPORT_TYPES.has(type)) return null;

  const dedupeCutoff = new Date(Date.now() - 45 * 60 * 1000);
  const existing = await prisma.marketReport.findFirst({
    where: {
      type,
      title,
      content,
      createdAt: { gte: dedupeCutoff },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.marketReport.create({
    data: {
      type,
      title,
      content,
      rawData: JSON.stringify(rawPayload && typeof rawPayload === "object" ? rawPayload : { content }),
      metadata: JSON.stringify({
        source: "bridge_internal_notification",
        receivedAt: new Date().toISOString(),
      }),
    },
    select: { id: true },
  });

  invalidateTopics({ tags: ["news", "brief", "dashboard", "market"] });
  return created.id;
}

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
    const normalizedType = normalizeBridgeType(type);
    const finalType =
      normalizedType === "signal" || normalizedType === "signal_scan"
        ? getSignalWindowInfo().type
        : normalizedType;
    const safeContent = stringifyBridgeContent(content);

    const typeLabels: Record<string, string> = {
      morning_brief: "Bản tin sáng 08:00",
      eod_brief: "Bản tin kết phiên 15:00",
      close_brief_15h: "Bản tin kết phiên 15:00",
      eod_full_19h: "Bản tin tổng hợp 19:00",
      signal: "Tín hiệu",
      signal_scan: "Tín hiệu",
      signal_10h: "Cập nhật tín hiệu 10:00",
      signal_1030: "Cập nhật tín hiệu 10:30",
      signal_14h: "Cập nhật tín hiệu 14:00",
      signal_1425: "Cập nhật tín hiệu 14:25",
      signal_1420: "Cập nhật tín hiệu 14:20 (legacy)",
      stats_10h: "Cập nhật thông tin 10:00",
      stats_1130: "Cập nhật thông tin 11:30",
      stats_14h: "Cập nhật thông tin 14:00",
      stats_1445: "Cập nhật thông tin 14:45",
      signal_1130: "Cập nhật tín hiệu 11:30 (legacy)",
      signal_1445: "Cập nhật tín hiệu 14:45 (legacy)",
      foreign: "Dòng tiền ngoại",
      art: "ART Alert",
    };
    const fallbackTitle = typeLabels[finalType] ?? finalType;
    const title = (body.title?.trim() || fallbackTitle).slice(0, 255);
    const marketReportId = await persistBridgeMarketReport(finalType, title, safeContent, content);

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
      return NextResponse.json({ ok: true, id: existing.id, marketReportId, deduped: true });
    }

    const notification = await prisma.notification.create({
      data: {
        type: finalType,
        title,
        content: safeContent.length > 0 ? safeContent : "Dữ liệu đang cập nhật.",
        userId: null, // global notification
      },
    });

    return NextResponse.json({ ok: true, id: notification.id, marketReportId });
  } catch (error) {
    console.error("[Internal Notifications] Lỗi:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * Cron Helper — Shared utilities cho tất cả cron routes.
 * Validate secret, log kết quả, tạo notification, gửi web push.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { emitObservabilityEvent } from "@/lib/observability";
import {
  getVnDateISO,
  getVnDateLabel,
  getVnNow,
  isVnTradingDay,
  toVnTime,
} from "@/lib/time";

export type SignalWindowType =
  | "signal_10h"
  | "signal_1030"
  | "signal_14h"
  | "signal_1420"
  | "signal_scan"
  | "stats_10h"
  | "stats_1130"
  | "stats_14h"
  | "stats_1445"
  | "stats_scan";

/** Validate cron secret header */
export function validateCronSecret(req: NextRequest): boolean {
  const secret = req.headers.get("x-cron-secret");
  return secret === (process.env.CRON_SECRET ?? "adn-cron-dev-key");
}

/** Log kết quả cron vào DB */
export async function logCron(
  cronName: string,
  status: "success" | "error" | "skipped",
  message: string,
  duration: number,
  resultData?: unknown
) {
  try {
    const row = await prisma.cronLog.create({
      data: {
        cronName,
        status,
        message,
        duration,
        resultData: resultData ? JSON.stringify(resultData) : null,
      },
    });
    emitObservabilityEvent({
      domain: "cron",
      level: status === "error" ? "error" : status === "skipped" ? "warn" : "info",
      event: "cron_log_persisted",
      meta: {
        cronName,
        status,
        durationMs: duration,
        message,
        cronLogId: row.id,
      },
    });
  } catch (err) {
    emitObservabilityEvent({
      domain: "cron",
      level: "error",
      event: "cron_log_failed",
      meta: {
        cronName,
        status,
        error: err instanceof Error ? err.message : String(err),
      },
    });
  }
}

/** Tạo notification, lưu DB, và gửi Web Push cho tất cả subscribers */
export async function pushNotification(
  type: string,
  title: string,
  content: string
) {
  try {
    const safeContent = content?.trim() ? content : "Dữ liệu đang cập nhật. Vui lòng kiểm tra lại sau.";
    const dedupeCutoff = new Date(Date.now() - 15 * 60 * 1000);
    const existing = await prisma.notification.findFirst({
      where: {
        type,
        title,
        content: safeContent,
        createdAt: { gte: dedupeCutoff },
      },
      select: { id: true },
    });
    if (existing) {
      return existing.id;
    }

    const created = await prisma.notification.create({
      data: { type, title, content: safeContent },
    });
    emitObservabilityEvent({
      domain: "cron",
      event: "notification_created",
      meta: {
        notificationType: type,
        title,
        notificationId: created.id,
      },
    });

    // Gửi Web Push cho tất cả subscribers
    await sendWebPushToAll(title, safeContent.substring(0, 200));
    return created.id;
  } catch (err) {
    emitObservabilityEvent({
      domain: "cron",
      level: "error",
      event: "notification_create_failed",
      meta: {
        notificationType: type,
        title,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    return null;
  }
}

/** Map giờ VN hiện tại sang window type */
export function getSignalWindowInfo(
  at?: Date,
  mode: "type1" | "type2" = "type1",
): { type: SignalWindowType; label: string } {
  const vnNow = at ? toVnTime(at) : getVnNow();
  const hh = vnNow.hour();
  const mm = vnNow.minute();
  const totalMinutes = hh * 60 + mm;

  if (mode === "type2") {
    // 10:00
    if (totalMinutes >= 10 * 60 && totalMinutes < 11 * 60 + 30) {
      return { type: "stats_10h", label: "10:00" };
    }
    // 11:30
    if (totalMinutes >= 11 * 60 + 30 && totalMinutes < 14 * 60) {
      return { type: "stats_1130", label: "11:30" };
    }
    // 14:00
    if (totalMinutes >= 14 * 60 && totalMinutes < 14 * 60 + 45) {
      return { type: "stats_14h", label: "14:00" };
    }
    // 14:45
    if (totalMinutes >= 14 * 60 + 45 && totalMinutes <= 15 * 60 + 30) {
      return { type: "stats_1445", label: "14:45" };
    }

    return {
      type: "stats_scan",
      label: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`,
    };
  }

  // 10:00
  if (totalMinutes >= 10 * 60 && totalMinutes < 10 * 60 + 30) {
    return { type: "signal_10h", label: "10:00" };
  }
  // 10:30
  if (totalMinutes >= 10 * 60 + 30 && totalMinutes < 14 * 60) {
    return { type: "signal_1030", label: "10:30" };
  }
  // 14:00
  if (totalMinutes >= 14 * 60 && totalMinutes < 14 * 60 + 20) {
    return { type: "signal_14h", label: "14:00" };
  }
  // 14:20
  if (totalMinutes >= 14 * 60 + 20 && totalMinutes <= 15 * 60 + 30) {
    return { type: "signal_1420", label: "14:20" };
  }

  return { type: "signal_scan", label: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}` };
}

/** Gửi Web Push notification cho tất cả subscribers */
async function sendWebPushToAll(title: string, body: string) {
  try {
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

    if (!vapidPublicKey || !vapidPrivateKey) {
      emitObservabilityEvent({
        domain: "cron",
        level: "warn",
        event: "webpush_skipped_missing_vapid",
      });
      return;
    }

    const subscriptions = await prisma.pushSubscription.findMany();
    if (subscriptions.length === 0) return;

    // Dynamic import web-push (chỉ load khi cần)
    let webpush: typeof import("web-push");
    try {
      webpush = await import("web-push");
    } catch {
      emitObservabilityEvent({
        domain: "cron",
        level: "warn",
        event: "webpush_skipped_dependency_missing",
      });
      return;
    }

    webpush.setVapidDetails(
      "mailto:admin@adncapital.vn",
      vapidPublicKey,
      vapidPrivateKey
    );

    const payload = JSON.stringify({
      title,
      body: body.replace(/[#*`]/g, "").trim(),
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      url: "/notifications",
    });

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush!.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        )
      )
    );

    // Xóa subscription hết hạn (410 Gone) ngay trong lần gửi
    const expiredEndpoints: string[] = [];
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        const reason = r.reason as { statusCode?: number; status?: number; body?: string };
        const statusCode = reason?.statusCode ?? reason?.status;
        const isGone = statusCode === 410 || /\b410\b/.test(String(reason?.body ?? ""));
        if (isGone) {
          expiredEndpoints.push(subscriptions[i].endpoint);
        }
      }
    });

    if (expiredEndpoints.length > 0) {
      await prisma.pushSubscription.deleteMany({
        where: { endpoint: { in: expiredEndpoints } },
      });
      emitObservabilityEvent({
        domain: "cron",
        event: "webpush_expired_subscriptions_deleted",
        meta: {
          deletedCount: expiredEndpoints.length,
        },
      });
    }

    const sent = results.filter((r) => r.status === "fulfilled").length;
    emitObservabilityEvent({
      domain: "cron",
      event: "webpush_send_summary",
      meta: {
        sent,
        total: subscriptions.length,
      },
    });
  } catch (err) {
    emitObservabilityEvent({
      domain: "cron",
      level: "error",
      event: "webpush_send_failed",
      meta: {
        error: err instanceof Error ? err.message : String(err),
      },
    });
  }
}

/** Lưu Market Report vào DB */
export async function saveMarketReport(
  type: string,
  title: string,
  content: string,
  rawData?: unknown,
  metadata?: unknown
) {
  try {
    const row = await prisma.marketReport.create({
      data: {
        type,
        title,
        content,
        rawData: rawData ? JSON.stringify(rawData) : null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
    emitObservabilityEvent({
      domain: "cron",
      event: "market_report_saved",
      meta: {
        reportType: type,
        reportId: row.id,
      },
    });
    return row;
  } catch (err) {
    emitObservabilityEvent({
      domain: "cron",
      level: "error",
      event: "market_report_save_failed",
      meta: {
        reportType: type,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    return null;
  }
}

/** Check xem hôm nay (giờ VN) có phải ngày giao dịch không (T2-T6) */
export function isTradingDay(): boolean {
  return isVnTradingDay();
}

/** Lấy ngày VN dạng string */
export function getVNDateString(): string {
  return getVnDateLabel();
}

/** Lấy ngày VN dạng YYYY-MM-DD */
export function getVNDateISO(): string {
  return getVnDateISO();
}

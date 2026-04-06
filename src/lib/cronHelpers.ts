/**
 * Cron Helper — Shared utilities cho tất cả cron routes.
 * Validate secret, log kết quả, tạo notification, gửi web push.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

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
    await prisma.cronLog.create({
      data: {
        cronName,
        status,
        message,
        duration,
        resultData: resultData ? JSON.stringify(resultData) : null,
      },
    });
  } catch (err) {
    console.error(`[CronLog] Failed to log ${cronName}:`, err);
  }
}

/** Tạo notification, lưu DB, và gửi Web Push cho tất cả subscribers */
export async function pushNotification(
  type: string,
  title: string,
  content: string
) {
  try {
    await prisma.notification.create({
      data: { type, title, content },
    });
    console.log(`[Notification] Đã tạo: ${type} — ${title}`);

    // Gửi Web Push cho tất cả subscribers
    await sendWebPushToAll(title, content.substring(0, 200));
  } catch (err) {
    console.error(`[Notification] Lỗi tạo ${type}:`, err);
  }
}

/** Gửi Web Push notification cho tất cả subscribers */
async function sendWebPushToAll(title: string, body: string) {
  try {
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.log("[WebPush] VAPID keys chưa cấu hình, bỏ qua web push");
      return;
    }

    const subscriptions = await prisma.pushSubscription.findMany();
    if (subscriptions.length === 0) return;

    // Dynamic import web-push (chỉ load khi cần)
    let webpush: typeof import("web-push");
    try {
      webpush = await import("web-push");
    } catch {
      console.log("[WebPush] web-push chưa cài, bỏ qua");
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

    // Xóa subscription hết hạn (410 Gone)
    const expiredEndpoints: string[] = [];
    results.forEach((r, i) => {
      if (r.status === "rejected" && (r.reason as { statusCode?: number })?.statusCode === 410) {
        expiredEndpoints.push(subscriptions[i].endpoint);
      }
    });

    if (expiredEndpoints.length > 0) {
      await prisma.pushSubscription.deleteMany({
        where: { endpoint: { in: expiredEndpoints } },
      });
      console.log(`[WebPush] Xóa ${expiredEndpoints.length} subscription hết hạn`);
    }

    const sent = results.filter((r) => r.status === "fulfilled").length;
    console.log(`[WebPush] Gửi ${sent}/${subscriptions.length} thành công`);
  } catch (err) {
    console.error("[WebPush] Lỗi gửi push:", err);
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
    return await prisma.marketReport.create({
      data: {
        type,
        title,
        content,
        rawData: rawData ? JSON.stringify(rawData) : null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
  } catch (err) {
    console.error(`[MarketReport] Lỗi lưu ${type}:`, err);
    return null;
  }
}

/** Check xem hôm nay (giờ VN) có phải ngày giao dịch không (T2-T6) */
export function isTradingDay(): boolean {
  const vnNow = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" })
  );
  const day = vnNow.getDay();
  return day >= 1 && day <= 5;
}

/** Lấy ngày VN dạng string */
export function getVNDateString(): string {
  return new Date().toLocaleDateString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Lấy ngày VN dạng YYYY-MM-DD */
export function getVNDateISO(): string {
  const vnNow = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" })
  );
  return vnNow.toISOString().split("T")[0];
}

/**
 * Cron Helper — Shared utilities cho tất cả cron routes.
 * Validate secret, log kết quả, tạo notification.
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

/** Tạo notification và lưu vào DB */
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
  } catch (err) {
    console.error(`[Notification] Lỗi tạo ${type}:`, err);
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

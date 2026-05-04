import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import type { SignalScanArtifactItem } from "./ingest";

const SIGNAL_TYPE_LABELS: Record<string, string> = {
  SIEU_CO_PHIEU: "Siêu cổ phiếu",
  TRUNG_HAN: "Trung hạn",
  DAU_CO: "Lướt sóng",
  TAM_NGAM: "Tầm ngắm",
};

function formatPrice(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "-";
  return value.toLocaleString("vi-VN", { maximumFractionDigits: 0 });
}

function formatSignalType(type: string) {
  const normalized = type.toUpperCase().trim();
  return SIGNAL_TYPE_LABELS[normalized] ?? normalized;
}

function formatTelegramText(params: {
  signals: SignalScanArtifactItem[];
  tradingDate: string;
  slotLabel: string;
}) {
  const groups = new Map<string, SignalScanArtifactItem[]>();
  for (const signal of params.signals) {
    const type = signal.type.toUpperCase().trim();
    const rows = groups.get(type) ?? [];
    rows.push(signal);
    groups.set(type, rows);
  }

  const lines = [
    `🔔 TÍN HIỆU MỚI - ${params.tradingDate}`,
    `Khung quét: ${params.slotLabel}`,
    `Số mã: ${params.signals.length}`,
    "",
  ];

  for (const [type, rows] of groups.entries()) {
    lines.push(`⚡ ${formatSignalType(type)} (${rows.length})`);
    for (const signal of rows) {
      const reason = signal.reason ? ` - ${signal.reason}` : "";
      lines.push(`• ${signal.ticker} - ${formatPrice(signal.entryPrice)}${reason}`);
    }
    lines.push("");
  }

  lines.push("— ADN Capital Scanner 🤖");
  return lines.join("\n").trim();
}

function getSignalTelegramTarget() {
  const token = (
    process.env.TELEGRAM_SIGNAL_BOT_TOKEN ??
    process.env.ADN_SUPPORT_TELEGRAM_BOT_TOKEN ??
    process.env.TELEGRAM_SUPPORT_BOT_TOKEN ??
    process.env.ADN_SUPPORT_BOT_TOKEN ??
    ""
  ).trim();
  const chatId = (
    process.env.TELEGRAM_SIGNAL_CHAT_ID ??
    process.env.ADN_SUPPORT_TELEGRAM_CHAT_ID ??
    process.env.TELEGRAM_SUPPORT_CHAT_ID ??
    process.env.ADN_SUPPORT_CHAT_ID ??
    ""
  ).trim();
  return { token, chatId };
}

async function sendSupportTelegram(text: string, dedupeKey: string) {
  const { token, chatId } = getSignalTelegramTarget();
  const textHash = createHash("sha256").update(text).digest("hex").slice(0, 24);

  if (!token || !chatId) {
    return { ok: true, skipped: true, reason: "support_telegram_not_configured", textHash, dedupeKey };
  }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const existing = await prisma.cronLog.findFirst({
    where: {
      cronName: "telegram:signal-scan",
      status: "success",
      createdAt: { gte: cutoff },
      resultData: { contains: dedupeKey },
    },
    select: { id: true },
  });
  if (existing) {
    return { ok: true, skipped: true, reason: "duplicate_suppressed", textHash, dedupeKey };
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    await prisma.cronLog.create({
      data: {
        cronName: "telegram:signal-scan",
        status: "error",
        message: `telegram_http_${response.status}`,
        duration: 0,
        resultData: JSON.stringify({ dedupeKey, textHash }),
      },
    });
    return { ok: false, skipped: false, status: response.status, payload, textHash, dedupeKey };
  }

  await prisma.cronLog.create({
    data: {
      cronName: "telegram:signal-scan",
      status: "success",
      message: "sent",
      duration: 0,
      resultData: JSON.stringify({ dedupeKey, textHash }),
    },
  });
  return { ok: true, skipped: false, status: response.status, payload, textHash, dedupeKey };
}

export async function sendClaimedSignalsToTelegram(params: {
  signals: SignalScanArtifactItem[];
  tradingDate: string;
  slotLabel: string;
  batchId: string;
}) {
  if (params.signals.length === 0) {
    return { ok: true, skipped: true, reason: "no_claimed_signals" };
  }

  const text = formatTelegramText(params);
  return sendSupportTelegram(text, `telegram:signal-scan:${params.tradingDate}:${params.batchId}`);
}

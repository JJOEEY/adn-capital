import { prisma } from "@/lib/prisma";
import { sendTelegramOnce, telegramHash } from "@/lib/telegram/dispatch";
import type { SignalScanArtifactItem } from "./ingest";

const SIGNAL_TYPE_LABELS: Record<string, string> = {
  SIEU_CO_PHIEU: "Siêu cổ phiếu",
  TRUNG_HAN: "Trung hạn",
  DAU_CO: "Lướt sóng",
  TAM_NGAM: "Tầm ngắm",
};

type ActiveSignalRow = {
  ticker: string;
  signalType: string;
  status?: string | null;
  entryPrice?: number | null;
  currentPrice?: number | null;
  navAllocation?: number | null;
  reason?: string | null;
};

function formatPrice(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "-";
  return value.toLocaleString("vi-VN", { maximumFractionDigits: 0 });
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}%`;
}

function formatSignalType(type: string) {
  const normalized = type.toUpperCase().trim();
  return SIGNAL_TYPE_LABELS[normalized] ?? normalized;
}

function signalIcon(type: string) {
  const normalized = type.toUpperCase().trim();
  if (normalized === "SIEU_CO_PHIEU") return "💎";
  if (normalized === "TRUNG_HAN") return "⭐";
  if (normalized === "DAU_CO") return "🚀";
  if (normalized === "TAM_NGAM") return "🔥";
  return "🚀";
}

function formatCompactRow(index: number, ticker: string, price: number | null | undefined, type: string) {
  const no = `${index})`.padStart(3, "0");
  const code = ticker.toUpperCase().trim().padEnd(4, " ");
  const entry = formatPrice(price).padStart(8, " ");
  return `${no} ${code} ${entry} ${signalIcon(type)}`;
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

function signalIdentity(signals: SignalScanArtifactItem[]) {
  return signals
    .map((signal) =>
      [
        signal.ticker.toUpperCase(),
        signal.type.toUpperCase(),
        formatPrice(signal.entryPrice),
      ].join(":"),
    )
    .sort()
    .join("|");
}

function activeIdentity(signals: ActiveSignalRow[]) {
  return signals
    .map((signal) =>
      [
        signal.ticker.toUpperCase(),
        signal.signalType.toUpperCase(),
        signal.status ?? "",
        formatPrice(signal.entryPrice),
        formatPrice(signal.currentPrice),
      ].join(":"),
    )
    .sort()
    .join("|");
}

function formatSignalBatchText(params: {
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

  let index = 1;
  for (const [type, rows] of groups.entries()) {
    lines.push(`⚡ ${formatSignalType(type)} (${rows.length})`);
    lines.push("```");
    for (const signal of rows) {
      lines.push(formatCompactRow(index, signal.ticker, signal.entryPrice, type));
      index += 1;
    }
    lines.push("```");
    lines.push("");
  }

  lines.push("— ADN Capital Scanner 🤖");
  return lines.join("\n").trim();
}

function formatActiveSignalsText(params: {
  signals: ActiveSignalRow[];
  tradingDate: string;
  slotLabel: string;
}) {
  const lines = [
    `🟢 CỔ PHIẾU ACTIVE - ${params.tradingDate}`,
    `Khung quét: ${params.slotLabel}`,
    `Số mã: ${params.signals.length}`,
    "",
  ];

  lines.push("```");
  params.signals.forEach((signal, index) => {
    lines.push(formatCompactRow(index + 1, signal.ticker, signal.entryPrice, signal.signalType));
  });
  lines.push("```");

  lines.push("");
  lines.push("— ADN Capital Scanner 🤖");
  return lines.join("\n").trim();
}

function formatActiveHoldingsText(params: {
  signals: ActiveSignalRow[];
  tradingDate: string;
}) {
  const lines = [
    `📌 CỔ PHIẾU ĐANG NẮM GIỮ - ${params.tradingDate}`,
    "",
    "Danh sách lấy từ tín hiệu đang ACTIVE/HOLD:",
  ];

  for (const signal of params.signals) {
    lines.push(
      `• ${signal.ticker}: Entry ${formatPrice(signal.entryPrice)} | Hiện tại ${formatPrice(
        signal.currentPrice,
      )} | Tỷ trọng NAV ${formatPercent(signal.navAllocation)}`,
    );
  }

  lines.push("");
  lines.push("— ADN Capital Scanner 🤖");
  return lines.join("\n").trim();
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

  const { token, chatId } = getSignalTelegramTarget();
  const identity = signalIdentity(params.signals);
  const digest = telegramHash(identity).slice(0, 16);
  const eventKey = `signal-batch:${params.tradingDate}:${params.slotLabel}:${digest}`;
  const text = formatSignalBatchText(params);

  return sendTelegramOnce({
    eventType: "SIGNAL_BATCH",
    eventKey,
    text,
    token,
    chatId,
    tradingDate: params.tradingDate,
    slot: params.slotLabel,
    parseMode: "Markdown",
  });
}

export async function sendActiveSignalsToTelegram(params: {
  signals: ActiveSignalRow[];
  tradingDate: string;
  slotLabel: string;
}) {
  if (params.signals.length === 0) {
    return { ok: true, skipped: true, reason: "no_active_signals" };
  }

  const { token, chatId } = getSignalTelegramTarget();
  const digest = telegramHash(activeIdentity(params.signals)).slice(0, 16);
  const eventKey = `signal-active:${params.tradingDate}:${params.slotLabel}:${digest}`;
  const text = formatActiveSignalsText(params);

  return sendTelegramOnce({
    eventType: "SIGNAL_ACTIVE",
    eventKey,
    text,
    token,
    chatId,
    tradingDate: params.tradingDate,
    slot: params.slotLabel,
    parseMode: "Markdown",
  });
}

export async function sendActiveHoldingsToTelegram(params: {
  tradingDate: string;
  slotLabel?: string;
}) {
  const rows = await prisma.signal.findMany({
    where: { status: { in: ["ACTIVE", "HOLD_TO_DIE"] } },
    orderBy: [{ updatedAt: "desc" }],
    take: 50,
    select: {
      ticker: true,
      type: true,
      status: true,
      entryPrice: true,
      currentPrice: true,
      navAllocation: true,
    },
  });

  if (rows.length === 0) {
    return { ok: true, skipped: true, reason: "no_active_holdings" };
  }

  const { token, chatId } = getSignalTelegramTarget();
  const signals = rows.map((row) => ({
    ticker: row.ticker,
    signalType: row.type,
    status: row.status,
    entryPrice: row.entryPrice,
    currentPrice: row.currentPrice,
    navAllocation: row.navAllocation,
  }));
  const digest = telegramHash(activeIdentity(signals)).slice(0, 16);
  const eventKey = `active-holdings-19h:${params.tradingDate}:${digest}`;
  const text = formatActiveHoldingsText({ signals, tradingDate: params.tradingDate });

  return sendTelegramOnce({
    eventType: "ACTIVE_HOLDINGS_19H",
    eventKey,
    text,
    token,
    chatId,
    tradingDate: params.tradingDate,
    slot: params.slotLabel ?? "19:00",
  });
}

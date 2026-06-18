import { prisma } from "@/lib/prisma";
import { sendTelegramOnce, telegramHash } from "@/lib/telegram/dispatch";
import type { SignalScanArtifactItem } from "./scan-artifact";

// Nhãn IN HOA cho tín hiệu bắn từng mã (chỉ các nhãn hành động; TẦM NGẮM không bắn)
const SIGNAL_LABEL_UPPER: Record<string, string> = {
  SIEU_CO_PHIEU: "SIÊU CỔ PHIẾU",
  TRUNG_HAN: "TRUNG HẠN",
  DAU_CO: "LƯỚT SÓNG",
};

// entryPrice lưu theo VNĐ (vd 24350) → hiển thị "nghìn đồng" (24.35)
function formatEntryK(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "-";
  const k = value >= 1000 ? value / 1000 : value;
  return String(Number(k.toFixed(2)));
}

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

function formatSingleSignalText(params: {
  ticker: string;
  type: string;
  entryPrice: number | null | undefined;
  navAllocation: number | null | undefined;
}) {
  const normalized = params.type.toUpperCase().trim();
  const label = SIGNAL_LABEL_UPPER[normalized] ?? normalized;
  const nav =
    typeof params.navAllocation === "number" && Number.isFinite(params.navAllocation) && params.navAllocation > 0
      ? `${Math.round(params.navAllocation)}%`
      : "-";
  return [
    `${signalIcon(normalized)} ${params.ticker.toUpperCase().trim()} - ${label}`,
    `Vùng mua: ${formatEntryK(params.entryPrice)}`,
    `Tỉ trọng: ${nav}`,
  ].join("\n");
}

function signalIcon(type: string) {
  const normalized = type.toUpperCase().trim();
  if (normalized === "SIEU_CO_PHIEU") return "👑"; // siêu cổ phiếu = leader, vua dòng tăng
  if (normalized === "TRUNG_HAN") return "📈"; // trung hạn = xu hướng tăng bền
  if (normalized === "DAU_CO") return "🌊"; // lướt sóng = đạp sóng ngắn hạn
  if (normalized === "TAM_NGAM") return "👀";
  return "📊";
}

function formatCompactRow(index: number, ticker: string, price: number | null | undefined, type: string) {
  const no = `${index})`.padStart(3, "0");
  const code = ticker.toUpperCase().trim().padEnd(4, " ");
  const entry = formatPrice(price).padStart(8, " ");
  return `${no} ${code} ${entry} ${signalIcon(type)}`;
}

function formatHoldingRow(index: number, signal: ActiveSignalRow) {
  const no = `${index})`.padStart(3, "0");
  const code = signal.ticker.toUpperCase().trim().padEnd(4, " ");
  const entry = formatPrice(signal.entryPrice).padStart(8, " ");
  const current = formatPrice(signal.currentPrice).padStart(8, " ");
  const nav = formatPercent(signal.navAllocation).padStart(8, " ");
  return `${no} ${code} ${entry} ${current} ${nav}`;
}

function chunkSignals<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
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
    `📊 Tổng số mã: ${params.signals.length}`,
    "",
  ];

  const chunks = chunkSignals(params.signals, 15);
  chunks.forEach((chunk, chunkIndex) => {
    lines.push(chunkIndex === 0 ? `⭐ ${chunk.length} mã mới nhất:` : `📎 ${chunk.length} mã tiếp theo:`);
    lines.push("```text");
    lines.push("STT MA      ENTRY HIEN TAI      NAV");
    chunk.forEach((signal, index) => {
      lines.push(formatHoldingRow(chunkIndex * 15 + index + 1, signal));
    });
    lines.push("```");
    lines.push("");
  });

  lines.push("— ADN Capital Scanner 🤖");
  return lines.join("\n").trim();
}

export async function sendClaimedSignalsToTelegram(params: {
  signals: SignalScanArtifactItem[];
  tradingDate: string;
  slotLabel: string;
  batchId: string;
}) {
  // Chỉ bắn các nhãn hành động (LƯỚT SÓNG / TRUNG HẠN / SIÊU CỔ PHIẾU).
  // Bỏ TẦM NGẮM (radar) — không bắn tín hiệu đang theo dõi.
  const actionable = params.signals.filter(
    (signal) => signal.type.toUpperCase().trim() !== "TAM_NGAM",
  );
  if (actionable.length === 0) {
    return { ok: true, skipped: true, reason: "no_actionable_signals" };
  }

  const { token, chatId } = getSignalTelegramTarget();

  // Lấy tỉ trọng (navAllocation) chuẩn từ bảng Signal đã lưu (lịch sử khuyến nghị).
  const tickers = Array.from(new Set(actionable.map((signal) => signal.ticker.toUpperCase().trim())));
  const rows = await prisma.signal.findMany({
    where: { ticker: { in: tickers } },
    orderBy: { updatedAt: "asc" },
    select: { ticker: true, navAllocation: true, entryPrice: true, reason: true },
  });
  const byTicker = new Map(rows.map((row) => [row.ticker.toUpperCase().trim(), row]));

  const MIN_NAV_PCT = 7; // bỏ qua mã tỉ trọng < 7% (quá nhỏ, không đáng mở vị thế)
  const perSignal: Array<{ ticker: string; result: Awaited<ReturnType<typeof sendTelegramOnce>> }> = [];
  for (const signal of actionable) {
    const ticker = signal.ticker.toUpperCase().trim();
    const db = byTicker.get(ticker);
    const navAllocation = db?.navAllocation ?? signal.navAllocation ?? null;
    if (typeof navAllocation !== "number" || navAllocation < MIN_NAV_PCT) {
      continue;
    }
    const text = formatSingleSignalText({
      ticker,
      type: signal.type,
      entryPrice: signal.entryPrice ?? db?.entryPrice ?? null,
      navAllocation,
    });
    // Chống trùng: mỗi mã chỉ bắn 1 lần/ngày.
    const result = await sendTelegramOnce({
      eventType: "SIGNAL",
      eventKey: `signal:${params.tradingDate}:${ticker}`,
      text,
      token,
      chatId,
      tradingDate: params.tradingDate,
      slot: params.slotLabel,
    });
    perSignal.push({ ticker, result });
  }

  return { ok: true, perSignal };
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
  const eventKey = `active-holdings-19h:v2:${params.tradingDate}:${digest}`;
  const text = formatActiveHoldingsText({ signals, tradingDate: params.tradingDate });

  return sendTelegramOnce({
    eventType: "ACTIVE_HOLDINGS_19H",
    eventKey,
    text,
    token,
    chatId,
    tradingDate: params.tradingDate,
    slot: params.slotLabel ?? "19:00",
    parseMode: "Markdown",
  });
}

// ── Hợp nhất Radar ↔ Telegram: bắn theo MUA/BÁN THẬT của tài khoản paper (1 nguồn sự thật) ──

export async function sendPaperBuyToTelegram(params: {
  ticker: string;
  signalType: string;
  entryPrice: number;
  navAllocation: number;
  reason?: string | null;
  tradingDate: string;
}) {
  const { token, chatId } = getSignalTelegramTarget();
  const text = formatSingleSignalText({
    ticker: params.ticker,
    type: params.signalType,
    entryPrice: params.entryPrice,
    navAllocation: params.navAllocation,
  });
  return sendTelegramOnce({
    eventType: "PAPER_BUY",
    eventKey: `paper-buy:${params.tradingDate}:${params.ticker.toUpperCase().trim()}`,
    text,
    token,
    chatId,
    tradingDate: params.tradingDate,
  });
}

export async function sendPaperSellToTelegram(params: {
  ticker: string;
  signalType: string;
  price: number;
  pnlPct: number;
  reason: string;
  tradingDate: string;
}) {
  const { token, chatId } = getSignalTelegramTarget();
  const normalized = params.signalType.toUpperCase().trim();
  const label = SIGNAL_LABEL_UPPER[normalized] ?? normalized;
  const pnl = Number.isFinite(params.pnlPct) ? Math.round(params.pnlPct) : 0;
  const pnlMark = pnl > 0 ? "✅" : pnl < 0 ? "🔻" : "➖";
  const text = [
    `${signalIcon(normalized)} ${params.ticker.toUpperCase().trim()} - BÁN (${label})`,
    `Giá bán: ${formatEntryK(params.price)}`,
    `Lãi/lỗ: ${pnlMark} ${pnl >= 0 ? "+" : ""}${pnl}%`,
  ].join("\n");
  return sendTelegramOnce({
    eventType: "PAPER_SELL",
    eventKey: `paper-sell:${params.tradingDate}:${params.ticker.toUpperCase().trim()}`,
    text,
    token,
    chatId,
    tradingDate: params.tradingDate,
  });
}

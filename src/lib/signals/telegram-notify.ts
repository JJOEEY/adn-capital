import { sendAdminTelegram } from "@/lib/n8n/internal";
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
  return sendAdminTelegram(text, {
    dedupeKey: `telegram:signal-scan:${params.tradingDate}:${params.batchId}`,
  });
}

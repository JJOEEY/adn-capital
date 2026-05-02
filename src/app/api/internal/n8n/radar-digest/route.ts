import { NextRequest, NextResponse } from "next/server";
import {
  formatMoney,
  getPublicBaseUrl,
  getTodayDedupeKey,
  isN8nAuthorized,
  readDataHubTopics,
  readString,
  sendAdminTelegram,
  toArray,
  toObject,
  topicHasUsableValue,
  unauthorizedResponse,
  writeN8nLog,
} from "@/lib/n8n/internal";
import { getVnDateISO } from "@/lib/time";

export const dynamic = "force-dynamic";

const SIGNAL_LABELS: Record<string, string> = {
  SIEU_CO_PHIEU: "Siêu cổ phiếu",
  TRUNG_HAN: "Trung hạn",
  DAU_CO: "Lướt sóng",
  TAM_NGAM: "Tầm ngắm",
};

function signalKey(row: Record<string, unknown>) {
  const ticker = readString(row.ticker).toUpperCase();
  const type = readString(row.type ?? row.signalType).toUpperCase();
  return ticker && type ? `${ticker}|${type}` : "";
}

function formatSignalLine(row: Record<string, unknown>, index: number) {
  const ticker = readString(row.ticker).toUpperCase();
  const type = readString(row.type ?? row.signalType).toUpperCase();
  const label = SIGNAL_LABELS[type] ?? type;
  const entry = formatMoney(row.entryPrice);
  const target = formatMoney(row.target);
  const stoploss = formatMoney(row.stoploss);
  const reason = readString(row.reason ?? row.aiReasoning ?? row.triggerSignal);
  const firstLine = `${index}. ${ticker} - ${label}: vùng mua ${entry}, chốt lời ${target}, cắt lỗ ${stoploss}`;
  return reason ? `${firstLine}\n   Lý do: ${reason.slice(0, 180)}` : firstLine;
}

export async function GET(req: NextRequest) {
  if (!isN8nAuthorized(req)) return unauthorizedResponse();

  const startedAt = Date.now();
  const searchParams = req.nextUrl.searchParams;
  const limit = Math.min(20, Math.max(1, Number.parseInt(searchParams.get("limit") ?? "10", 10)));
  const shouldSend = searchParams.get("send") === "1";
  const dryRun = searchParams.get("dryRun") === "1";

  const [radar, reported] = await readDataHubTopics(["signal:market:radar", "signal:reported:today"]);
  const radarRows = toArray(radar.value);
  const reportedRows = toArray(toObject(reported.value).rows ?? reported.value);
  const reportedKeys = new Set(reportedRows.map(signalKey).filter(Boolean));
  const freshRows = radarRows
    .filter((row) => {
      const key = signalKey(row);
      return key && !reportedKeys.has(key);
    })
    .slice(0, limit);

  const baseUrl = getPublicBaseUrl();
  const approvalUrl = `${baseUrl}/dashboard/signal-map`;
  const digestId = freshRows.map(signalKey).join(",");
  const dedupeKey = getTodayDedupeKey(["radar-digest", digestId || "empty"]);
  const title = `ADN Radar - tín hiệu cần duyệt ${getVnDateISO()}`;
  const summary =
    freshRows.length > 0
      ? `${freshRows.length} tín hiệu mới/chưa gửi trong ngày.`
      : "Chưa có tín hiệu mới cần duyệt.";

  const text = [
    title,
    summary,
    "",
    ...freshRows.map((row, index) => formatSignalLine(row, index + 1)),
    "",
    "Vui lòng kiểm tra trên ADN Radar trước khi copy nội dung sang nhóm khách hàng.",
    `Link duyệt: ${approvalUrl}`,
  ].filter(Boolean).join("\n");

  const telegram = shouldSend
    ? await sendAdminTelegram(text, { dedupeKey: `telegram:${dedupeKey}`, dryRun })
    : { ok: true, skipped: true, reason: "send_not_requested" };

  await writeN8nLog(
    "n8n:radar-digest",
    freshRows.length > 0 ? "success" : "skipped",
    summary,
    { dedupeKey, count: freshRows.length, sent: shouldSend, dryRun },
    startedAt,
  );

  return NextResponse.json({
    ok: true,
    dryRun,
    sent: shouldSend,
    payload: {
      type: "radar_digest",
      title,
      summary,
      sourceUrl: approvalUrl,
      approvalUrl,
      createdAt: new Date().toISOString(),
    },
    telegram,
    topics: [
      { topic: radar.topic, freshness: radar.freshness, hasValue: topicHasUsableValue(radar) },
      { topic: reported.topic, freshness: reported.freshness, hasValue: topicHasUsableValue(reported) },
    ],
    signals: freshRows,
  });
}

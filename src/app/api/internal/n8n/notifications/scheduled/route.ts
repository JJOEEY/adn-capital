import { NextRequest, NextResponse } from "next/server";
import { pushNotification } from "@/lib/cronHelpers";
import {
  badRequestResponse,
  getTodayDedupeKey,
  hasDedupeLog,
  isN8nAuthorized,
  readDataHubTopics,
  readJsonBody,
  readNumber,
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

const SLOT_CONFIG = {
  "10:00": {
    type: "n8n_stats_10h",
    title: "Cập nhật thị trường 10:00",
    topics: ["vn:index:overview", "brief:morning:latest", "signal:market:radar", "signal:reported:today"],
  },
  "11:30": {
    type: "n8n_stats_1130",
    title: "Cập nhật thị trường 11:30",
    topics: ["vn:index:overview", "signal:market:radar", "signal:reported:today"],
  },
  "14:00": {
    type: "n8n_stats_14h",
    title: "Cập nhật thị trường 14:00",
    topics: ["vn:index:overview", "signal:market:radar", "signal:reported:today"],
  },
  "14:45": {
    type: "n8n_stats_1445",
    title: "Cập nhật cuối phiên 14:45",
    topics: ["vn:index:overview", "brief:close:latest", "signal:market:active", "signal:reported:today"],
  },
} as const;

type SlotLabel = keyof typeof SLOT_CONFIG;

function normalizeSlot(value: unknown): SlotLabel | null {
  const raw = readString(value).replace(/\s/g, "").toLowerCase();
  const aliases: Record<string, SlotLabel> = {
    "10": "10:00",
    "10h": "10:00",
    "10:00": "10:00",
    "1000": "10:00",
    "11h30": "11:30",
    "11:30": "11:30",
    "1130": "11:30",
    "14": "14:00",
    "14h": "14:00",
    "14:00": "14:00",
    "1400": "14:00",
    "14h45": "14:45",
    "14:45": "14:45",
    "1445": "14:45",
  };
  return aliases[raw] ?? null;
}

function readMarketLine(value: unknown) {
  const record = toObject(value);
  const vnindex = toObject(record.vnindex ?? record.VNINDEX ?? record.index ?? record.market);
  const point =
    readNumber(vnindex.point ?? vnindex.close ?? vnindex.value ?? record.vnindex) ??
    readNumber(record.indexValue);
  const changePct =
    readNumber(vnindex.changePercent ?? vnindex.changePct ?? vnindex.percent ?? record.changePercent) ??
    readNumber(record.changePct);
  if (point == null && changePct == null) return "đang cập nhật";
  const pointLabel = point == null ? "" : point.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
  const pctLabel = changePct == null ? "" : `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%`;
  return [pointLabel, pctLabel].filter(Boolean).join(" ");
}

function readBriefTitle(value: unknown) {
  const record = toObject(value);
  return readString(record.title || record.reportTitle || record.heading);
}

export async function POST(req: NextRequest) {
  if (!isN8nAuthorized(req)) return unauthorizedResponse();

  const parsed = await readJsonBody<{ slot?: unknown; dryRun?: unknown }>(req);
  if (!parsed.ok) return parsed.response;

  const slot = normalizeSlot(parsed.data.slot);
  if (!slot) return badRequestResponse("slot must be one of 10:00, 11:30, 14:00, 14:45");

  const startedAt = Date.now();
  const dryRun = parsed.data.dryRun === true;
  const config = SLOT_CONFIG[slot];
  const dedupeKey = getTodayDedupeKey(["scheduled", slot]);

  const existing = await hasDedupeLog("n8n:scheduled", dedupeKey, 30);
  if (existing && !dryRun) {
    return NextResponse.json({ ok: true, slot, deduped: true, dedupeKey });
  }

  const envelopes = await readDataHubTopics([...config.topics]);
  const byTopic = new Map(envelopes.map((envelope) => [envelope.topic, envelope]));
  const market = byTopic.get("vn:index:overview");
  const radar = byTopic.get("signal:market:radar") ?? byTopic.get("signal:market:active");
  const reported = byTopic.get("signal:reported:today");
  const brief = byTopic.get("brief:morning:latest") ?? byTopic.get("brief:close:latest");

  const radarCount = toArray(radar?.value).length;
  const reportedTotal = readNumber(toObject(reported?.value).total) ?? toArray(reported?.value).length;
  const briefTitle = brief && topicHasUsableValue(brief) ? readBriefTitle(brief.value) : "";

  const contentLines = [
    `${config.title} ngày ${getVnDateISO()}`,
    `- Thị trường: ${readMarketLine(market?.value)}`,
    `- ADN Radar: ${radarCount} mã đang theo dõi`,
    `- Tín hiệu đã báo hôm nay: ${reportedTotal} mã`,
    briefTitle ? `- Bản tin mới nhất: ${briefTitle}` : "",
  ].filter(Boolean);
  const content = contentLines.join("\n");

  const notificationId = dryRun ? null : await pushNotification(config.type, config.title, content);
  const telegram = await sendAdminTelegram(
    [
      `ADN Capital - ${config.title}`,
      content,
      "",
      dryRun ? "Chế độ thử: chưa gửi thông báo cho khách hàng." : "Đã tạo thông báo Web/PWA.",
    ].join("\n"),
    { dedupeKey: `telegram:${dedupeKey}`, dryRun },
  );

  if (!dryRun) {
    await writeN8nLog("n8n:scheduled", "success", `${config.title} dispatched`, {
      dedupeKey,
      slot,
      notificationId,
      topics: config.topics,
    }, startedAt);
  }

  return NextResponse.json({
    ok: true,
    slot,
    dryRun,
    dedupeKey,
    notificationId,
    telegram,
    topics: envelopes.map((envelope) => ({
      topic: envelope.topic,
      freshness: envelope.freshness,
      hasValue: topicHasUsableValue(envelope),
      error: envelope.error?.code ?? null,
    })),
  });
}

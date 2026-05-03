import { ImageResponse } from "next/og";
import { NextRequest, NextResponse } from "next/server";
import {
  BRIEF_IMAGE_HEIGHT,
  BRIEF_IMAGE_WIDTH,
  briefImageCaption,
  type BriefImageKind,
  renderBriefImage,
} from "@/lib/n8n/brief-image-render";
import {
  badRequestResponse,
  getTodayDedupeKey,
  isN8nAuthorized,
  readDataHubTopic,
  readJsonBody,
  readString,
  sendAdminTelegramPhoto,
  topicHasUsableValue,
  unauthorizedResponse,
  writeN8nLog,
} from "@/lib/n8n/internal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type BriefImageBody = {
  type?: unknown;
  sendTelegram?: unknown;
  chatId?: unknown;
  dryRun?: unknown;
};

function normalizeKind(value: unknown): BriefImageKind | null {
  const raw = readString(value).toLowerCase();
  if (["morning", "sang", "brief-sang", "morning-brief"].includes(raw)) return "morning";
  if (["eod", "evening", "close", "tong-hop", "cuoi-ngay"].includes(raw)) return "eod";
  return null;
}

function topicForKind(kind: BriefImageKind) {
  return kind === "morning" ? "brief:morning:latest" : "brief:eod:latest";
}

async function createBriefPng(kind: BriefImageKind) {
  const startedAt = Date.now();
  const topic = topicForKind(kind);
  const envelope = await readDataHubTopic(topic);
  if (!topicHasUsableValue(envelope)) {
    await writeN8nLog("n8n:brief-image", "skipped", "brief_topic_empty", { topic, kind }, startedAt);
    return { ok: false as const, status: 503, error: "BRIEF_NOT_READY" };
  }

  const response = new ImageResponse(renderBriefImage(kind, envelope.value), {
    width: BRIEF_IMAGE_WIDTH,
    height: BRIEF_IMAGE_HEIGHT,
  });
  const buffer = new Uint8Array(await response.arrayBuffer());
  return {
    ok: true as const,
    topic,
    value: envelope.value,
    buffer,
    caption: briefImageCaption(kind, envelope.value),
  };
}

export async function GET(req: NextRequest) {
  if (!isN8nAuthorized(req)) return unauthorizedResponse();

  const kind = normalizeKind(req.nextUrl.searchParams.get("type") ?? "morning");
  if (!kind) return badRequestResponse("Invalid brief image type");

  const image = await createBriefPng(kind);
  if (!image.ok) {
    return NextResponse.json(
      { ok: false, error: { code: image.error, message: "Brief image is not ready" } },
      { status: image.status },
    );
  }

  return new Response(image.buffer, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
      "Content-Disposition": `inline; filename="adn-${kind}-brief.png"`,
    },
  });
}

export async function POST(req: NextRequest) {
  if (!isN8nAuthorized(req)) return unauthorizedResponse();

  const startedAt = Date.now();
  const parsed = await readJsonBody<BriefImageBody>(req);
  if (!parsed.ok) return parsed.response;

  const kind = normalizeKind(parsed.data.type ?? "morning");
  if (!kind) return badRequestResponse("Invalid brief image type");

  const sendTelegram = parsed.data.sendTelegram !== false;
  const dryRun = parsed.data.dryRun === true || readString(parsed.data.dryRun).toLowerCase() === "true";
  const chatId = readString(parsed.data.chatId);
  const image = await createBriefPng(kind);
  if (!image.ok) {
    return NextResponse.json(
      { ok: false, error: { code: image.error, message: "Brief image is not ready" } },
      { status: image.status },
    );
  }

  let telegram: Awaited<ReturnType<typeof sendAdminTelegramPhoto>> | null = null;
  if (sendTelegram) {
    telegram = await sendAdminTelegramPhoto(image.buffer, image.caption, {
      chatId: chatId || undefined,
      dryRun,
      filename: `adn-${kind}-brief.png`,
      dedupeKey: getTodayDedupeKey(["brief-image", kind, chatId || "default"]),
    });
  }

  await writeN8nLog(
    "n8n:brief-image",
    telegram?.ok === false ? "error" : "success",
    sendTelegram ? "brief_image_telegram" : "brief_image_rendered",
    {
      kind,
      topic: image.topic,
      sentTelegram: Boolean(sendTelegram),
      telegramSkipped: telegram?.skipped ?? null,
      telegramStatus: telegram && "status" in telegram ? telegram.status : null,
    },
    startedAt,
  );

  return NextResponse.json({
    ok: telegram?.ok !== false,
    type: kind,
    topic: image.topic,
    caption: image.caption,
    bytes: image.buffer.byteLength,
    sentTelegram: Boolean(sendTelegram),
    telegram,
  });
}

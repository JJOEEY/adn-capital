import { createHash } from "crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getTopicEnvelope } from "@/lib/datahub/core";
import type { TopicEnvelope } from "@/lib/datahub/types";
import { prisma } from "@/lib/prisma";
import { getVnDateISO, getVnTimeLabel } from "@/lib/time";

export type InternalApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

export function isN8nAuthorized(req: NextRequest): boolean {
  const expected = (process.env.INTERNAL_API_KEY ?? process.env.CRON_SECRET ?? "").trim();
  if (!expected) return false;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const provided = (
    req.headers.get("x-internal-key") ??
    req.headers.get("x-cron-secret") ??
    bearer ??
    ""
  ).trim();
  return Boolean(provided && provided === expected);
}

export function unauthorizedResponse() {
  return NextResponse.json(
    { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
    { status: 401 },
  );
}

export function badRequestResponse(message: string, details?: unknown) {
  return NextResponse.json(
    { error: { code: "BAD_REQUEST", message, details } },
    { status: 400 },
  );
}

export async function readJsonBody<T extends Record<string, unknown>>(
  req: NextRequest,
): Promise<InternalApiResult<T>> {
  try {
    const body = (await req.json()) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return { ok: false, response: badRequestResponse("Invalid JSON payload") };
    }
    return { ok: true, data: body as T };
  } catch {
    return { ok: true, data: {} as T };
  }
}

export async function readDataHubTopic(topic: string): Promise<TopicEnvelope> {
  return getTopicEnvelope(topic, { force: false, userId: null });
}

export async function readDataHubTopics(topics: string[]) {
  return Promise.all(topics.map((topic) => readDataHubTopic(topic)));
}

export function topicHasUsableValue(envelope: TopicEnvelope): boolean {
  if (envelope.error || envelope.freshness === "error") return false;
  if (envelope.value == null) return false;
  if (Array.isArray(envelope.value)) return envelope.value.length > 0;
  if (typeof envelope.value === "object") return Object.keys(envelope.value as Record<string, unknown>).length > 0;
  return true;
}

export function toObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function toArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
  const record = toObject(value);
  for (const key of ["items", "rows", "signals", "data", "results"]) {
    const candidate = record[key];
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
    }
  }
  return [];
}

export function readString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

export function readNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatMoney(value: unknown): string {
  const number = readNumber(value);
  if (number == null) return "-";
  return number.toLocaleString("vi-VN", { maximumFractionDigits: 0 });
}

export function getPublicBaseUrl() {
  return (
    process.env.NEXTAUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.PUBLIC_APP_URL ??
    "https://adncapital.com.vn"
  ).replace(/\/$/, "");
}

export function getTodayDedupeKey(parts: string[]) {
  return ["n8n", getVnDateISO(), ...parts].join(":");
}

export async function hasDedupeLog(cronName: string, dedupeKey: string, windowHours = 24) {
  const cutoff = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const existing = await prisma.cronLog.findFirst({
    where: {
      cronName,
      createdAt: { gte: cutoff },
      resultData: { contains: dedupeKey },
    },
    select: { id: true },
  });
  return Boolean(existing);
}

export async function writeN8nLog(
  cronName: string,
  status: "success" | "error" | "skipped",
  message: string,
  resultData?: unknown,
  startedAt = Date.now(),
) {
  await prisma.cronLog.create({
    data: {
      cronName,
      status,
      message,
      duration: Math.max(0, Date.now() - startedAt),
      resultData: resultData ? JSON.stringify(resultData) : null,
    },
  });
}

function getTelegramTargetChatId(override?: string) {
  return (
    override ??
    process.env.TELEGRAM_ADMIN_CHAT_ID ??
    process.env.TELEGRAM_CHAT_ID ??
    process.env.N8N_TELEGRAM_ADMIN_CHAT_ID ??
    process.env.N8N_TELEGRAM_CHECKLIST_CHAT_ID ??
    ""
  ).trim();
}

export async function sendAdminTelegram(text: string, options: { dedupeKey?: string; dryRun?: boolean; chatId?: string } = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN ?? "";
  const chatId = getTelegramTargetChatId(options.chatId);
  const textHash = createHash("sha256").update(text).digest("hex").slice(0, 24);
  const dedupeKey = options.dedupeKey ?? `telegram:${textHash}`;

  if (options.dryRun) {
    return { ok: true, skipped: true, reason: "dry_run", textHash, dedupeKey };
  }
  if (!token || !chatId) {
    return { ok: true, skipped: true, reason: "telegram_not_configured", textHash, dedupeKey };
  }
  if (await hasDedupeLog("n8n:telegram", dedupeKey, 24)) {
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
    await writeN8nLog("n8n:telegram", "error", `telegram_http_${response.status}`, { dedupeKey, textHash });
    return { ok: false, skipped: false, status: response.status, payload, textHash, dedupeKey };
  }

  await writeN8nLog("n8n:telegram", "success", "sent", { dedupeKey, textHash });
  return { ok: true, skipped: false, status: response.status, payload, textHash, dedupeKey };
}

export async function sendAdminTelegramPhoto(
  photo: Uint8Array,
  caption: string,
  options: { dedupeKey?: string; dryRun?: boolean; chatId?: string; filename?: string } = {},
) {
  const token = process.env.TELEGRAM_BOT_TOKEN ?? "";
  const chatId = getTelegramTargetChatId(options.chatId);
  const captionHash = createHash("sha256")
    .update(`${caption}:${photo.byteLength}`)
    .digest("hex")
    .slice(0, 24);
  const dedupeKey = options.dedupeKey ?? `telegram-photo:${captionHash}`;

  if (options.dryRun) {
    return { ok: true, skipped: true, reason: "dry_run", captionHash, dedupeKey };
  }
  if (!token || !chatId) {
    return { ok: true, skipped: true, reason: "telegram_not_configured", captionHash, dedupeKey };
  }
  if (await hasDedupeLog("n8n:telegram-photo", dedupeKey, 24)) {
    return { ok: true, skipped: true, reason: "duplicate_suppressed", captionHash, dedupeKey };
  }

  const form = new FormData();
  form.set("chat_id", chatId);
  form.set("caption", caption.slice(0, 1024));
  form.set("photo", new Blob([new Uint8Array(photo)], { type: "image/png" }), options.filename ?? "adn-brief.png");

  const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: "POST",
    body: form,
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    await writeN8nLog("n8n:telegram-photo", "error", `telegram_http_${response.status}`, {
      dedupeKey,
      captionHash,
    });
    return { ok: false, skipped: false, status: response.status, payload, captionHash, dedupeKey };
  }

  await writeN8nLog("n8n:telegram-photo", "success", "sent", { dedupeKey, captionHash });
  return { ok: true, skipped: false, status: response.status, payload, captionHash, dedupeKey };
}

export function nowForOpsLabel() {
  return `${getVnDateISO()} ${getVnTimeLabel()}`;
}

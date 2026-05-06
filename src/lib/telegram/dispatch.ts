import { createHash } from "crypto";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type TelegramDispatchEventType =
  | "MORNING_BRIEF"
  | "EOD_15H"
  | "EOD_19H"
  | "SIGNAL_BATCH"
  | "SIGNAL_ACTIVE"
  | "ACTIVE_HOLDINGS_19H"
  | string;

export type SendTelegramOnceParams = {
  eventType: TelegramDispatchEventType;
  eventKey: string;
  text: string;
  token: string | null | undefined;
  chatId: string | null | undefined;
  tradingDate?: string | null;
  slot?: string | null;
  parseMode?: "Markdown";
  disableWebPagePreview?: boolean;
};

export type SendTelegramOnceResult =
  | { ok: true; sent: true; skipped?: false; eventKey: string }
  | { ok: true; sent: false; skipped: true; reason: string; eventKey: string }
  | { ok: false; sent: false; skipped?: false; error: string; eventKey: string };

export function telegramHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function splitTelegramText(text: string, max = 3900): string[] {
  if (text.length <= max) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > max) {
    const cut = rest.lastIndexOf("\n", max);
    const size = cut > max * 0.6 ? cut : max;
    chunks.push(rest.slice(0, size));
    rest = rest.slice(size).trimStart();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

async function createOrMarkSending(params: {
  eventType: string;
  eventKey: string;
  payloadHash: string;
  targetChatIdHash: string | null;
  tradingDate?: string | null;
  slot?: string | null;
}): Promise<"send" | "duplicate" | "in_progress"> {
  const existing = await prisma.telegramDispatchLog.findUnique({
    where: { eventKey: params.eventKey },
  });

  if (existing?.status === "sent") return "duplicate";
  if (
    existing?.status === "sending" &&
    Date.now() - existing.updatedAt.getTime() < 5 * 60 * 1000
  ) {
    return "in_progress";
  }

  if (!existing) {
    try {
      await prisma.telegramDispatchLog.create({
        data: {
          eventKey: params.eventKey,
          eventType: params.eventType,
          tradingDate: params.tradingDate ?? null,
          slot: params.slot ?? null,
          payloadHash: params.payloadHash,
          targetChatIdHash: params.targetChatIdHash,
          status: "sending",
        },
      });
      return "send";
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const raced = await prisma.telegramDispatchLog.findUnique({
          where: { eventKey: params.eventKey },
        });
        return raced?.status === "sent" ? "duplicate" : "in_progress";
      }
      throw error;
    }
  }

  await prisma.telegramDispatchLog.update({
    where: { eventKey: params.eventKey },
    data: {
      eventType: params.eventType,
      tradingDate: params.tradingDate ?? existing.tradingDate,
      slot: params.slot ?? existing.slot,
      payloadHash: params.payloadHash,
      targetChatIdHash: params.targetChatIdHash,
      status: "sending",
      error: null,
    },
  });
  return "send";
}

export async function sendTelegramOnce(
  params: SendTelegramOnceParams,
): Promise<SendTelegramOnceResult> {
  const eventKey = params.eventKey.trim();
  const text = params.text.trim();
  const token = params.token?.trim();
  const chatId = params.chatId?.trim();

  if (!eventKey) {
    return { ok: false, sent: false, error: "missing_event_key", eventKey };
  }
  if (!text) {
    return {
      ok: true,
      sent: false,
      skipped: true,
      reason: "empty_text",
      eventKey,
    };
  }
  if (!token || !chatId) {
    return {
      ok: true,
      sent: false,
      skipped: true,
      reason: "telegram_not_configured",
      eventKey,
    };
  }

  const payloadHash = telegramHash(text);
  const targetChatIdHash = telegramHash(chatId).slice(0, 24);
  const decision = await createOrMarkSending({
    eventType: params.eventType,
    eventKey,
    payloadHash,
    targetChatIdHash,
    tradingDate: params.tradingDate,
    slot: params.slot,
  });

  if (decision === "duplicate") {
    return {
      ok: true,
      sent: false,
      skipped: true,
      reason: "duplicate_skipped",
      eventKey,
    };
  }
  if (decision === "in_progress") {
    return {
      ok: true,
      sent: false,
      skipped: true,
      reason: "send_in_progress",
      eventKey,
    };
  }

  try {
    for (const chunk of splitTelegramText(text)) {
      const sendChunk = (parseMode?: "Markdown") => {
        const body: Record<string, unknown> = {
          chat_id: chatId,
          text: chunk,
          disable_web_page_preview: params.disableWebPagePreview ?? true,
        };
        if (parseMode) body.parse_mode = parseMode;
        return fetch(
          `https://api.telegram.org/bot${token}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
      };

      let response = await sendChunk(params.parseMode);
      if (!response.ok && response.status === 400 && params.parseMode) {
        response = await sendChunk();
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`Telegram HTTP ${response.status}: ${errorText.slice(0, 240)}`);
      }
    }

    await prisma.telegramDispatchLog.update({
      where: { eventKey },
      data: {
        status: "sent",
        payloadHash,
        targetChatIdHash,
        sentAt: new Date(),
        error: null,
      },
    });
    return { ok: true, sent: true, eventKey };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.telegramDispatchLog.update({
      where: { eventKey },
      data: {
        status: "error",
        error: message.slice(0, 1000),
      },
    });
    return { ok: false, sent: false, error: message, eventKey };
  }
}

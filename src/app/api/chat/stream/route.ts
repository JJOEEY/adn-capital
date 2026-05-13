import { NextRequest, NextResponse } from "next/server";
import { consumeChatQuota, resolveChatQuota, type ChatUsageMeta } from "@/lib/chat-quota";
import { getCurrentDbUser } from "@/lib/current-user";
import {
  finalizeAidenPreparedAnswer,
  prepareAidenDatahubTurn,
  type AidenDatahubPreparedTurn,
} from "@/lib/aiden/datahub-chat";
import { streamFlashOnlyAIRequest } from "@/lib/gemini";
import { prisma } from "@/lib/prisma";
import { sanitizeCustomerVisibleAiText } from "@/lib/ai-output-sanitizer";

export const dynamic = "force-dynamic";

type ChatSurface = "aiden" | "stock";

function normalizeChatSurface(input?: string | null, fallback: ChatSurface = "aiden"): ChatSurface {
  if (input === "stock" || input === "aiden") return input;
  return fallback;
}

function chatData(userId: string, message: string, role: string, surface: ChatSurface) {
  return { userId, message, role, surface };
}

function streamHeaders() {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  };
}

function sse(event: "meta" | "delta" | "done" | "error", data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function write(controller: ReadableStreamDefaultController<Uint8Array>, event: Parameters<typeof sse>[0], data: unknown) {
  controller.enqueue(new TextEncoder().encode(sse(event, data)));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function writeTypewriterText(
  controller: ReadableStreamDefaultController<Uint8Array>,
  text: string,
  signal: AbortSignal,
) {
  const chars = Array.from(text);
  for (let index = 0; index < chars.length; index += 2) {
    if (signal.aborted) return;
    write(controller, "delta", { text: chars.slice(index, index + 2).join("") });
    await sleep(8);
  }
}

function quotaErrorStream(usage: ChatUsageMeta) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      write(controller, "error", {
        code: "LIMIT_REACHED",
        message: "Bạn đã dùng hết lượt tư vấn hôm nay. Nâng cấp VIP để tiếp tục.",
        usage,
      });
      controller.close();
    },
  });
  return new Response(stream, { status: 429, headers: streamHeaders() });
}

function writeMeta(controller: ReadableStreamDefaultController<Uint8Array>, turn: AidenDatahubPreparedTurn) {
  write(controller, "meta", {
    id: crypto.randomUUID(),
    intent: turn.intent,
    tickers: turn.tickers,
    model: turn.model,
    usedTopics: turn.usedTopics,
  });
}

export async function POST(request: NextRequest) {
  let body: {
    message?: string;
    guestUsage?: number;
    currentTicker?: string | null;
    ticker?: string | null;
    surface?: string | null;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Tin nhắn không hợp lệ." }, { status: 400 });
  }

  const message = (body.message ?? "").trim();
  if (!message) {
    return NextResponse.json({ error: "Tin nhắn không được để trống." }, { status: 400 });
  }

  const dbUser = await getCurrentDbUser();
  const userId = dbUser?.id ?? null;
  const currentTicker = body.currentTicker ?? body.ticker ?? null;
  const surface = normalizeChatSurface(body.surface, currentTicker ? "stock" : "aiden");
  const quota = await resolveChatQuota({ userId, guestUsage: body.guestUsage ?? 0 });
  if (quota.usage.isLimitReached) {
    return quotaErrorStream(quota.usage);
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const turn = await prepareAidenDatahubTurn({
          message,
          currentTicker,
          surface,
          context: {
            userId,
            userRole: dbUser?.role ?? null,
            systemRole: dbUser?.systemRole ?? null,
          },
        });
        writeMeta(controller, turn);

        let rawAnswer = "";
        let finalMessage = "";
        if (turn.staticMessage) {
          rawAnswer = turn.staticMessage;
          finalMessage = sanitizeCustomerVisibleAiText(finalizeAidenPreparedAnswer(rawAnswer, turn));
          await writeTypewriterText(controller, finalMessage, request.signal);
        } else if (turn.prompt) {
          let typewriterQueue = Promise.resolve();
          rawAnswer = await streamFlashOnlyAIRequest(
            turn.prompt,
            turn.systemInstruction,
            (text) => {
              typewriterQueue = typewriterQueue.then(() => writeTypewriterText(controller, text, request.signal));
            },
            { signal: request.signal },
          );
          await typewriterQueue;
          finalMessage = sanitizeCustomerVisibleAiText(finalizeAidenPreparedAnswer(rawAnswer, turn));
        } else {
          rawAnswer = turn.fallbackMessage;
          finalMessage = sanitizeCustomerVisibleAiText(finalizeAidenPreparedAnswer(rawAnswer, turn));
          await writeTypewriterText(controller, finalMessage, request.signal);
        }

        const usageAfter = await consumeChatQuota(quota);
        if (userId) {
          await prisma.$transaction([
            prisma.chat.create({ data: chatData(userId, message, "user", surface) }),
            prisma.chat.create({ data: chatData(userId, finalMessage, "assistant", surface) }),
          ]);
        }

        write(controller, "done", {
          message: finalMessage,
          usage: usageAfter,
          recommendation: turn.recommendation,
          ticker: turn.ticker,
          tickers: turn.tickers,
        });
        controller.close();
      } catch (error) {
        if (request.signal.aborted) {
          controller.close();
          return;
        }
        console.error("[/api/chat/stream] Error:", error);
        write(controller, "error", {
          code: "AIDEN_STREAM_FAILED",
          message: "AIDEN đang gặp lỗi khi trả lời. Vui lòng thử lại sau ít phút.",
        });
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: streamHeaders() });
}

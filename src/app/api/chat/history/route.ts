import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentDbUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

type ChatSurface = "aiden" | "stock";

type BrokerBadge = "MUA" | "GIỮ" | "BÁN";

type HistoryMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  streamState: "done";
  widgetMeta?: {
    complete: boolean;
    ticker?: string;
    badge?: BrokerBadge;
  };
};

function normalizeBadge(input?: string): BrokerBadge {
  if (!input) return "GIỮ";

  const normalized = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Đ/g, "D")
    .replace(/đ/g, "d")
    .toUpperCase()
    .trim();

  if (normalized === "MUA" || normalized === "BUY" || normalized === "BULL") return "MUA";
  if (normalized === "BAN" || normalized === "SELL" || normalized === "BEAR") return "BÁN";
  return "GIỮ";
}

function parseWidgetMessage(raw: string): { ticker?: string; badge: BrokerBadge; text?: string } | null {
  const match = raw.match(/^\[WIDGET(?::MOCK)?:([A-Z]{2,5})(?::([^\]]+))?\]\s*([\s\S]*)$/u);
  if (!match) return null;

  const text = match[3]?.trim();
  return {
    ticker: match[1],
    badge: normalizeBadge(match[2]),
    text: text || undefined,
  };
}

function normalizeSurface(input: string | null): ChatSurface | null {
  if (input === "aiden" || input === "stock") return input;
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const dbUser = await getCurrentDbUser();
    if (!dbUser?.id) {
      return NextResponse.json({ messages: [] as HistoryMessage[] });
    }

    const limit = Math.min(
      parseInt(request.nextUrl.searchParams.get("limit") ?? "50", 10) || 50,
      200
    );
    const surface = normalizeSurface(request.nextUrl.searchParams.get("surface"));

    const rows = await prisma.chat.findMany({
      where: surface ? { userId: dbUser.id, surface } : { userId: dbUser.id },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        role: true,
        message: true,
        createdAt: true,
      },
    });

    const messages: HistoryMessage[] = rows
      .reverse()
      .map((row) => {
        const isAssistant = row.role === "assistant" || row.role === "bot";
        const role: "user" | "assistant" = isAssistant ? "assistant" : "user";
        const widget = parseWidgetMessage(row.message);

        if (widget) {
          return {
            id: row.id,
            role: "assistant" as const,
            text: widget.text ?? `Phân tích nhanh mã ${widget.ticker}.`,
            createdAt: row.createdAt.toISOString(),
            streamState: "done" as const,
            widgetMeta: {
              complete: true,
              ticker: widget.ticker,
              badge: widget.badge,
            },
          };
        }

        return {
          id: row.id,
          role,
          text: row.message,
          createdAt: row.createdAt.toISOString(),
          streamState: "done" as const,
        };
      })
      .slice(-limit);

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("[/api/chat/history] Error:", error);
    return NextResponse.json({ error: "Không thể tải lịch sử chat" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const dbUser = await getCurrentDbUser();
    if (!dbUser?.id) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const body = (await request.json()) as { role?: string; message?: string; surface?: string | null };
    const message = (body.message ?? "").trim();
    if (!message) {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }

    const normalizedRole = body.role === "user" ? "user" : "assistant";
    const surface = normalizeSurface(body.surface ?? null) ?? "aiden";
    await prisma.chat.create({
      data: {
        userId: dbUser.id,
        role: normalizedRole,
        message: message.slice(0, 12000),
        surface,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[/api/chat/history POST] Error:", error);
    return NextResponse.json({ error: "Không thể lưu lịch sử chat" }, { status: 500 });
  }
}

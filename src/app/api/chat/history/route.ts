import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentDbUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

type HistoryMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  streamState: "done";
  widgetMeta?: {
    complete: boolean;
    ticker?: string;
    badge?: "MUA" | "GIỮ" | "BÁN";
  };
};

function parseWidgetMessage(raw: string): { ticker?: string; badge: "MUA" | "GIỮ" | "BÁN" } | null {
  const match = raw.match(/\[WIDGET(?::MOCK)?:([A-Z]{2,5})\]/);
  if (!match) return null;
  return { ticker: match[1], badge: "GIỮ" };
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

    const rows = await prisma.chat.findMany({
      where: { userId: dbUser.id },
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
            text: `Phân tích nhanh mã ${widget.ticker}.`,
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

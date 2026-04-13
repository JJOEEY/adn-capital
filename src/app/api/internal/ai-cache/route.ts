import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/internal/ai-cache
 * GET /api/internal/ai-cache?type=ta|fa|tamly&ticker=...&date=...
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const ticker = searchParams.get("ticker")?.toUpperCase();

  if (!type || !ticker) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  try {
    if (type === "ta") {
      const cache = await prisma.aiTaCache.findFirst({
        where: { ticker },
        orderBy: { createdAt: "desc" }
      });
      // Logic kiểm tra vỡ support/resistance sẽ làm ở Bridge hoặc tại đây.
      // Tạm thời trả về bản mới nhất trong 1h.
      if (cache && (Date.now() - new Date(cache.createdAt).getTime() < 3600000)) {
        return NextResponse.json(cache);
      }
    } else if (type === "fa") {
      const cache = await prisma.aiFaCache.findFirst({
        where: { ticker },
        orderBy: { createdAt: "desc" }
      });
      if (cache && (Date.now() - new Date(cache.createdAt).getTime() < 86400000)) {
        return NextResponse.json(cache);
      }
    } else if (type === "tamly") {
      const dateStr = searchParams.get("date");
      const cache = await prisma.aiTamlyCache.findFirst({
        where: { ticker, date: dateStr || undefined },
        orderBy: { createdAt: "desc" }
      });
      if (cache) return NextResponse.json(cache);
    }

    return NextResponse.json(null);
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { type, ticker, data } = body;

    if (type === "ta") {
      await prisma.aiTaCache.create({
        data: {
          ticker,
          analysis: data.analysis,
          mediaUrl: data.media_url,
          support: data.support,
          resistance: data.resistance,
          signal: data.signal,
          entryPrice: data.price
        }
      });
    } else if (type === "fa") {
      await prisma.aiFaCache.create({
        data: {
          ticker,
          analysis: data.analysis,
          quarter: data.quarter
        }
      });
    } else if (type === "tamly") {
      await prisma.aiTamlyCache.create({
        data: {
          ticker,
          date: data.date,
          analysis: data.analysis
        }
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Cache error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

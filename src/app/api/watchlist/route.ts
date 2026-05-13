import { NextResponse, type NextRequest } from "next/server";
import { getCurrentDbUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { normalizeSignalPrice } from "@/lib/signals/price-units";

export const dynamic = "force-dynamic";

function normalizeTicker(value: unknown) {
  const ticker = String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "");
  return /^[A-Z0-9._-]{2,12}$/.test(ticker) ? ticker : "";
}

async function loadWatchlist(userId: string) {
  const items = await prisma.userWatchlistItem.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      ticker: true,
      source: true,
      sourceSignalId: true,
      note: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const tickers = items.map((item) => item.ticker);
  const signals = tickers.length
    ? await prisma.signal.findMany({
        where: { ticker: { in: tickers } },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          ticker: true,
          status: true,
          tier: true,
          type: true,
          entryPrice: true,
          currentPrice: true,
          currentPnl: true,
          target: true,
          stoploss: true,
          updatedAt: true,
        },
      })
    : [];

  const latestByTicker = new Map<string, (typeof signals)[number]>();
  for (const signal of signals) {
    if (!latestByTicker.has(signal.ticker)) latestByTicker.set(signal.ticker, signal);
  }

  return {
    items: items.map((item) => {
      const signal = latestByTicker.get(item.ticker);
      const entryPrice = signal ? normalizeSignalPrice(signal.entryPrice) : null;
      const currentPrice = signal ? normalizeSignalPrice(signal.currentPrice) : null;
      return {
        ...item,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        signal: signal
          ? {
              id: signal.id,
              status: signal.status,
              tier: signal.tier,
              type: signal.type,
              entryPrice,
              currentPrice,
              currentPnl: signal.currentPnl,
              target: normalizeSignalPrice(signal.target),
              stoploss: normalizeSignalPrice(signal.stoploss),
              updatedAt: signal.updatedAt.toISOString(),
            }
          : null,
      };
    }),
  };
}

export async function GET() {
  const dbUser = await getCurrentDbUser();
  if (!dbUser) return NextResponse.json({ error: "Vui lòng đăng nhập để dùng Watchlist." }, { status: 401 });
  return NextResponse.json(await loadWatchlist(dbUser.id));
}

export async function POST(request: NextRequest) {
  const dbUser = await getCurrentDbUser();
  if (!dbUser) return NextResponse.json({ error: "Vui lòng đăng nhập để dùng Watchlist." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const ticker = normalizeTicker(body?.ticker);
  if (!ticker) return NextResponse.json({ error: "Mã cổ phiếu không hợp lệ." }, { status: 400 });

  const source = typeof body?.source === "string" ? body.source.slice(0, 24) : "manual";
  const sourceSignalId = typeof body?.sourceSignalId === "string" ? body.sourceSignalId.slice(0, 80) : null;
  const note = typeof body?.note === "string" && body.note.trim() ? body.note.trim().slice(0, 240) : null;

  await prisma.userWatchlistItem.upsert({
    where: { userId_ticker: { userId: dbUser.id, ticker } },
    create: { userId: dbUser.id, ticker, source, sourceSignalId, note },
    update: { source, sourceSignalId, note, updatedAt: new Date() },
  });

  return NextResponse.json(await loadWatchlist(dbUser.id));
}

export async function DELETE(request: NextRequest) {
  const dbUser = await getCurrentDbUser();
  if (!dbUser) return NextResponse.json({ error: "Vui lòng đăng nhập để dùng Watchlist." }, { status: 401 });

  const ticker = normalizeTicker(request.nextUrl.searchParams.get("ticker"));
  if (!ticker) return NextResponse.json({ error: "Mã cổ phiếu không hợp lệ." }, { status: 400 });

  await prisma.userWatchlistItem.deleteMany({ where: { userId: dbUser.id, ticker } });
  return NextResponse.json(await loadWatchlist(dbUser.id));
}

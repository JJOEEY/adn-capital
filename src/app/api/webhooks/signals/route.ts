/**
 * POST /api/webhooks/signals
 * Webhook nhận tín hiệu từ Python Scanner → lưu vào DB Prisma.
 * Logic: Nếu tín hiệu cùng ticker+type đã tồn tại trong ngày → UPDATE giá mới nhất.
 *        Nếu chưa có → CREATE mới.
 *        entryPrice LUÔN được cập nhật bằng giá mới nhất từ Python.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Secret chia sẻ giữa Python scanner và Next.js
const WEBHOOK_SECRET = process.env.SCANNER_SECRET ?? "adn-scanner-secret-key";

interface IncomingSignal {
  ticker: string;
  type: "SIEU_CO_PHIEU" | "TRUNG_HAN" | "DAU_CO";
  entryPrice: number;
  reason?: string;
}

export async function POST(req: NextRequest) {
  try {
    // ── 1. Xác thực secret ───────────────────────────────────────────────
    const body = await req.json();
    const { signals, secret } = body as {
      signals: IncomingSignal[];
      secret: string;
    };

    if (secret !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!Array.isArray(signals) || signals.length === 0) {
      return NextResponse.json({ saved: 0, updated: 0, message: "Không có tín hiệu" });
    }

    // Validate signals
    const validSignals = signals.filter((s) => {
      if (!s.ticker || !s.type || !s.entryPrice) return false;
      if (!["SIEU_CO_PHIEU", "TRUNG_HAN", "DAU_CO"].includes(s.type)) return false;
      return true;
    });

    if (validSignals.length === 0) {
      return NextResponse.json({ saved: 0, updated: 0, message: "Không có tín hiệu hợp lệ" });
    }

    // ── 2. Lấy tín hiệu hôm nay để xác định create vs update ───────────
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todaySignals = await prisma.signal.findMany({
      where: { createdAt: { gte: startOfDay } },
      select: { id: true, ticker: true, type: true },
    });

    // Map key="TICKER|TYPE" → id để biết nên update hay create
    const existingMap = new Map<string, string>();
    for (const s of todaySignals) {
      existingMap.set(`${s.ticker}|${s.type}`, s.id);
    }

    // ── 3. Upsert: update entryPrice nếu đã có, create nếu chưa ────────
    let created = 0;
    let updated = 0;

    const operations = validSignals.map((s) => {
      const key = `${s.ticker.toUpperCase().trim()}|${s.type}`;
      const existingId = existingMap.get(key);

      if (existingId) {
        // ĐÃ CÓ trong ngày → UPDATE giá + reason mới nhất
        updated++;
        return prisma.signal.update({
          where: { id: existingId },
          data: {
            entryPrice: s.entryPrice,
            reason: s.reason ?? null,
          },
        });
      } else {
        // CHƯA CÓ → CREATE mới
        created++;
        return prisma.signal.create({
          data: {
            ticker: s.ticker.toUpperCase().trim(),
            type: s.type,
            entryPrice: s.entryPrice,
            reason: s.reason ?? null,
          },
        });
      }
    });

    await prisma.$transaction(operations);

    console.log(
      `[Webhook] ${created} tín hiệu mới, ${updated} cập nhật giá, tổng ${validSignals.length} xử lý`
    );

    return NextResponse.json({
      saved: created,
      updated,
      tickers: validSignals.map((s) => s.ticker),
      message: `${created} mới, ${updated} cập nhật giá`,
    });
  } catch (error) {
    console.error("[Webhook /api/webhooks/signals] Lỗi:", error);
    return NextResponse.json({ error: "Lỗi xử lý webhook" }, { status: 500 });
  }
}

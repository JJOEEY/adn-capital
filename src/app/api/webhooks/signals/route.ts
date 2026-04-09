/**
 * POST /api/webhooks/signals
 * Webhook nhận tín hiệu từ Python Scanner → chạy qua UltimateSignalEngine → lưu DB.
 * Logic: Nếu tín hiệu cùng ticker+type đã tồn tại trong ngày → UPDATE giá mới nhất.
 *        Nếu chưa có → CREATE mới với đầy đủ tier, NAV, target/stoploss, AI reasoning.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processSignals } from "@/lib/UltimateSignalEngine";

// Secret chia sẻ giữa Python scanner và Next.js
const WEBHOOK_SECRET = process.env.SCANNER_SECRET ?? "adn-scanner-secret-key";

interface IncomingSignal {
  ticker: string;
  type: "SIEU_CO_PHIEU" | "TRUNG_HAN" | "DAU_CO" | "TAM_NGAM";
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
      if (!["SIEU_CO_PHIEU", "TRUNG_HAN", "DAU_CO", "TAM_NGAM"].includes(s.type)) return false;
      return true;
    });

    if (validSignals.length === 0) {
      return NextResponse.json({ saved: 0, updated: 0, message: "Không có tín hiệu hợp lệ" });
    }

    // ── 2. Chạy qua UltimateSignalEngine (VSA → Seasonality → AI Broker) ──
    const processed = await processSignals(validSignals);

    // ── 3. Lấy tín hiệu hôm nay để xác định create vs update ───────────
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todaySignals = await prisma.signal.findMany({
      where: { createdAt: { gte: startOfDay } },
      select: { id: true, ticker: true, type: true },
    });

    const existingMap = new Map<string, string>();
    for (const s of todaySignals) {
      existingMap.set(`${s.ticker}|${s.type}`, s.id);
    }

    // ── 4. Upsert: update nếu đã có, create nếu chưa ───────────────────
    let created = 0;
    let updated = 0;

    const operations = processed.map((s) => {
      const key = `${s.ticker.toUpperCase().trim()}|${s.type}`;
      const existingId = existingMap.get(key);

      if (existingId) {
        updated++;
        return prisma.signal.update({
          where: { id: existingId },
          data: {
            entryPrice: s.entryPrice,
            tier: s.tier,
            navAllocation: s.navAllocation,
            target: s.target,
            stoploss: s.stoploss,
            triggerSignal: s.triggerSignal,
            aiReasoning: s.aiReasoning,
            reason: s.reason ?? null,
            winRate: s.winRate,
            sharpeRatio: s.sharpeRatio,
          },
        });
      } else {
        created++;
        return prisma.signal.create({
          data: {
            ticker: s.ticker.toUpperCase().trim(),
            type: s.type,
            status: s.status,
            tier: s.tier,
            entryPrice: s.entryPrice,
            target: s.target,
            stoploss: s.stoploss,
            navAllocation: s.navAllocation,
            triggerSignal: s.triggerSignal,
            aiReasoning: s.aiReasoning,
            reason: s.reason ?? null,
            winRate: s.winRate,
            sharpeRatio: s.sharpeRatio,
          },
        });
      }
    });

    await prisma.$transaction(operations);

    console.log(
      `[Webhook] ${created} tín hiệu mới, ${updated} cập nhật giá, tổng ${processed.length} xử lý (UltimateEngine)`
    );

    return NextResponse.json({
      saved: created,
      updated,
      tickers: processed.map((s) => s.ticker),
      message: `${created} mới, ${updated} cập nhật (UltimateEngine)`,
    });
  } catch (error) {
    console.error("[Webhook /api/webhooks/signals] Lỗi:", error);
    return NextResponse.json({ error: "Lỗi xử lý webhook" }, { status: 500 });
  }
}

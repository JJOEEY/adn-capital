import { NextRequest, NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { checkT25Eligibility, formatEarliestSellDate } from "@/lib/t25";

const VALID_PSYCHOLOGY_TAGS = [
  "Có kế hoạch",
  "Tự tin",
  "FOMO",
  "Theo room",
  "Cảm tính",
  "Hoảng loạn",
];

export async function GET(req: NextRequest) {
  const dbUser = await getCurrentDbUser();
  if (!dbUser) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);
  const skip = (page - 1) * limit;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const ticker = searchParams.get("ticker");

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { userId: dbUser.id };

    // Date range filter (dùng tradeDate nếu có, fallback createdAt)
    if (from || to) {
      where.OR = [
        {
          tradeDate: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to + "T23:59:59.999Z") } : {}),
          },
        },
        {
          tradeDate: null,
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to + "T23:59:59.999Z") } : {}),
          },
        },
      ];
    }

    if (ticker) {
      where.ticker = ticker.toUpperCase().trim();
    }

    const [entries, total] = await prisma.$transaction([
      prisma.tradingJournal.findMany({
        where,
        orderBy: [{ tradeDate: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      }),
      prisma.tradingJournal.count({ where }),
    ]);

    return NextResponse.json({ entries, total, page, limit });
  } catch (error) {
    console.error("[GET /api/journal] Error:", error);
    return NextResponse.json({ error: "Lỗi tải nhật ký" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const dbUser = await getCurrentDbUser();
  if (!dbUser) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { ticker, action, price, quantity, psychology, psychologyTag, tradeReason, tradeDate } = body;

    if (!ticker || !action || !price || !quantity) {
      return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
    }

    if (!["BUY", "SELL"].includes(action)) {
      return NextResponse.json({ error: "Loại lệnh không hợp lệ" }, { status: 400 });
    }

    // Validate psychologyTag
    const tag = psychologyTag || psychology;
    if (!tag || !VALID_PSYCHOLOGY_TAGS.includes(tag)) {
      return NextResponse.json({
        error: "Vui lòng chọn tâm lý giao dịch hợp lệ",
      }, { status: 400 });
    }

    // Validate tradeReason for new entries
    if (!tradeReason || tradeReason.trim().length < 5) {
      return NextResponse.json({
        error: "Vui lòng nhập lý do giao dịch chi tiết (tối thiểu 5 ký tự)",
      }, { status: 400 });
    }

    const tickerNorm = ticker.toUpperCase().trim();
    const tradeDateParsed = tradeDate ? new Date(tradeDate) : new Date();

    // T+2.5 CHECK: Nếu BÁN, kiểm tra mã này đã mua đủ T+2.5 chưa
    if (action === "SELL") {
      // Tìm lệnh MUA gần nhất của mã này
      const lastBuy = await prisma.tradingJournal.findFirst({
        where: {
          userId: dbUser.id,
          ticker: tickerNorm,
          action: "BUY",
        },
        orderBy: [{ tradeDate: "desc" }, { createdAt: "desc" }],
      });

      if (lastBuy) {
        const buyDate = lastBuy.tradeDate ?? lastBuy.createdAt;
        const { eligible, earliestSellDate, tradingDaysLeft } =
          checkT25Eligibility(buyDate, tradeDateParsed);

        if (!eligible) {
          return NextResponse.json({
            error: `Cổ phiếu ${tickerNorm} chưa về tài khoản theo luật T+2.5. Không thể bán! Ngày bán sớm nhất: ${formatEarliestSellDate(earliestSellDate)} (còn ${tradingDaysLeft} ngày giao dịch).`,
            t25Block: true,
            earliestSellDate: earliestSellDate.toISOString(),
            tradingDaysLeft,
          }, { status: 400 });
        }
      }
    }

    const entry = await prisma.tradingJournal.create({
      data: {
        userId: dbUser.id,
        ticker: tickerNorm,
        action,
        price: parseFloat(price),
        quantity: parseInt(quantity),
        psychology: tag,
        psychologyTag: tag,
        tradeReason: tradeReason.trim(),
        tradeDate: tradeDateParsed,
      },
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/journal] Error:", error);
    return NextResponse.json({ error: "Lỗi lưu nhật ký" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const dbUser = await getCurrentDbUser();
  if (!dbUser) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Thiếu ID" }, { status: 400 });

  try {
    const entry = await prisma.tradingJournal.findUnique({ where: { id } });
    if (!entry || entry.userId !== dbUser.id) {
      return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    }

    await prisma.tradingJournal.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/journal] Error:", error);
    return NextResponse.json({ error: "Lỗi xóa nhật ký" }, { status: 500 });
  }
}

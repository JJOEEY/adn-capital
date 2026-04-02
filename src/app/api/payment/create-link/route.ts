import { NextRequest, NextResponse } from "next/server";
import { payos, taoMaDonHangPayOS } from "@/lib/payos";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, description } = body;

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { error: "amount phải là số nguyên dương" },
        { status: 400 },
      );
    }

    if (!description || typeof description !== "string") {
      return NextResponse.json(
        { error: "description là bắt buộc" },
        { status: 400 },
      );
    }

    const orderCode = taoMaDonHangPayOS();
    const origin = request.nextUrl.origin;

    const result = await payos.createPaymentLink({
      orderCode,
      amount,
      description,
      returnUrl: `${origin}/`,
      cancelUrl: `${origin}/`,
    });

    return NextResponse.json({ checkoutUrl: result.checkoutUrl });
  } catch (error: unknown) {
    console.error("Lỗi tạo payment link:", error);
    return NextResponse.json(
      { error: "Không thể tạo link thanh toán" },
      { status: 500 },
    );
  }
}

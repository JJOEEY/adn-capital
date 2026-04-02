import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** POST /api/margin — Gửi form tư vấn ký quỹ margin */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      name?: string;
      email?: string;
      phone?: string;
      product?: string;
      tickers?: string;
      marginRatio?: string;
      loanAmount?: string;
    };

    const { name, email, phone, product, tickers, marginRatio, loanAmount } = body;
    const productValue = product?.trim() || "ky-quy";

    if (!name?.trim() || !phone?.trim() || !loanAmount?.trim()) {
      return NextResponse.json({ error: "Vui lòng điền đầy đủ thông tin bắt buộc." }, { status: 400 });
    }

    // Tỉ lệ ký quỹ bắt buộc khi sản phẩm là ký quỹ
    if (productValue === "ky-quy" && !marginRatio?.trim()) {
      return NextResponse.json({ error: "Vui lòng chọn tỉ lệ ký quỹ." }, { status: 400 });
    }

    const entry = await prisma.marginConsultation.create({
      data: {
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone.trim(),
        product: productValue,
        tickers: tickers?.trim() || null,
        marginRatio: productValue === "ky-quy" ? (marginRatio?.trim() || null) : null,
        loanAmount: loanAmount.trim(),
      },
    });

    return NextResponse.json({ success: true, id: entry.id });
  } catch (error) {
    console.error("[/api/margin] Lỗi:", error);
    return NextResponse.json({ error: "Lỗi hệ thống, vui lòng thử lại." }, { status: 500 });
  }
}

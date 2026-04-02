import { NextRequest, NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/current-user";
import {
  layPlan,
  payos,
  taoMaDonHangPayOS,
} from "@/lib/payos";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function taoReturnUrl(origin: string, orderCode: number) {
  return `${origin}/pricing?payment=success&orderCode=${orderCode}`;
}

function taoCancelUrl(origin: string, orderCode: number) {
  return `${origin}/pricing?payment=cancelled&orderCode=${orderCode}`;
}

export async function POST(request: NextRequest) {
  try {
    const dbUser = await getCurrentDbUser();

    if (!dbUser) {
      return NextResponse.json(
        { error: "Cần đăng nhập trước khi tạo thanh toán VIP" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const planId = body.planId as string;
    const useDnsePrice = body.useDnsePrice === true;

    const plan = layPlan(planId);
    if (!plan) {
      return NextResponse.json(
        { error: "Gói không hợp lệ" },
        { status: 400 },
      );
    }

    // Chỉ cho dùng giá DNSE nếu user đã xác minh DNSE
    const amount = useDnsePrice && dbUser.dnseVerified ? plan.dnsePrice : plan.price;

    const orderCode = taoMaDonHangPayOS();
    const origin = request.nextUrl.origin;

    await prisma.paymentOrder.create({
      data: {
        userId: dbUser.id,
        orderCode: String(orderCode),
        planId: plan.id,
        amount,
        description: plan.description,
        status: "CREATING",
      },
    });

    const ketQuaThanhToan = await payos.createPaymentLink({
      orderCode,
      amount,
      description: plan.description,
      returnUrl: taoReturnUrl(origin, orderCode),
      cancelUrl: taoCancelUrl(origin, orderCode),
      buyerEmail: dbUser.email,
      buyerName: dbUser.name ?? undefined,
      items: [
        {
          name: plan.name,
          quantity: 1,
          price: amount,
        },
      ],
    });

    await prisma.paymentOrder.update({
      where: { orderCode: String(orderCode) },
      data: {
        paymentLinkId: ketQuaThanhToan.paymentLinkId,
        checkoutUrl: ketQuaThanhToan.checkoutUrl,
        status: ketQuaThanhToan.status,
        expiresAt: ketQuaThanhToan.expiredAt
          ? new Date(ketQuaThanhToan.expiredAt * 1000)
          : null,
      },
    });

    return NextResponse.json({
      success: true,
      orderCode: String(orderCode),
      paymentLinkId: ketQuaThanhToan.paymentLinkId,
      checkoutUrl: ketQuaThanhToan.checkoutUrl,
      qrCode: ketQuaThanhToan.qrCode,
    });
  } catch (error) {
    console.error("[POST /api/payment/create] Lỗi tạo link thanh toán:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không tạo được link thanh toán PayOS",
      },
      { status: 500 },
    );
  }
}
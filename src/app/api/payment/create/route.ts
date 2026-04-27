import { NextRequest, NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/current-user";
import { layPlan, payos, taoMaDonHangPayOS } from "@/lib/payos";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DISCOUNT_BY_PLAN: Record<string, number> = {
  "3m": 20,
  "6m": 30,
  "12m": 40,
};

function taoReturnUrl(origin: string, orderCode: number) {
  return `${origin}/pricing?payment=success&orderCode=${orderCode}`;
}

function taoCancelUrl(origin: string, orderCode: number) {
  return `${origin}/pricing?payment=cancelled&orderCode=${orderCode}`;
}

function normalizeCustomerCode(input: unknown) {
  return String(input ?? "").trim().toUpperCase();
}

function isValidCustomerCode(code: string) {
  return /^[A-Z0-9_-]{3,32}$/.test(code);
}

function discountedAmount(amount: number, discountPercent: number) {
  return Math.max(0, Math.round((amount * (100 - discountPercent)) / 100));
}

async function resolveApprovedCustomerDiscount({
  userId,
  email,
  planId,
  customerCode,
}: {
  userId: string;
  email: string | null;
  planId: string;
  customerCode: string;
}) {
  if (!customerCode) return null;

  if (!isValidCustomerCode(customerCode)) {
    throw new Error("Mã khách hàng không hợp lệ.");
  }

  const approved = await prisma.customerDiscountRequest.findFirst({
    where: {
      userId,
      requestedPlanId: planId,
      customerCode,
      status: "APPROVED",
    },
    orderBy: { createdAt: "desc" },
  });

  if (approved) return approved;

  const pending = await prisma.customerDiscountRequest.findFirst({
    where: {
      userId,
      requestedPlanId: planId,
      customerCode,
      status: "PENDING",
    },
    orderBy: { createdAt: "desc" },
  });

  if (!pending) {
    await prisma.customerDiscountRequest.create({
      data: {
        userId,
        email,
        customerCode,
        requestedPlanId: planId,
        discountPercent: DISCOUNT_BY_PLAN[planId] ?? null,
        status: "PENDING",
      },
    });
  }

  return "PENDING" as const;
}

export async function POST(request: NextRequest) {
  try {
    const dbUser = await getCurrentDbUser();

    if (!dbUser) {
      return NextResponse.json(
        { error: "Cần đăng nhập trước khi tạo thanh toán VIP." },
        { status: 401 },
      );
    }

    const body = await request.json();
    const planId = String(body.planId ?? "");
    const useDnsePrice = body.useDnsePrice === true;
    const customerCode = normalizeCustomerCode(body.customerCode);

    const plan = layPlan(planId);
    if (!plan) {
      return NextResponse.json({ error: "Gói không hợp lệ." }, { status: 400 });
    }

    if (plan.disabledForCheckout) {
      return NextResponse.json(
        { error: "Gói này không còn mở thanh toán mới." },
        { status: 400 },
      );
    }

    let amount =
      useDnsePrice && dbUser.dnseVerified ? plan.dnsePrice : plan.price;
    let discountPercent: number | null = null;
    let discountStatus: string | null = null;

    if (customerCode) {
      const approvedDiscount = await resolveApprovedCustomerDiscount({
        userId: dbUser.id,
        email: dbUser.email,
        planId: plan.id,
        customerCode,
      });

      if (approvedDiscount === "PENDING") {
        return NextResponse.json(
          {
            error: "Mã đang chờ admin duyệt.",
            status: "PENDING",
            customerCode,
          },
          { status: 409 },
        );
      }

      if (approvedDiscount) {
        discountPercent =
          approvedDiscount.discountPercent ?? DISCOUNT_BY_PLAN[plan.id] ?? null;
        if (discountPercent) {
          amount = discountedAmount(plan.price, discountPercent);
          discountStatus = "APPROVED";
        }
      }
    }

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
        customerCode: customerCode || null,
        discountPercent,
        discountStatus,
      },
    });

    const paymentLink = await payos.createPaymentLink({
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
        paymentLinkId: paymentLink.paymentLinkId,
        checkoutUrl: paymentLink.checkoutUrl,
        status: paymentLink.status,
        expiresAt: paymentLink.expiredAt
          ? new Date(paymentLink.expiredAt * 1000)
          : null,
      },
    });

    return NextResponse.json({
      success: true,
      orderCode: String(orderCode),
      paymentLinkId: paymentLink.paymentLinkId,
      checkoutUrl: paymentLink.checkoutUrl,
      qrCode: paymentLink.qrCode,
      amount,
      discountPercent,
      discountStatus,
    });
  } catch (error) {
    console.error("[POST /api/payment/create] Lỗi tạo link thanh toán:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không tạo được link thanh toán PayOS.",
      },
      { status: 500 },
    );
  }
}

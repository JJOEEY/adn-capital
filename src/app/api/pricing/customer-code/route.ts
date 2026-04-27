import { NextRequest, NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/current-user";
import { layPlan } from "@/lib/payos";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DISCOUNT_BY_PLAN: Record<string, number> = {
  "3m": 20,
  "6m": 30,
  "12m": 40,
};

function normalizeCustomerCode(input: unknown) {
  return String(input ?? "").trim().toUpperCase();
}

function isValidCustomerCode(code: string) {
  return /^[A-Z0-9_-]{3,32}$/.test(code);
}

export async function POST(request: NextRequest) {
  const dbUser = await getCurrentDbUser();
  if (!dbUser) {
    return NextResponse.json(
      { error: "Cần đăng nhập để gửi mã khách hàng." },
      { status: 401 },
    );
  }

  const body = await request.json();
  const planId = String(body.planId ?? "");
  const customerCode = normalizeCustomerCode(body.customerCode);
  const plan = layPlan(planId);

  if (!plan || plan.disabledForCheckout || !DISCOUNT_BY_PLAN[planId]) {
    return NextResponse.json({ error: "Gói không hợp lệ." }, { status: 400 });
  }

  if (!isValidCustomerCode(customerCode)) {
    return NextResponse.json(
      { error: "Mã khách hàng phải gồm 3-32 ký tự A-Z, 0-9, _ hoặc -." },
      { status: 400 },
    );
  }

  const existing = await prisma.customerDiscountRequest.findFirst({
    where: {
      userId: dbUser.id,
      requestedPlanId: planId,
      customerCode,
      status: { in: ["PENDING", "APPROVED"] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    return NextResponse.json({
      success: true,
      status: existing.status,
      customerCode,
      discountPercent:
        existing.status === "APPROVED"
          ? existing.discountPercent ?? DISCOUNT_BY_PLAN[planId]
          : null,
      message:
        existing.status === "APPROVED"
          ? "Mã khách hàng đã được duyệt."
          : "Mã đang chờ admin duyệt.",
    });
  }

  const created = await prisma.customerDiscountRequest.create({
    data: {
      userId: dbUser.id,
      email: dbUser.email,
      customerCode,
      requestedPlanId: planId,
      discountPercent: DISCOUNT_BY_PLAN[planId],
      status: "PENDING",
    },
  });

  return NextResponse.json({
    success: true,
    status: created.status,
    customerCode,
    discountPercent: null,
    message: "Mã đang chờ admin duyệt.",
  });
}

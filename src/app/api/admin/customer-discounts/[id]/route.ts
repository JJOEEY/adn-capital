import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin-check";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const APPROVED_DISCOUNT_BY_PLAN: Record<string, number> = {
  "3m": 20,
  "6m": 30,
  "12m": 40,
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await auth();
  const { id } = await params;
  const body = await request.json();
  const status = String(body.status ?? "").toUpperCase();

  if (!["PENDING", "APPROVED", "REJECTED"].includes(status)) {
    return NextResponse.json(
      { error: "Trạng thái duyệt không hợp lệ." },
      { status: 400 },
    );
  }

  const current = await prisma.customerDiscountRequest.findUnique({
    where: { id },
  });

  if (!current) {
    return NextResponse.json(
      { error: "Không tìm thấy yêu cầu mã khách hàng." },
      { status: 404 },
    );
  }

  const updated = await prisma.customerDiscountRequest.update({
    where: { id },
    data: {
      status,
      note: typeof body.note === "string" ? body.note : current.note,
      discountPercent:
        status === "APPROVED"
          ? current.discountPercent ??
            APPROVED_DISCOUNT_BY_PLAN[current.requestedPlanId] ??
            null
          : current.discountPercent,
      reviewedByAdminId: session?.user?.id ?? null,
      reviewedAt: new Date(),
    },
  });

  return NextResponse.json({ request: updated });
}

import { addDays } from "date-fns";
import { NextRequest, NextResponse } from "next/server";
import {
  layPlan,
  payos,
  type DuLieuWebhookDaXacThuc,
  type DuLieuWebhookPayOS,
} from "@/lib/payos";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function laThanhToanThanhCong(
  payload: DuLieuWebhookPayOS,
  duLieuDaXacThuc: DuLieuWebhookDaXacThuc,
) {
  return (
    payload.success === true &&
    payload.code === "00" &&
    duLieuDaXacThuc.code === "00"
  );
}

export async function POST(request: NextRequest) {
  let payload: DuLieuWebhookPayOS;

  try {
    payload = (await request.json()) as DuLieuWebhookPayOS;
  } catch {
    return NextResponse.json(
      { error: "Webhook PayOS không phải JSON hợp lệ" },
      { status: 400 },
    );
  }

  try {
    const duLieuDaXacThuc = await payos.verifyPaymentWebhookData(payload);
    const orderCode = String(duLieuDaXacThuc.orderCode);

    const donHang = await prisma.paymentOrder.findUnique({
      where: { orderCode },
      include: { user: true },
    });

    if (!donHang) {
      console.warn(
        `[POST /api/payment/webhook] Không tìm thấy đơn hàng PayOS ${orderCode}`,
      );

      return NextResponse.json({
        received: true,
        ignored: true,
        reason: "Không tìm thấy đơn hàng trong DB",
      });
    }

    if (!laThanhToanThanhCong(payload, duLieuDaXacThuc)) {
      await prisma.paymentOrder.update({
        where: { id: donHang.id },
        data: {
          status: duLieuDaXacThuc.code || payload.code || "FAILED",
          paymentLinkId: donHang.paymentLinkId ?? duLieuDaXacThuc.paymentLinkId,
        },
      });

      return NextResponse.json({
        received: true,
        success: false,
        message: "Webhook đã xác thực nhưng giao dịch chưa thành công",
      });
    }

    if (donHang.status === "PAID") {
      return NextResponse.json({
        received: true,
        duplicated: true,
      });
    }

    const now = new Date();
    const plan = layPlan(donHang.planId ?? "1m");
    const soNgayVip = plan?.days ?? 30;
    const mocGiaHan =
      donHang.user.vipUntil && donHang.user.vipUntil > now
        ? donHang.user.vipUntil
        : now;
    const vipUntilMoi = addDays(mocGiaHan, soNgayVip);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: donHang.userId },
        data: {
          role: "VIP",
          vipUntil: vipUntilMoi,
        },
      }),
      prisma.paymentOrder.update({
        where: { id: donHang.id },
        data: {
          status: "PAID",
          paymentLinkId: donHang.paymentLinkId ?? duLieuDaXacThuc.paymentLinkId,
          paidAt: now,
        },
      }),
    ]);

    return NextResponse.json({
      received: true,
      success: true,
      userId: donHang.userId,
      vipUntil: vipUntilMoi.toISOString(),
    });
  } catch (error) {
    console.error("[POST /api/payment/webhook] Lỗi webhook PayOS:", error);

    return NextResponse.json(
      { error: "Webhook PayOS không hợp lệ hoặc sai chữ ký" },
      { status: 400 },
    );
  }
}
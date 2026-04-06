/**
 * API Push Subscribe — Đăng ký / hủy Web Push notification
 *
 * POST: Đăng ký subscription mới
 * DELETE: Hủy subscription
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { subscription, userId } = body;

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: "Thiếu thông tin subscription" }, { status: 400 });
    }

    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userId: userId || null,
      },
      create: {
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userId: userId || null,
      },
    });

    return NextResponse.json({ success: true, message: "Đã bật thông báo" });
  } catch (error) {
    console.error("[Push Subscribe]", error);
    return NextResponse.json({ error: "Lỗi đăng ký thông báo" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json({ error: "Thiếu endpoint" }, { status: 400 });
    }

    await prisma.pushSubscription.deleteMany({ where: { endpoint } });

    return NextResponse.json({ success: true, message: "Đã tắt thông báo" });
  } catch (error) {
    console.error("[Push Unsubscribe]", error);
    return NextResponse.json({ error: "Lỗi hủy thông báo" }, { status: 500 });
  }
}

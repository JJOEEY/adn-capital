/**
 * POST /api/push/test — gửi một thông báo thử về CHÍNH thiết bị của người dùng
 * đang đăng nhập (đã bật thông báo). Dùng để kiểm tra web-push hoạt động trước khi
 * chờ tín hiệu thật. Không gửi cho người khác.
 */
import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const dbUser = await getCurrentDbUser();
  if (!dbUser) {
    return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
  }

  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPublicKey || !vapidPrivateKey) {
    return NextResponse.json({ error: "Máy chủ chưa cấu hình VAPID." }, { status: 503 });
  }

  const subs = await prisma.pushSubscription.findMany({ where: { userId: dbUser.id } });
  if (subs.length === 0) {
    return NextResponse.json(
      { error: "Thiết bị này chưa bật thông báo. Vào Thông báo để bật trước.", subscriptions: 0 },
      { status: 400 },
    );
  }

  const webpush = await import("web-push");
  webpush.setVapidDetails("mailto:admin@adncapital.vn", vapidPublicKey, vapidPrivateKey);

  const payload = JSON.stringify({
    title: "🔔 Thử thông báo ADN",
    body: "Cảnh báo tín hiệu Mua/Bán sẽ hiện đúng như thế này.",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-192x192.png",
    tag: "adn-test",
    url: "/notifications?tab=updates",
  });

  let sent = 0;
  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        sent += 1;
      } catch (e) {
        const code = (e as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          await prisma.pushSubscription.deleteMany({ where: { endpoint: s.endpoint } });
        }
      }
    }),
  );

  return NextResponse.json({ success: true, sent, subscriptions: subs.length });
}

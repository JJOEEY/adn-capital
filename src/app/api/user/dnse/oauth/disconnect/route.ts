import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unlinkDnseConnectionForUser } from "@/lib/brokers/dnse/connection";
import { invalidateDnseBrokerTopicsForUser } from "@/lib/brokers/dnse/topics";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  await unlinkDnseConnectionForUser(userId);
  await invalidateDnseBrokerTopicsForUser(userId);
  return NextResponse.json({
    ok: true,
    message: "Đã ngắt kết nối DNSE cho tài khoản hiện tại.",
  });
}

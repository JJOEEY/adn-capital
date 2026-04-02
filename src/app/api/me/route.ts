import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/**
 * API trả về hồ sơ user hiện tại theo NextAuth + Prisma.
 * Dùng cho topbar, paywall client, usage bar...
 */
export async function GET() {
  const dbUser = await getCurrentDbUser();

  if (!dbUser) {
    return NextResponse.json({
      isAuthenticated: false,
      user: null,
    });
  }

  // Tính vipTier: PREMIUM nếu vipUntil > 90 ngày, VIP nếu ≤ 90 ngày
  let vipTier: "VIP" | "PREMIUM" | null = null;
  if (dbUser.role === "VIP" && dbUser.vipUntil) {
    const daysLeft = Math.ceil(
      (new Date(dbUser.vipUntil).getTime() - Date.now()) / 86400000
    );
    vipTier = daysLeft > 90 ? "PREMIUM" : "VIP";
  }

  return NextResponse.json({
    isAuthenticated: true,
    user: {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name ?? null,
      image: dbUser.image ?? null,
      role: dbUser.role,
      chatCount: dbUser.chatCount,
      vipUntil: dbUser.vipUntil?.toISOString() ?? null,
      vipTier,
      dnseId: dbUser.dnseId ?? null,
      dnseVerified: dbUser.dnseVerified ?? false,
      dnseAppliedAt: dbUser.dnseAppliedAt?.toISOString() ?? null,
      isAdmin: ADMIN_EMAILS.includes(dbUser.email?.toLowerCase() ?? ""),
    },
  });
}
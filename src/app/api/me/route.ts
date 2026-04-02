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
      dnseId: dbUser.dnseId ?? null,
      dnseVerified: dbUser.dnseVerified ?? false,
      dnseAppliedAt: dbUser.dnseAppliedAt?.toISOString() ?? null,
      isAdmin: ADMIN_EMAILS.includes(dbUser.email?.toLowerCase() ?? ""),
    },
  });
}
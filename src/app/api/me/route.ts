import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/current-user";
import { reconcileUserEntitlementState } from "@/lib/entitlements";
import { resolveChatQuota } from "@/lib/chat-quota";

export const dynamic = "force-dynamic";

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

  // systemRole: ADMIN | USER (từ DB)
  const systemRole = (dbUser as Record<string, unknown>).systemRole as string ?? "USER";
  const isAdmin = systemRole === "ADMIN";

  const entitlement = await reconcileUserEntitlementState(
    dbUser.id,
    dbUser.role,
    dbUser.vipUntil ?? null
  );
  const quota = await resolveChatQuota({ userId: dbUser.id });
  const vipTier = entitlement.vipTier;
  const effectiveRole = entitlement.badge === "FREE" ? "FREE" : "VIP";

  return NextResponse.json({
    isAuthenticated: true,
    user: {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name ?? null,
      image: dbUser.image ?? null,
      role: effectiveRole,
      systemRole,
      chatCount: quota.usage.used,
      usage: quota.usage,
      vipUntil: entitlement.vipUntil?.toISOString() ?? null,
      vipTier,
      dnseId: dbUser.dnseId ?? null,
      dnseVerified: dbUser.dnseVerified ?? false,
      dnseAppliedAt: dbUser.dnseAppliedAt?.toISOString() ?? null,
      initialJournalNAV: dbUser.initialJournalNAV ?? null,
      enableAIReview: dbUser.enableAIReview ?? true,
      isAdmin,
    },
  });
}

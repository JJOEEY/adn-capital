import { prisma } from "@/lib/prisma";

export type EntitlementBadge = "FREE" | "VIP" | "PREMIUM";

export interface EffectiveEntitlement {
  badge: EntitlementBadge;
  vipUntil: Date | null;
  vipTier: "VIP" | "PREMIUM" | null;
  source: "grant" | "legacy";
}

function normalizeBadge(value: string | null | undefined): EntitlementBadge {
  if (value === "PREMIUM") return "PREMIUM";
  if (value === "VIP") return "VIP";
  return "FREE";
}

function legacyEntitlement(role: string, vipUntil: Date | null): EffectiveEntitlement {
  if (!vipUntil || vipUntil.getTime() <= Date.now()) {
    return { badge: "FREE", vipUntil: null, vipTier: null, source: "legacy" };
  }
  const tier = role === "VIP" ? "VIP" : null;
  return {
    badge: tier ? "VIP" : "FREE",
    vipUntil: tier ? vipUntil : null,
    vipTier: tier,
    source: "legacy",
  };
}

export async function resolveEffectiveEntitlement(userId: string, role: string, vipUntil: Date | null): Promise<EffectiveEntitlement> {
  const now = new Date();

  const latestGrant = await prisma.adminEntitlementGrant.findFirst({
    where: {
      targetUserId: userId,
      status: "ACTIVE",
      expiresAt: { gt: now },
    },
    orderBy: [{ grantedAt: "desc" }, { createdAt: "desc" }],
    select: {
      badge: true,
      expiresAt: true,
    },
  });

  if (!latestGrant) {
    return legacyEntitlement(role, vipUntil);
  }

  const badge = normalizeBadge(latestGrant.badge);
  if (badge === "FREE") {
    return { badge: "FREE", vipUntil: null, vipTier: null, source: "grant" };
  }

  return {
    badge,
    vipUntil: latestGrant.expiresAt,
    vipTier: badge,
    source: "grant",
  };
}


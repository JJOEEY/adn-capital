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

function normalizeDate(value: Date | null): Date | null {
  if (!value) return null;
  return Number.isFinite(value.getTime()) ? value : null;
}

function legacyEntitlement(role: string, vipUntil: Date | null): EffectiveEntitlement {
  const safeUntil = normalizeDate(vipUntil);
  if (!safeUntil || safeUntil.getTime() <= Date.now()) {
    return { badge: "FREE", vipUntil: null, vipTier: null, source: "legacy" };
  }
  const tier = role === "VIP" ? "VIP" : null;
  return {
    badge: tier ? "VIP" : "FREE",
    vipUntil: tier ? safeUntil : null,
    vipTier: tier,
    source: "legacy",
  };
}

async function markExpiredGrants(userId: string, now: Date) {
  await prisma.adminEntitlementGrant.updateMany({
    where: {
      targetUserId: userId,
      status: "ACTIVE",
      expiresAt: { lte: now },
    },
    data: {
      status: "EXPIRED",
    },
  });
}

function isSameDate(a: Date | null, b: Date | null) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.getTime() === b.getTime();
}

export async function resolveEffectiveEntitlement(
  userId: string,
  role: string,
  vipUntil: Date | null
): Promise<EffectiveEntitlement> {
  const now = new Date();
  await markExpiredGrants(userId, now);

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

export async function reconcileUserEntitlementState(
  userId: string,
  role: string,
  vipUntil: Date | null
): Promise<EffectiveEntitlement> {
  const entitlement = await resolveEffectiveEntitlement(userId, role, vipUntil);
  const targetRole = entitlement.badge === "FREE" ? "FREE" : "VIP";
  const targetVipUntil = entitlement.vipUntil;

  if (role !== targetRole || !isSameDate(normalizeDate(vipUntil), targetVipUntil)) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        role: targetRole,
        vipUntil: targetVipUntil,
      },
    });
  }

  return entitlement;
}

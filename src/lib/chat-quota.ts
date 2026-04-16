import { prisma } from "@/lib/prisma";
import { reconcileUserEntitlementState } from "@/lib/entitlements";

type LimitSource = "guest" | "free" | "vip_plan" | "admin_override";
type QuotaMode = "daily" | "lifetime_package";

const GUEST_LIMIT = 3;
const FREE_LIMIT = 5;
const DAILY_VIP_LIMITS: Record<string, number> = {
  "1m": 20,
  "3m": 30,
};

function getDateKeyInVietnam(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function isUnlimitedPlan(planId: string | null) {
  if (!planId) return false;
  return !Object.prototype.hasOwnProperty.call(DAILY_VIP_LIMITS, planId);
}

export interface ChatUsageMeta {
  used: number;
  limit: number | null;
  remaining: number | null;
  isUnlimited: boolean;
  isLimitReached: boolean;
  mode: QuotaMode;
  limitSource: LimitSource;
}

interface ResolveInput {
  userId: string | null;
  guestUsage?: number;
}

interface ResolvedQuota {
  usage: ChatUsageMeta;
  userId: string | null;
  dailyDateKey?: string;
  overrideId?: string;
}

export async function resolveChatQuota(input: ResolveInput): Promise<ResolvedQuota> {
  if (!input.userId) {
    const used = Math.max(0, Number(input.guestUsage ?? 0));
    return {
      userId: null,
      usage: {
        used,
        limit: GUEST_LIMIT,
        remaining: Math.max(0, GUEST_LIMIT - used),
        isUnlimited: false,
        isLimitReached: used >= GUEST_LIMIT,
        mode: "daily",
        limitSource: "guest",
      },
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, role: true, vipUntil: true },
  });
  if (!user) {
    return resolveChatQuota({ userId: null, guestUsage: input.guestUsage });
  }

  const entitlement = await reconcileUserEntitlementState(user.id, user.role, user.vipUntil ?? null);
  const override = await prisma.adminChatQuotaOverride.findUnique({
    where: { targetUserId: user.id },
    select: { id: true, totalQuota: true, usedQuota: true, active: true },
  });

  if (override?.active) {
    const total = Math.max(0, override.totalQuota);
    const used = Math.max(0, override.usedQuota);
    const remaining = Math.max(0, total - used);
    return {
      userId: user.id,
      overrideId: override.id,
      usage: {
        used,
        limit: total,
        remaining,
        isUnlimited: false,
        isLimitReached: remaining <= 0,
        mode: "lifetime_package",
        limitSource: "admin_override",
      },
    };
  }

  if (entitlement.badge === "PREMIUM") {
    return {
      userId: user.id,
      usage: {
        used: 0,
        limit: null,
        remaining: null,
        isUnlimited: true,
        isLimitReached: false,
        mode: "daily",
        limitSource: "vip_plan",
      },
    };
  }

  const dateKey = getDateKeyInVietnam();
  const daily = await prisma.chatUsageDaily.findUnique({
    where: { userId_dateKey: { userId: user.id, dateKey } },
    select: { usedCount: true },
  });
  const used = daily?.usedCount ?? 0;

  let limit = FREE_LIMIT;
  let source: LimitSource = "free";

  if (entitlement.badge === "VIP") {
    const latestPaidOrder = await prisma.paymentOrder.findFirst({
      where: { userId: user.id, status: "PAID" },
      orderBy: { paidAt: "desc" },
      select: { planId: true },
    });
    if (isUnlimitedPlan(latestPaidOrder?.planId ?? null)) {
      return {
        userId: user.id,
        dailyDateKey: dateKey,
        usage: {
          used,
          limit: null,
          remaining: null,
          isUnlimited: true,
          isLimitReached: false,
          mode: "daily",
          limitSource: "vip_plan",
        },
      };
    }

    limit = DAILY_VIP_LIMITS[latestPaidOrder?.planId ?? "1m"] ?? 20;
    source = "vip_plan";
  }

  return {
    userId: user.id,
    dailyDateKey: dateKey,
    usage: {
      used,
      limit,
      remaining: Math.max(0, limit - used),
      isUnlimited: false,
      isLimitReached: used >= limit,
      mode: "daily",
      limitSource: source,
    },
  };
}

export async function consumeChatQuota(resolved: ResolvedQuota): Promise<ChatUsageMeta> {
  if (resolved.usage.isUnlimited) {
    return resolved.usage;
  }

  if (!resolved.userId) {
    const nextUsed = resolved.usage.used + 1;
    const limit = resolved.usage.limit ?? GUEST_LIMIT;
    return {
      ...resolved.usage,
      used: nextUsed,
      remaining: Math.max(0, limit - nextUsed),
      isLimitReached: nextUsed >= limit,
    };
  }

  if (resolved.usage.limitSource === "admin_override") {
    const updated = await prisma.adminChatQuotaOverride.update({
      where: { targetUserId: resolved.userId },
      data: { usedQuota: { increment: 1 } },
      select: { usedQuota: true, totalQuota: true },
    });
    const remaining = Math.max(0, updated.totalQuota - updated.usedQuota);
    return {
      ...resolved.usage,
      used: updated.usedQuota,
      limit: updated.totalQuota,
      remaining,
      isLimitReached: remaining <= 0,
    };
  }

  const dateKey = resolved.dailyDateKey ?? getDateKeyInVietnam();
  const updated = await prisma.chatUsageDaily.upsert({
    where: { userId_dateKey: { userId: resolved.userId, dateKey } },
    create: { userId: resolved.userId, dateKey, usedCount: 1 },
    update: { usedCount: { increment: 1 } },
    select: { usedCount: true },
  });

  const limit = resolved.usage.limit ?? null;
  if (limit === null) {
    return { ...resolved.usage, used: updated.usedCount };
  }

  return {
    ...resolved.usage,
    used: updated.usedCount,
    remaining: Math.max(0, limit - updated.usedCount),
    isLimitReached: updated.usedCount >= limit,
  };
}

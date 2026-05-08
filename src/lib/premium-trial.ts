import { prisma } from "@/lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;

export const PREMIUM_TRIAL_DAYS = 7;
export const PREMIUM_TRIAL_POLICY_START = new Date("2026-05-07T17:00:00.000Z");
export const AUTO_PREMIUM_TRIAL_NOTE = "AUTO_PREMIUM_TRIAL_2026_05_08";

type TrialDb = Pick<typeof prisma, "user" | "adminEntitlementGrant">;

type TrialUser = {
  id: string;
  createdAt: Date;
  role?: string | null;
  vipUntil?: Date | null;
};

export type PremiumTrialResult = {
  granted: boolean;
  reason: string;
  expiresAt?: Date;
};

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

function countReason(reasons: Record<string, number>, reason: string) {
  reasons[reason] = (reasons[reason] ?? 0) + 1;
}

async function resolveGrantingUserId(db: TrialDb, targetUserId: string) {
  const admin = await db.user.findFirst({
    where: { systemRole: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return admin?.id ?? targetUserId;
}

export async function grantPremiumTrialForUser(
  db: TrialDb,
  user: TrialUser,
  now = new Date(),
): Promise<PremiumTrialResult> {
  if (user.createdAt < PREMIUM_TRIAL_POLICY_START) {
    return { granted: false, reason: "before_policy_start" };
  }

  const expiresAt = addDays(user.createdAt, PREMIUM_TRIAL_DAYS);
  if (expiresAt <= now) {
    return { granted: false, reason: "trial_window_expired" };
  }

  const existingAutoTrial = await db.adminEntitlementGrant.findFirst({
    where: {
      targetUserId: user.id,
      note: AUTO_PREMIUM_TRIAL_NOTE,
    },
    select: { id: true },
  });
  if (existingAutoTrial) {
    return { granted: false, reason: "auto_trial_exists" };
  }

  const activeGrant = await db.adminEntitlementGrant.findFirst({
    where: {
      targetUserId: user.id,
      status: "ACTIVE",
      expiresAt: { gt: now },
    },
    select: { id: true },
  });
  if (activeGrant) {
    return { granted: false, reason: "active_entitlement_exists" };
  }

  if (user.role === "VIP" && user.vipUntil && user.vipUntil > now) {
    return { granted: false, reason: "legacy_vip_active" };
  }

  const grantedByAdminId = await resolveGrantingUserId(db, user.id);

  await db.adminEntitlementGrant.create({
    data: {
      targetUserId: user.id,
      badge: "PREMIUM",
      durationDays: PREMIUM_TRIAL_DAYS,
      grantedByAdminId,
      expiresAt,
      status: "ACTIVE",
      note: AUTO_PREMIUM_TRIAL_NOTE,
    },
  });

  await db.user.update({
    where: { id: user.id },
    data: {
      role: "VIP",
      vipUntil: expiresAt,
      trialVipActivatedAt: user.createdAt,
    },
  });

  return { granted: true, reason: "granted", expiresAt };
}

export async function grantPremiumTrialForNewUser(userId: string) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        createdAt: true,
        role: true,
        vipUntil: true,
      },
    });
    if (!user) {
      return { granted: false, reason: "user_not_found" } satisfies PremiumTrialResult;
    }
    return grantPremiumTrialForUser(tx, user);
  });
}

export async function backfillPremiumTrialGrants(limit = 200) {
  const now = new Date();
  const windowStart = new Date(
    Math.max(PREMIUM_TRIAL_POLICY_START.getTime(), now.getTime() - PREMIUM_TRIAL_DAYS * DAY_MS),
  );
  const users = await prisma.user.findMany({
    where: {
      createdAt: { gte: windowStart },
      systemRole: { not: "ADMIN" },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      role: true,
      vipUntil: true,
    },
  });

  const reasons: Record<string, number> = {};
  let granted = 0;

  for (const user of users) {
    const result = await prisma.$transaction((tx) => grantPremiumTrialForUser(tx, user, now));
    if (result.granted) {
      granted += 1;
    } else {
      countReason(reasons, result.reason);
    }
  }

  return {
    scanned: users.length,
    granted,
    skipped: users.length - granted,
    reasons,
    limit,
    trialDays: PREMIUM_TRIAL_DAYS,
    policyStart: PREMIUM_TRIAL_POLICY_START.toISOString(),
  };
}

import type { Prisma, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const PREMIUM_TRIAL_DAYS = 7;

type TrialUser = Pick<User, "id" | "role" | "vipUntil" | "trialVipActivatedAt">;
type PrismaExecutor = typeof prisma | Prisma.TransactionClient;

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

async function grantPremiumTrial(db: PrismaExecutor, user: TrialUser) {
  if (user.trialVipActivatedAt) return;

  const now = new Date();
  const expiresAt = addDays(now, PREMIUM_TRIAL_DAYS);

  const existingActiveGrant = await db.adminEntitlementGrant.findFirst({
    where: {
      targetUserId: user.id,
      badge: "PREMIUM",
      status: "ACTIVE",
      expiresAt: { gt: now },
    },
    select: { id: true, expiresAt: true },
  });

  const finalExpiresAt = existingActiveGrant?.expiresAt ?? expiresAt;

  if (!existingActiveGrant) {
    await db.adminEntitlementGrant.create({
      data: {
        targetUserId: user.id,
        grantedByAdminId: user.id,
        badge: "PREMIUM",
        durationDays: PREMIUM_TRIAL_DAYS,
        expiresAt: finalExpiresAt,
        note: "Auto trial for new signup",
      },
    });
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      role: "VIP",
      vipUntil: finalExpiresAt,
      trialVipActivatedAt: now,
    },
  });
}

export async function grantPremiumTrialForUser(db: Prisma.TransactionClient, user: TrialUser) {
  await grantPremiumTrial(db, user);
}

export async function grantPremiumTrialForNewUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      vipUntil: true,
      trialVipActivatedAt: true,
    },
  });

  if (!user) return;
  await grantPremiumTrial(prisma, user);
}

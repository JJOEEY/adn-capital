import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Badge = "FREE" | "VIP" | "PREMIUM";

function toBadge(input: unknown): Badge {
  if (input === "VIP" || input === "PREMIUM") return input;
  return "FREE";
}

function toDurationDays(input: unknown): number {
  const value = Number(input);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, systemRole: true },
  });
  if (!admin || admin.systemRole !== "ADMIN") return null;
  return admin;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const grants = await prisma.adminEntitlementGrant.findMany({
    where: { targetUserId: id },
    orderBy: [{ grantedAt: "desc" }, { createdAt: "desc" }],
    take: 30,
    select: {
      id: true,
      badge: true,
      durationDays: true,
      grantedAt: true,
      expiresAt: true,
      status: true,
      note: true,
      grantedByAdmin: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return NextResponse.json({ grants });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const badge = toBadge(body.badge);
  const durationDays = toDurationDays(body.durationDays);
  const note = typeof body.note === "string" ? body.note.trim() : null;

  if ((badge === "VIP" || badge === "PREMIUM") && durationDays <= 0) {
    return NextResponse.json(
      { error: "durationDays must be > 0 for VIP/PREMIUM" },
      { status: 400 }
    );
  }

  const now = new Date();
  const expiresAt =
    badge === "FREE"
      ? now
      : new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
  const nextStatus = badge === "FREE" ? "REVOKED" : "ACTIVE";

  const result = await prisma.$transaction(async (tx) => {
    await tx.adminEntitlementGrant.updateMany({
      where: {
        targetUserId: id,
        status: "ACTIVE",
      },
      data: {
        status: "REVOKED",
      },
    });

    const created = await tx.adminEntitlementGrant.create({
      data: {
        targetUserId: id,
        badge,
        durationDays: badge === "FREE" ? 0 : durationDays,
        grantedByAdminId: admin.id,
        grantedAt: now,
        expiresAt,
        status: nextStatus,
        note: note || null,
      },
      select: {
        id: true,
        badge: true,
        durationDays: true,
        grantedAt: true,
        expiresAt: true,
        status: true,
      },
    });

    await tx.user.update({
      where: { id },
      data:
        badge === "FREE"
          ? {
              role: "FREE",
              vipUntil: null,
            }
          : {
              role: "VIP",
              vipUntil: expiresAt,
            },
    });

    return created;
  });

  return NextResponse.json({ grant: result });
}


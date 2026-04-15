import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAiBrokerRuntimeConfig, rebalanceActiveBasketNav } from "@/lib/aiBroker";

async function requireAdminUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, systemRole: true },
  });
  if (!admin || admin.systemRole !== "ADMIN") return null;
  return admin;
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    ticker?: string;
    navAllocation?: number;
    note?: string;
  };

  const ticker = String(body.ticker ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{2,10}$/.test(ticker)) {
    return NextResponse.json({ error: "Ticker không hợp lệ" }, { status: 400 });
  }

  const target = await prisma.signal.findFirst({
    where: { ticker, status: { in: ["RADAR", "ACTIVE"] } },
    orderBy: [{ updatedAt: "desc" }],
  });

  if (!target) {
    return NextResponse.json(
      { error: "Không tìm thấy mã trong giỏ tầm ngắm (RADAR/ACTIVE)" },
      { status: 404 }
    );
  }

  const parsedNav = Number(body.navAllocation);
  const requestedNav = Number.isFinite(parsedNav) ? Math.max(0, Math.min(90, parsedNav)) : target.navAllocation || 0;

  const updated = await prisma.signal.update({
    where: { id: target.id },
    data: {
      status: "ACTIVE",
      navAllocation: requestedNav,
      aiReasoning: target.aiReasoning ?? "Admin override vào giỏ ACTIVE.",
    },
  });

  const config = await getAiBrokerRuntimeConfig();
  await rebalanceActiveBasketNav(config.maxTotalNav);

  await prisma.changelog.create({
    data: {
      component: "AI_BROKER_ADMIN",
      action: "FORCE_ACTIVATE_SIGNAL",
      description: `Admin ${admin.email} chuyển ${ticker} vào ACTIVE`,
      diff: JSON.stringify({
        signalId: updated.id,
        ticker,
        navAllocation: requestedNav,
        note: body.note ?? null,
        by: { id: admin.id, email: admin.email, name: admin.name },
      }),
      author: admin.email ?? admin.id,
    },
  });

  return NextResponse.json({
    ok: true,
    signal: {
      id: updated.id,
      ticker: updated.ticker,
      status: updated.status,
      navAllocation: updated.navAllocation,
      updatedAt: updated.updatedAt,
    },
  });
}


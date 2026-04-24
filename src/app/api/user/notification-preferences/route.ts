import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DEFAULT_PREFERENCES = {
  stock_watchlist: true,
  signal_scan: true,
  ai_weekly_review: true,
} as const;

type PreferenceKey = keyof typeof DEFAULT_PREFERENCES;

const VALID_KEYS = new Set<PreferenceKey>(Object.keys(DEFAULT_PREFERENCES) as PreferenceKey[]);

function isPreferenceKey(key: string): key is PreferenceKey {
  return VALID_KEYS.has(key as PreferenceKey);
}

function normalizePayload(body: unknown): Partial<Record<PreferenceKey, boolean>> {
  if (!body || typeof body !== "object") return {};

  const raw = body as {
    key?: unknown;
    enabled?: unknown;
    preferences?: unknown;
  };

  if (typeof raw.key === "string" && typeof raw.enabled === "boolean" && isPreferenceKey(raw.key)) {
    return { [raw.key]: raw.enabled };
  }

  if (!raw.preferences || typeof raw.preferences !== "object") return {};

  const updates: Partial<Record<PreferenceKey, boolean>> = {};
  for (const [key, value] of Object.entries(raw.preferences as Record<string, unknown>)) {
    if (isPreferenceKey(key) && typeof value === "boolean") {
      updates[key] = value;
    }
  }
  return updates;
}

async function readPreferences(userId: string) {
  const [user, stored] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { enableAIReview: true },
    }),
    prisma.notificationPreference.findMany({
      where: { userId },
      select: { key: true, enabled: true },
    }),
  ]);

  const preferences: Record<PreferenceKey, boolean> = {
    ...DEFAULT_PREFERENCES,
    ai_weekly_review: user?.enableAIReview ?? DEFAULT_PREFERENCES.ai_weekly_review,
  };

  for (const row of stored) {
    if (isPreferenceKey(row.key)) {
      preferences[row.key] = row.enabled;
    }
  }

  return preferences;
}

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Ch\u01b0a \u0111\u0103ng nh\u1eadp" }, { status: 401 });
  }

  const preferences = await readPreferences(userId);
  return NextResponse.json({ preferences });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Ch\u01b0a \u0111\u0103ng nh\u1eadp" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const updates = normalizePayload(body);
  const entries = Object.entries(updates) as Array<[PreferenceKey, boolean]>;

  if (entries.length === 0) {
    return NextResponse.json(
      { error: "Kh\u00f4ng c\u00f3 t\u00f9y ch\u1ecdn h\u1ee3p l\u1ec7 \u0111\u1ec3 c\u1eadp nh\u1eadt" },
      { status: 400 },
    );
  }

  await prisma.$transaction(async (tx) => {
    for (const [key, enabled] of entries) {
      await tx.notificationPreference.upsert({
        where: { userId_key: { userId, key } },
        create: { userId, key, enabled },
        update: { enabled },
      });

      if (key === "ai_weekly_review") {
        await tx.user.update({
          where: { id: userId },
          data: { enableAIReview: enabled },
        });
      }
    }
  });

  const preferences = await readPreferences(userId);
  return NextResponse.json({ preferences });
}

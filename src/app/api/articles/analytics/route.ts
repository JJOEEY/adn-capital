import { createHash, randomUUID } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SESSION_COOKIE = "adn_article_sid";
const VALID_DEPTHS = new Set([0, 25, 50, 75, 100]);

function hashSession(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function isBot(userAgent: string) {
  return /bot|crawl|spider|slurp|preview|facebookexternalhit|telegrambot/i.test(userAgent);
}

function normalizeDevice(userAgent: string) {
  if (/ipad|tablet/i.test(userAgent)) return "tablet";
  if (/mobile|iphone|android/i.test(userAgent)) return "mobile";
  return "desktop";
}

function normalizeReferrerHost(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    return new URL(value).hostname.replace(/^www\./, "").slice(0, 80);
  } catch {
    return null;
  }
}

function classifySource(host: string | null) {
  if (!host) return "Direct";
  const lower = host.toLowerCase();
  if (lower.includes("google.")) return "Google";
  if (lower.includes("facebook.") || lower.includes("fb.")) return "Facebook";
  if (lower.includes("zalo.")) return "Zalo";
  if (lower.includes("telegram.") || lower.includes("t.me")) return "Telegram";
  if (lower.includes("linkedin.")) return "LinkedIn";
  if (lower.includes("twitter.") || lower.includes("x.com")) return "X";
  return "Other";
}

export async function POST(request: NextRequest) {
  const userAgent = request.headers.get("user-agent") ?? "";
  if (isBot(userAgent)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    const body = (await request.json()) as {
      articleId?: unknown;
      slug?: unknown;
      eventType?: unknown;
      readDepth?: unknown;
      readTimeSec?: unknown;
      referrer?: unknown;
      path?: unknown;
    };

    const eventType = body.eventType === "READ_DEPTH" ? "READ_DEPTH" : "ARTICLE_VIEW";
    const readDepth = eventType === "READ_DEPTH" ? Number(body.readDepth) : 0;
    if (!VALID_DEPTHS.has(readDepth)) {
      return NextResponse.json({ error: "invalid_read_depth" }, { status: 400 });
    }

    const articleId = typeof body.articleId === "string" ? body.articleId : null;
    const slug = typeof body.slug === "string" ? body.slug : null;
    if (!articleId && !slug) {
      return NextResponse.json({ error: "missing_article" }, { status: 400 });
    }

    const article = await prisma.article.findFirst({
      where: {
        status: "PUBLISHED",
        ...(articleId ? { id: articleId } : { slug: slug ?? "" }),
      },
      select: { id: true },
    });
    if (!article) {
      return NextResponse.json({ error: "article_not_found" }, { status: 404 });
    }

    const existingSession = request.cookies.get(SESSION_COOKIE)?.value;
    const sessionId = existingSession || randomUUID();
    const referrerHost = normalizeReferrerHost(body.referrer) ?? normalizeReferrerHost(request.headers.get("referer"));
    const readTimeSec =
      typeof body.readTimeSec === "number" && Number.isFinite(body.readTimeSec)
        ? Math.max(0, Math.min(86_400, Math.round(body.readTimeSec)))
        : null;

    await prisma.articleAnalyticsEvent.create({
      data: {
        articleId: article.id,
        sessionIdHash: hashSession(sessionId),
        eventType,
        readDepth,
        readTimeSec,
        referrerHost,
        source: classifySource(referrerHost),
        deviceType: normalizeDevice(userAgent),
        path: typeof body.path === "string" ? body.path.slice(0, 240) : null,
      },
    });

    const response = NextResponse.json({ ok: true });
    if (!existingSession) {
      response.cookies.set(SESSION_COOKIE, sessionId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
      });
    }
    return response;
  } catch (error) {
    console.error("[POST /api/articles/analytics] error:", error);
    return NextResponse.json({ error: "analytics_write_failed" }, { status: 500 });
  }
}

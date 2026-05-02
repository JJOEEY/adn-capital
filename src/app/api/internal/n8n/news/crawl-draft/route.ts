import { NextRequest, NextResponse } from "next/server";
import { invalidateTopics } from "@/lib/datahub/core";
import {
  getPublicBaseUrl,
  isN8nAuthorized,
  readJsonBody,
  sendAdminTelegram,
  unauthorizedResponse,
  writeN8nLog,
} from "@/lib/n8n/internal";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function getAdminUserId() {
  const admin = await prisma.user.findFirst({
    where: { systemRole: "ADMIN" },
    select: { id: true },
  });
  return admin?.id ?? null;
}

async function runCrawlerViaInternalApi(baseUrl: string) {
  const secret = (process.env.INTERNAL_API_KEY ?? process.env.CRON_SECRET ?? "").trim();
  if (!secret) {
    throw new Error("INTERNAL_API_KEY/CRON_SECRET missing");
  }

  const response = await fetch(`${baseUrl}/api/crawler/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-key": secret,
    },
    body: JSON.stringify({ approvalMode: "pending" }),
    cache: "no-store",
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(`crawler_http_${response.status}`);
  }
  return payload as {
    success?: boolean;
    message?: string;
    scanned?: number;
    processed?: number;
    results?: Array<{ id: string; title: string; status: string; reason?: string }>;
  };
}

export async function POST(req: NextRequest) {
  if (!isN8nAuthorized(req)) return unauthorizedResponse();

  const startedAt = Date.now();
  const parsed = await readJsonBody<{ dryRun?: unknown; sendTelegram?: unknown }>(req);
  if (!parsed.ok) return parsed.response;
  const dryRun = parsed.data.dryRun === true;
  const shouldSendTelegram = parsed.data.sendTelegram !== false;
  const baseUrl = getPublicBaseUrl();
  const approvalUrl = `${baseUrl}/khac/tin-tuc/admin`;

  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: { code: "NO_ADMIN_USER", message: "No admin user found" } }, { status: 500 });
  }

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      message: "Chế độ thử: chưa chạy crawler.",
      payload: {
        type: "news_crawl_draft",
        title: "Tin tức SEO chờ duyệt",
        summary: "Chế độ thử: crawler chưa chạy.",
        sourceUrl: approvalUrl,
        approvalUrl,
        createdAt: new Date().toISOString(),
      },
    });
  }

  const internalBaseUrl = (
    process.env.WORKFLOW_INTERNAL_BASE_URL ??
    process.env.NEXTAUTH_URL ??
    "http://127.0.0.1:3000"
  ).replace(/\/$/, "");
  const result = await runCrawlerViaInternalApi(internalBaseUrl);
  const resultRows = Array.isArray(result.results) ? result.results : [];
  const createdIds = resultRows
    .filter((row) => row.status === "PENDING_APPROVAL" && row.id)
    .map((row) => row.id);
  const articles = createdIds.length > 0
    ? await prisma.article.findMany({
        where: { id: { in: createdIds } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          excerpt: true,
          aiSummary: true,
          sourceUrl: true,
          imageUrl: true,
          createdAt: true,
        },
      })
    : [];

  invalidateTopics({ tags: ["news", "public"] });

  const title = "Tin tức SEO chờ duyệt";
  const summary = articles.length > 0
    ? `${articles.length} bài mới đã được tạo ở trạng thái chờ duyệt.`
    : result.message ?? "Không có bài mới cần duyệt.";
  const text = [
    title,
    summary,
    "",
    ...articles.slice(0, 5).map((article, index) => [
      `${index + 1}. ${article.title}`,
      article.aiSummary || article.excerpt ? `   ${article.aiSummary ?? article.excerpt}` : "",
      article.sourceUrl ? `   Link gốc: ${article.sourceUrl}` : "",
    ].filter(Boolean).join("\n")),
    "",
    `Duyệt bài: ${approvalUrl}`,
  ].filter(Boolean).join("\n");

  const telegram = shouldSendTelegram
    ? await sendAdminTelegram(text, {
        dedupeKey: `telegram:n8n:news-crawl:${createdIds.join(",") || "empty"}`,
      })
    : { ok: true, skipped: true, reason: "send_not_requested" };

  await writeN8nLog("n8n:news-crawl-draft", "success", summary, {
    created: articles.length,
    scanned: result.scanned ?? null,
    processed: result.processed ?? null,
  }, startedAt);

  return NextResponse.json({
    ok: true,
    result,
    articles,
    telegram,
    payload: {
      type: "news_crawl_draft",
      title,
      summary,
      sourceUrl: articles[0]?.sourceUrl ?? approvalUrl,
      approvalUrl,
      createdAt: new Date().toISOString(),
    },
  });
}

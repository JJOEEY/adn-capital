import { NextRequest, NextResponse } from "next/server";
import { invalidateTopics } from "@/lib/datahub/core";
import {
  badRequestResponse,
  getPublicBaseUrl,
  isN8nAuthorized,
  readJsonBody,
  readString,
  sendAdminTelegram,
  unauthorizedResponse,
  writeN8nLog,
} from "@/lib/n8n/internal";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isN8nAuthorized(req)) return unauthorizedResponse();

  const startedAt = Date.now();
  const parsed = await readJsonBody<{ articleId?: unknown; sendTelegram?: unknown }>(req);
  if (!parsed.ok) return parsed.response;

  const articleId = readString(parsed.data.articleId);
  if (!articleId) return badRequestResponse("articleId is required");

  const existing = await prisma.article.findUnique({
    where: { id: articleId },
    select: { id: true, title: true, slug: true, status: true, sourceUrl: true },
  });
  if (!existing) {
    return NextResponse.json({ error: { code: "ARTICLE_NOT_FOUND", message: "Article not found" } }, { status: 404 });
  }
  if (!["DRAFT", "PENDING_APPROVAL"].includes(existing.status)) {
    return NextResponse.json(
      { error: { code: "ARTICLE_NOT_APPROVABLE", message: "Article is not in approvable status" } },
      { status: 409 },
    );
  }

  const article = await prisma.article.update({
    where: { id: articleId },
    data: {
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
    select: { id: true, title: true, slug: true, status: true, sourceUrl: true, publishedAt: true },
  });

  invalidateTopics({ tags: ["news", "public"] });

  const baseUrl = getPublicBaseUrl();
  const articleUrl = `${baseUrl}/khac/tin-tuc/${article.slug}`;
  const title = "Bài viết đã xuất bản";
  const summary = article.title;
  const telegram = parsed.data.sendTelegram === false
    ? { ok: true, skipped: true, reason: "send_not_requested" }
    : await sendAdminTelegram(
        [title, summary, articleUrl].join("\n"),
        { dedupeKey: `telegram:n8n:news-publish:${article.id}` },
      );

  await writeN8nLog("n8n:news-publish-approved", "success", summary, {
    articleId: article.id,
    articleUrl,
  }, startedAt);

  return NextResponse.json({
    ok: true,
    article,
    telegram,
    payload: {
      type: "news_publish_approved",
      title,
      summary,
      sourceUrl: article.sourceUrl ?? articleUrl,
      approvalUrl: articleUrl,
      createdAt: new Date().toISOString(),
    },
  });
}

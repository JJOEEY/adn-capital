import { NextRequest, NextResponse } from "next/server";
import { invalidateTopics } from "@/lib/datahub/core";
import {
  badRequestResponse,
  getPublicBaseUrl,
  isN8nAuthorized,
  readJsonBody,
  readString,
  unauthorizedResponse,
} from "@/lib/n8n/internal";
import { prisma } from "@/lib/prisma";
import {
  buildExcerptFromHtml,
  createArticleSlug,
  normalizeArticleTags,
  sanitizeArticleHtml,
} from "@/lib/articles/server";

export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set(["DRAFT", "PENDING_APPROVAL", "PUBLISHED"]);

type OpenClawArticleBody = {
  title?: unknown;
  content?: unknown;
  excerpt?: unknown;
  aiSummary?: unknown;
  sourceUrl?: unknown;
  imageUrl?: unknown;
  pdfUrl?: unknown;
  originalTitle?: unknown;
  tags?: unknown;
  hashtags?: unknown;
  sentiment?: unknown;
  categoryId?: unknown;
  categorySlug?: unknown;
  status?: unknown;
  authorId?: unknown;
  dryRun?: unknown;
};

async function findArticleAuthor(authorId?: string, allowCreate = false) {
  if (authorId) {
    const author = await prisma.user.findUnique({
      where: { id: authorId },
      select: { id: true, email: true, systemRole: true },
    });
    if (author) return author;
  }

  const configuredAuthorId = (process.env.OPENCLAW_ARTICLE_AUTHOR_ID ?? "").trim();
  if (configuredAuthorId) {
    const author = await prisma.user.findUnique({
      where: { id: configuredAuthorId },
      select: { id: true, email: true, systemRole: true },
    });
    if (author) return author;
  }

  const configuredEmail = (process.env.OPENCLAW_ARTICLE_AUTHOR_EMAIL ?? "").trim();
  if (configuredEmail) {
    const author = await prisma.user.findUnique({
      where: { email: configuredEmail },
      select: { id: true, email: true, systemRole: true },
    });
    if (author) return author;
  }

  const editor = await prisma.user.findFirst({
    where: { systemRole: { in: ["ADMIN", "WRITER"] } },
    orderBy: [{ systemRole: "asc" }, { createdAt: "asc" }],
    select: { id: true, email: true, systemRole: true },
  });
  if (editor) return editor;

  const serviceEmail = configuredEmail || "openclaw@adncapital.local";
  if (!allowCreate) {
    return { id: "dry-run-openclaw-author", email: serviceEmail, systemRole: "WRITER" };
  }

  return prisma.user.upsert({
    where: { email: serviceEmail },
    update: {
      name: "OpenClaw CEO Agent",
      systemRole: "WRITER",
    },
    create: {
      email: serviceEmail,
      name: "OpenClaw CEO Agent",
      systemRole: "WRITER",
      role: "FREE",
    },
    select: { id: true, email: true, systemRole: true },
  });
}

async function resolveCategoryId(categoryId: string, categorySlug: string) {
  if (categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    return category?.id ?? null;
  }

  if (categorySlug) {
    const category = await prisma.category.findUnique({
      where: { slug: categorySlug },
      select: { id: true },
    });
    return category?.id ?? null;
  }

  return null;
}

function normalizeStatus(status: string) {
  const value = status.trim().toUpperCase();
  if (value === "PUBLISH") return "PUBLISHED";
  if (!value) return "PUBLISHED";
  return VALID_STATUSES.has(value) ? value : "";
}

export async function POST(req: NextRequest) {
  if (!isN8nAuthorized(req)) return unauthorizedResponse();

  const parsed = await readJsonBody<OpenClawArticleBody>(req);
  if (!parsed.ok) return parsed.response;

  const title = readString(parsed.data.title);
  const rawContent = readString(parsed.data.content);
  if (!title || !rawContent) {
    return badRequestResponse("title and content are required");
  }

  const status = normalizeStatus(readString(parsed.data.status, "PUBLISHED"));
  if (!status) {
    return badRequestResponse("status must be DRAFT, PENDING_APPROVAL, or PUBLISHED");
  }

  const safeContent = sanitizeArticleHtml(rawContent);
  const categoryId = await resolveCategoryId(
    readString(parsed.data.categoryId),
    readString(parsed.data.categorySlug),
  );
  const isDryRun = parsed.data.dryRun === true;
  const author = await findArticleAuthor(readString(parsed.data.authorId), !isDryRun);
  if (!author) {
    return NextResponse.json(
      { error: { code: "NO_ARTICLE_AUTHOR", message: "No ADMIN/WRITER user found for article author" } },
      { status: 500 },
    );
  }

  const payload = {
    title: title.trim(),
    originalTitle: readString(parsed.data.originalTitle) || null,
    slug: createArticleSlug(title),
    content: safeContent,
    excerpt: readString(parsed.data.excerpt) || buildExcerptFromHtml(safeContent),
    aiSummary: readString(parsed.data.aiSummary) || null,
    sourceUrl: readString(parsed.data.sourceUrl) || null,
    imageUrl: readString(parsed.data.imageUrl) || null,
    pdfUrl: readString(parsed.data.pdfUrl) || null,
    tags: JSON.stringify(normalizeArticleTags(parsed.data.tags ?? parsed.data.hashtags)),
    sentiment: readString(parsed.data.sentiment) || null,
    categoryId,
    authorId: author.id,
    status,
    publishedAt: status === "PUBLISHED" ? new Date() : null,
  };

  if (isDryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      article: {
        ...payload,
        authorId: author.id,
        authorEmail: author.email,
        contentLength: payload.content.length,
        content: undefined,
      },
    });
  }

  const article = await prisma.article.create({
    data: payload,
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      excerpt: true,
      publishedAt: true,
      createdAt: true,
    },
  });

  invalidateTopics({ tags: ["news", "articles", "public", "dashboard"] });

  const baseUrl = getPublicBaseUrl();
  return NextResponse.json(
    {
      ok: true,
      article,
      link: `${baseUrl}/tin-tuc/${article.slug}`,
    },
    { status: 201 },
  );
}

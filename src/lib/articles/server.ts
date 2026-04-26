import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type ArticleEditorUser = {
  id: string;
  systemRole: string | null;
};

export async function getArticleEditorUser(options: { adminOnly?: boolean } = {}) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, systemRole: true },
  });

  if (!user) return null;
  if (options.adminOnly) return user.systemRole === "ADMIN" ? user : null;
  return user.systemRole === "ADMIN" || user.systemRole === "WRITER" ? user : null;
}

export function normalizeArticleTags(input: unknown): string[] {
  const raw = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(/[,;\n]/g)
      : [];

  const seen = new Set<string>();
  const tags: string[] = [];

  for (const value of raw) {
    const tag = String(value)
      .replace(/^#+/, "")
      .trim()
      .replace(/\s+/g, " ");

    if (!tag) continue;
    const key = tag.toLocaleLowerCase("vi-VN");
    if (seen.has(key)) continue;

    seen.add(key);
    tags.push(tag.slice(0, 60));
    if (tags.length >= 12) break;
  }

  return tags;
}

export function createArticleSlug(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);

  return `${base || "bai-viet"}-${Date.now().toString(36)}`;
}

export function sanitizeArticleHtml(html: string): string {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(href|src)\s*=\s*("|')\s*javascript:[\s\S]*?\2/gi, "")
    .replace(/\ssrc\s*=\s*("|')\s*data:[\s\S]*?\1/gi, "");
}

export function stripHtmlToText(html: string): string {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function countArticleWords(html: string): number {
  const text = stripHtmlToText(html);
  if (!text) return 0;
  return text.split(/\s+/g).filter(Boolean).length;
}

export function buildExcerptFromHtml(html: string, maxLength = 280): string {
  return stripHtmlToText(html).slice(0, maxLength).trim();
}

export function hasArticleImage(imageUrl: unknown): boolean {
  return typeof imageUrl === "string" && /^https?:\/\/|^\/api\/articles\/image\//i.test(imageUrl.trim());
}

const FINANCE_KEYWORDS = [
  "chung khoan",
  "chứng khoán",
  "co phieu",
  "cổ phiếu",
  "vn-index",
  "vnindex",
  "hose",
  "hnx",
  "upcom",
  "thi truong",
  "thị trường",
  "tai chinh",
  "tài chính",
  "ngan hang",
  "ngân hàng",
  "lai suat",
  "lãi suất",
  "ty gia",
  "tỷ giá",
  "trai phieu",
  "trái phiếu",
  "doanh nghiep",
  "doanh nghiệp",
  "bat dong san",
  "bất động sản",
  "kinh te",
  "kinh tế",
  "vĩ mô",
  "vi mo",
];

export function isFinanceArticle(text: string): boolean {
  const normalized = String(text || "").toLocaleLowerCase("vi-VN");
  return FINANCE_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export function ensureSeoTags(tags: string[], sourceName?: string): string[] {
  const base = normalizeArticleTags(tags);
  const additions = ["chứng khoán", "tài chính", "ADN Capital"];
  if (sourceName) additions.push(sourceName);
  return normalizeArticleTags([...base, ...additions]);
}

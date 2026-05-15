import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type ArticleEditorUser = {
  id: string;
  systemRole: string | null;
};

const MOJIBAKE_PATTERN =
  /\u00c3[\u0080-\u00bf]|\u00c4[\u0080-\u00bf\u2018]|\u00c6[\u00a0-\u00bf]|\u00e1[\u00ba\u00bb]|\u00e2[\u0080-\u00bf\u20ac\u2020\u201d]|\u00c2[\u00a0-\u00bf]|[\u0080-\u009f\ufffd]/;
const MOJIBAKE_PATTERN_GLOBAL =
  /\u00c3[\u0080-\u00bf]|\u00c4[\u0080-\u00bf\u2018]|\u00c6[\u00a0-\u00bf]|\u00e1[\u00ba\u00bb]|\u00e2[\u0080-\u00bf\u20ac\u2020\u201d]|\u00c2[\u00a0-\u00bf]|[\u0080-\u009f\ufffd]/g;
const NON_ASCII_SEGMENT_PATTERN = /[\u0080-\u024f\u1e00-\u1eff\u2010-\u203a\u20ac\ufffd]+/g;
const WINDOWS_1252_REVERSE: Record<number, number> = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
};

function mojibakeScore(value: string): number {
  return (value.match(MOJIBAKE_PATTERN_GLOBAL) ?? []).length;
}

function decodeLatin1SegmentAsUtf8(value: string): string {
  const bytes = Uint8Array.from(
    Array.from(value, (char) => WINDOWS_1252_REVERSE[char.charCodeAt(0)] ?? (char.charCodeAt(0) & 0xff)),
  );
  return Buffer.from(bytes).toString("utf8");
}

export function repairMojibakeText(value: string): string {
  return String(value || "").replace(NON_ASCII_SEGMENT_PATTERN, (segment) => {
    if (!MOJIBAKE_PATTERN.test(segment)) return segment;

    const repaired = decodeLatin1SegmentAsUtf8(segment);
    return mojibakeScore(repaired) < mojibakeScore(segment) ? repaired : segment;
  });
}

export function hasBrokenArticleEncoding(value: string): boolean {
  const repaired = repairMojibakeText(value);
  return MOJIBAKE_PATTERN.test(repaired);
}

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
    const tag = repairMojibakeText(String(value))
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
  const base = repairMojibakeText(title)
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function splitReadableParagraphs(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const sentences = normalized.match(/[^.!?。！？]+[.!?。！？]+(?:["')\]]+)?|[^.!?。！？]+$/g) ?? [normalized];
  const paragraphs: string[] = [];
  let buffer: string[] = [];

  for (const sentence of sentences.map((item) => item.trim()).filter(Boolean)) {
    buffer.push(sentence);
    const currentLength = buffer.join(" ").length;
    if (buffer.length >= 3 || currentLength >= 360) {
      paragraphs.push(buffer.join(" "));
      buffer = [];
    }
  }

  if (buffer.length > 0) paragraphs.push(buffer.join(" "));
  return paragraphs;
}

export function ensureReadableArticleHtml(html: string): string {
  const sanitized = sanitizeArticleHtml(html);
  const blockCount = (sanitized.match(/<(p|h2|h3|ul|ol|blockquote)\b/gi) ?? []).length;
  const hasHeading = /<h[23]\b/i.test(sanitized);

  if (blockCount >= 3 && hasHeading) return sanitized;
  if (blockCount >= 4 && sanitized.length < 3500) return sanitized;

  const text = stripHtmlToText(sanitized);
  const paragraphs = splitReadableParagraphs(text);
  if (paragraphs.length <= 1) return sanitized;

  return paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
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

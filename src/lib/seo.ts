export const SITE_NAME = "ADN Capital";
export const FALLBACK_SITE_URL = "https://adncapital.com.vn";
export const DEFAULT_OG_IMAGE = "/brand/logo-light.jpg";

export const DEFAULT_DESCRIPTION =
  "ADN Capital là hệ thống AI hỗ trợ nhà đầu tư chứng khoán Việt Nam với tín hiệu giao dịch, RS Rating, bản đồ thị trường, backtest và quản trị rủi ro.";

export const DEFAULT_KEYWORDS = [
  "ADN Capital",
  "chứng khoán Việt Nam",
  "phân tích chứng khoán",
  "AI chứng khoán",
  "tín hiệu giao dịch",
  "RS Rating",
  "VNINDEX",
  "quản trị rủi ro",
];

export function getSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    FALLBACK_SITE_URL;

  try {
    return new URL(raw).origin;
  } catch {
    return FALLBACK_SITE_URL;
  }
}

export const SITE_URL = getSiteUrl();

export function absoluteUrl(path: string | null | undefined): string {
  if (!path) return SITE_URL;

  try {
    return new URL(path, SITE_URL).toString();
  } catch {
    return SITE_URL;
  }
}

export function stripHtml(input: string | null | undefined): string {
  if (!input) return "";

  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncateMeta(input: string, maxLength = 160): string {
  const text = input.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;

  const clipped = text.slice(0, maxLength - 3).replace(/\s+\S*$/, "").trim();
  return `${clipped || text.slice(0, maxLength - 3)}...`;
}

export function articleDescription(article: {
  excerpt?: string | null;
  aiSummary?: string | null;
  content?: string | null;
}): string {
  const source =
    article.excerpt ||
    article.aiSummary ||
    stripHtml(article.content) ||
    DEFAULT_DESCRIPTION;

  return truncateMeta(source, 160);
}

export function parseJsonTags(tags: string | null | undefined): string[] {
  if (!tags) return [];

  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === "string")
      : [];
  } catch {
    return [];
  }
}

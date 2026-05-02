export type ArticleImageFallbackInput = {
  title?: string | null;
  excerpt?: string | null;
  aiSummary?: string | null;
  tags?: string[] | null;
  sourceUrl?: string | null;
  sourceName?: string | null;
  categorySlug?: string | null;
  category?: { name?: string | null; slug?: string | null } | null;
};

const FALLBACK_IMAGES = {
  market: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&h=675&q=82",
  macro: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=1200&h=675&q=82",
  banking: "https://images.unsplash.com/photo-1565373677928-90e963765eac?auto=format&fit=crop&w=1200&h=675&q=82",
  property: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&h=675&q=82",
  aviation: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1200&h=675&q=82",
  energy: "https://images.unsplash.com/photo-1518709414768-a88981a4515d?auto=format&fit=crop&w=1200&h=675&q=82",
  tech: "https://images.unsplash.com/photo-1518186285589-2f7649de83e0?auto=format&fit=crop&w=1200&h=675&q=82",
  default: "https://images.unsplash.com/photo-1642790106117-e829e14a795f?auto=format&fit=crop&w=1200&h=675&q=82",
} as const;

function normalizeForMatch(value: string) {
  return value
    .toLocaleLowerCase("vi-VN")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getArticleFallbackImage(article: ArticleImageFallbackInput) {
  const haystack = normalizeForMatch([
    article.title,
    article.excerpt,
    article.aiSummary,
    article.sourceName,
    article.sourceUrl,
    article.categorySlug,
    article.category?.slug,
    article.category?.name,
    ...(article.tags ?? []),
  ].filter(Boolean).join(" "));

  if (/(bat dong san|dia oc|nha dat|chung cu|bds)/.test(haystack)) return FALLBACK_IMAGES.property;
  if (/(hang khong|vietjet|vna|san bay|van tai)/.test(haystack)) return FALLBACK_IMAGES.aviation;
  if (/(dau khi|xang dau|dien|nang luong|pvn|pvd|gas)/.test(haystack)) return FALLBACK_IMAGES.energy;
  if (/(ngan hang|lai suat|tin dung|ty gia|trai phieu)/.test(haystack)) return FALLBACK_IMAGES.banking;
  if (/(cong nghe|ai|chuyen doi so|du lieu|phan mem|fpt)/.test(haystack)) return FALLBACK_IMAGES.tech;
  if (/(vnindex|vn index|chung khoan|co phieu|hose|hnx|upcom|thi truong|dau tu)/.test(haystack)) return FALLBACK_IMAGES.market;
  if (/(kinh te|vi mo|gdp|xuat khau|nhap khau|thuong mai|lam phat)/.test(haystack)) return FALLBACK_IMAGES.macro;

  return FALLBACK_IMAGES.default;
}

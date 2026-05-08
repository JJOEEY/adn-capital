export const NEWS_PRIMARY_CATEGORIES = [
  { name: "Tin tức thị trường", slug: "tin-tuc-thi-truong", sortOrder: 1 },
  { name: "Phân tích cổ phiếu", slug: "phan-tich-co-phieu", sortOrder: 2 },
  { name: "ADN REPORT", slug: "adn-report", sortOrder: 3 },
] as const;

const PRIMARY_ORDER = new Map<string, number>(
  NEWS_PRIMARY_CATEGORIES.map((category, index) => [category.slug, index]),
);

export function sortNewsCategories<
  T extends { slug: string; sortOrder?: number | null; name: string },
>(categories: T[]): T[] {
  return [...categories].sort((a, b) => {
    const aPrimary = PRIMARY_ORDER.get(a.slug);
    const bPrimary = PRIMARY_ORDER.get(b.slug);

    if (aPrimary !== undefined || bPrimary !== undefined) {
      return (aPrimary ?? 999) - (bPrimary ?? 999);
    }

    const sortDiff = (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
    if (sortDiff !== 0) return sortDiff;
    return a.name.localeCompare(b.name, "vi");
  });
}

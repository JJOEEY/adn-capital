type NewsCategory = {
  id?: string;
  name: string;
  slug: string;
  sortOrder?: number | null;
};

export const NEWS_PRIMARY_CATEGORIES = [
  { name: "Tin tức thị trường", slug: "tin-tuc-thi-truong", sortOrder: 10, isActive: true },
  { name: "Phân tích cổ phiếu", slug: "phan-tich-co-phieu", sortOrder: 20, isActive: true },
  { name: "ADN REPORT", slug: "adn-report", sortOrder: 30, isActive: true },
] as const;

const PRIMARY_ORDER = new Map<string, number>(
  NEWS_PRIMARY_CATEGORIES.flatMap((category, index) => [
    [category.slug, index],
    [normalizeCategoryName(category.name), index],
  ]),
);

function normalizeCategoryName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

function getPriority(category: Pick<NewsCategory, "name" | "slug" | "sortOrder">) {
  const slugPriority = PRIMARY_ORDER.get(category.slug);
  if (slugPriority != null) return slugPriority;
  const namePriority = PRIMARY_ORDER.get(normalizeCategoryName(category.name));
  if (namePriority != null) return namePriority;
  return Number.MAX_SAFE_INTEGER;
}

export function sortNewsCategories<T extends Pick<NewsCategory, "name" | "slug"> & { sortOrder?: number | null }>(
  categories: T[],
): T[] {
  return [...categories].sort((a, b) => {
    const priorityDiff = getPriority(a) - getPriority(b);
    if (priorityDiff !== 0) return priorityDiff;

    const sortDiff = (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
    if (sortDiff !== 0) return sortDiff;

    return a.name.localeCompare(b.name, "vi");
  });
}

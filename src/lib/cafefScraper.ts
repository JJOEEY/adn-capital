/**
 * CafeF Scraper — Lấy tin tức thị trường từ CafeF (cafef.vn)
 *
 * CafeF không có RSS public → scrape HTML trực tiếp.
 * Dùng cho Morning Brief & EOD Brief để inject tin tức thực.
 */

const CAFEF_BASE = "https://cafef.vn";
const TIMEOUT = 15_000;

// ═══════════════════════════════════════════════
//  Interfaces
// ═══════════════════════════════════════════════

export interface CafefArticle {
  title: string;
  url: string;
  summary: string;
  publishedAt: string; // ISO string or relative time
  imageUrl?: string;
}

export interface CafefMarketData {
  articles: CafefArticle[];
  fetchedAt: string;
}

// ═══════════════════════════════════════════════
//  HTML Parser Helpers (no external dependencies)
// ═══════════════════════════════════════════════

function extractArticles(html: string): CafefArticle[] {
  const articles: CafefArticle[] = [];

  // Pattern: <h3><a href="..." title="...">TITLE</a></h3> + summary text
  const linkPattern = /<a\s+[^>]*href="([^"]*\.chn)"[^>]*title="([^"]*)"[^>]*>/gi;
  const timePattern = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/g;

  let match;
  const seen = new Set<string>();

  while ((match = linkPattern.exec(html)) !== null) {
    const [, href, title] = match;
    if (!title || title.length < 20 || seen.has(title)) continue;
    seen.add(title);

    const url = href.startsWith("http") ? href : `${CAFEF_BASE}${href}`;

    // Tìm summary: text sau thẻ link, trước thẻ tiếp theo
    const afterLink = html.substring(match.index + match[0].length, match.index + match[0].length + 500);
    const summaryMatch = afterLink.match(/>([^<]{30,300})</);
    const summary = summaryMatch ? summaryMatch[1].trim() : "";

    // Tìm thời gian publish gần nhất
    const timeSlice = html.substring(match.index, match.index + 1000);
    const timeMatch = timeSlice.match(timePattern);
    const publishedAt = timeMatch ? timeMatch[0] : new Date().toISOString();

    articles.push({ title, url, summary, publishedAt });

    if (articles.length >= 15) break;
  }

  return articles;
}

// ═══════════════════════════════════════════════
//  Fetch Functions
// ═══════════════════════════════════════════════

async function fetchCafefPage(path: string): Promise<string | null> {
  try {
    const res = await fetch(`${CAFEF_BASE}${path}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(TIMEOUT),
    });

    if (!res.ok) {
      console.error(`[CafeF] ${path} → ${res.status}`);
      return null;
    }

    return await res.text();
  } catch (err) {
    console.error(`[CafeF] ${path} error:`, err);
    return null;
  }
}

/** Tin thị trường chứng khoán */
export async function fetchStockMarketNews(): Promise<CafefMarketData> {
  const html = await fetchCafefPage("/thi-truong-chung-khoan.chn");
  return {
    articles: html ? extractArticles(html) : [],
    fetchedAt: new Date().toISOString(),
  };
}

/** Tin kinh tế vĩ mô */
export async function fetchMacroNews(): Promise<CafefMarketData> {
  const html = await fetchCafefPage("/kinh-te-vi-mo.chn");
  return {
    articles: html ? extractArticles(html) : [],
    fetchedAt: new Date().toISOString(),
  };
}

/** Tin tài chính quốc tế */
export async function fetchGlobalNews(): Promise<CafefMarketData> {
  const html = await fetchCafefPage("/tai-chinh-quoc-te.chn");
  return {
    articles: html ? extractArticles(html) : [],
    fetchedAt: new Date().toISOString(),
  };
}

/** Tin vàng & ngoại tệ */
export async function fetchGoldForexNews(): Promise<CafefMarketData> {
  const html = await fetchCafefPage("/thi-truong-vang.chn");
  return {
    articles: html ? extractArticles(html) : [],
    fetchedAt: new Date().toISOString(),
  };
}

/** Tổng hợp tất cả nguồn tin cho Morning/EOD Brief */
export async function fetchAllCafefNews(): Promise<{
  stockMarket: CafefMarketData;
  macro: CafefMarketData;
  global: CafefMarketData;
  goldForex: CafefMarketData;
}> {
  const [stockMarket, macro, global, goldForex] = await Promise.all([
    fetchStockMarketNews(),
    fetchMacroNews(),
    fetchGlobalNews(),
    fetchGoldForexNews(),
  ]);
  return { stockMarket, macro, global, goldForex };
}

/**
 * Tạo context string từ tin CafeF cho Gemini prompt.
 * Giới hạn ~2000 ký tự để không quá dài.
 */
export function buildCafefContext(news: Awaited<ReturnType<typeof fetchAllCafefNews>>): string {
  const lines: string[] = [];

  lines.push("## TIN TỨC CAFEF (REAL-TIME)");
  lines.push("");

  if (news.stockMarket.articles.length > 0) {
    lines.push("### Thị trường chứng khoán:");
    for (const a of news.stockMarket.articles.slice(0, 5)) {
      lines.push(`- ${a.title}`);
      if (a.summary) lines.push(`  → ${a.summary.substring(0, 100)}`);
    }
    lines.push("");
  }

  if (news.macro.articles.length > 0) {
    lines.push("### Kinh tế vĩ mô:");
    for (const a of news.macro.articles.slice(0, 3)) {
      lines.push(`- ${a.title}`);
    }
    lines.push("");
  }

  if (news.global.articles.length > 0) {
    lines.push("### Tài chính quốc tế:");
    for (const a of news.global.articles.slice(0, 3)) {
      lines.push(`- ${a.title}`);
    }
    lines.push("");
  }

  if (news.goldForex.articles.length > 0) {
    lines.push("### Vàng & Ngoại tệ:");
    for (const a of news.goldForex.articles.slice(0, 2)) {
      lines.push(`- ${a.title}`);
    }
  }

  return lines.join("\n").substring(0, 3000);
}

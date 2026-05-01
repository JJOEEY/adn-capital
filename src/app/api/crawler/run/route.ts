import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GoogleGenAI } from "@google/genai";
import {
  countArticleWords,
  ensureSeoTags,
  hasArticleImage,
  isFinanceArticle,
  sanitizeArticleHtml,
} from "@/lib/articles/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* ═══════════════════════════════════════════════════════════════
 *  POST /api/crawler/run
 *  Admin-only endpoint: Crawl tin tức từ CafeF / VnEconomy / RSS,
 *  gửi qua AI (Gemini) để rewrite, rồi lưu DB status PENDING_APPROVAL.
 * ═══════════════════════════════════════════════════════════════ */

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });

// ── Types ──
interface CrawledItem {
  originalTitle: string;
  excerpt: string;
  content: string;
  sourceUrl: string;
  sourceName: string;
  trustedSource: boolean;
  imageUrl: string | null;
  pdfUrl: string | null;
  categorySlug: string;
}

interface AIRewriteResult {
  title: string;
  aiSummary: string;
  content?: string;
  sentiment: "Tích cực" | "Tiêu cực" | "Trung tính";
  tags: string[];
}

type SaveArticleResult = {
  id: string;
  title: string;
  status: string;
  reason?: string;
};

// ── Slug generator ──
function generateSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 100) +
    "-" +
    Date.now().toString(36)
  );
}

// ── Step 1: VnExpress RSS Crawler ──
function extractImageFromHtml(html: string): string | null {
  const candidates = [
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i),
    html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i),
    html.match(/<meta[^>]+itemprop=["']image["'][^>]+content=["']([^"']+)["']/i),
    html.match(/<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)["']/i),
  ];

  for (const match of candidates) {
    const value = match?.[1]?.replace(/&amp;/g, "&").trim();
    if (value && /^https?:\/\//i.test(value)) return value;
  }

  return null;
}

function validateArticleQuality(item: CrawledItem, content: string, tags: string[]) {
  const reasons: string[] = [];
  const combinedText = `${item.originalTitle} ${item.excerpt} ${content} ${tags.join(" ")}`;
  const wordCount = countArticleWords(content);

  if (!isFinanceArticle(combinedText)) reasons.push("not_finance_stock_news");
  if (!hasArticleImage(item.imageUrl)) reasons.push("missing_image");
  if (wordCount < 300) reasons.push(`word_count_${wordCount}_below_300`);

  return {
    ok: reasons.length === 0,
    reasons,
    wordCount,
  };
}

async function crawlNews(): Promise<CrawledItem[]> {
  const RSS_FEEDS = [
    { source: "CafeF", url: "https://cafef.vn/thi-truong-chung-khoan.rss", category: "thi-truong" },
    { source: "VnExpress", url: "https://vnexpress.net/rss/chung-khoan.rss", category: "thi-truong" },
    { source: "VnExpress", url: "https://vnexpress.net/rss/kinh-doanh.rss", category: "doanh-nghiep" },
    { source: "Người Lao Động", url: "https://nld.com.vn/rss/kinh-te.rss", category: "vi-mo" },
    { source: "VnEconomy", url: "https://vneconomy.vn/chung-khoan.rss", category: "thi-truong" },
    { source: "Đầu Tư Chứng Khoán", url: "https://www.tinnhanhchungkhoan.vn/rss/home.rss", category: "thi-truong" },
    { source: "Vietstock", url: "https://vietstock.vn/rss/chung-khoan.rss", category: "thi-truong" },
    { source: "Tuổi Trẻ", url: "https://tuoitre.vn/rss/kinh-doanh.rss", category: "vi-mo" },
    { source: "Thanh Niên", url: "https://thanhnien.vn/rss/kinh-te.rss", category: "vi-mo" },
    { source: "Dân Trí", url: "https://dantri.com.vn/rss/kinh-doanh.rss", category: "vi-mo" },
    { source: "VietnamNet", url: "https://vietnamnet.vn/rss/kinh-doanh.rss", category: "vi-mo" },
  ];

  const items: CrawledItem[] = [];

  for (const feed of RSS_FEEDS) {
    try {
      const res = await fetch(feed.url, {
        headers: { "User-Agent": "ADN-Capital-Bot/1.0" },
        redirect: "follow",
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;

      const xml = await res.text();

      // Simple XML parsing for RSS <item> elements
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;
      let count = 0;

      while ((match = itemRegex.exec(xml)) !== null && count < 5) {
        const itemXml = match[1];
        const title = extractTag(itemXml, "title");
        const link = extractTag(itemXml, "link");
        const description = extractTag(itemXml, "description");
        // VnExpress uses <enclosure url="..."/> for images
        const enclosureMatch = itemXml.match(/enclosure[^>]*url="([^"]+)"/i);
        const imgMatch = enclosureMatch
          || itemXml.match(/url="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i)
          || description.match(/src="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i);

        if (title && link) {
          items.push({
            originalTitle: cleanHtml(title),
            excerpt: cleanHtml(description).slice(0, 300),
            content: `<p>${cleanHtml(description)}</p>`,
            sourceUrl: link.trim(),
            sourceName: feed.source,
            trustedSource: true,
            imageUrl: imgMatch?.[1]?.replace(/&amp;/g, "&") ?? null,
            pdfUrl: null,
            categorySlug: feed.category,
          });
          count++;
        }
      }
    } catch (err) {
      console.warn(`[Crawler] Failed to fetch ${feed.url}:`, err);
    }
  }

  return items;
}

// ── Step 1b: Research PDF crawler (SSI, VNDirect, HSC placeholder) ──
async function crawlResearchPDFs(): Promise<CrawledItem[]> {
  // Placeholder — real implementation would scrape CTCK research pages
  // For now, return empty. Sẽ mở rộng khi có API cụ thể.
  const RESEARCH_SOURCES = [
    { name: "SSI Research", url: "https://www.ssi.com.vn/en/research-center" },
    { name: "VNDirect Research", url: "https://www.vndirect.com.vn/nhan-dinh/" },
    { name: "HSC Research", url: "https://www.hsc.com.vn/vn/nhan-dinh-phan-tich" },
  ];

  // TODO: Implement actual scraping for research PDFs
  // Each source would need specific parsing logic
  console.log("[Crawler] Research PDF sources (placeholder):", RESEARCH_SOURCES.map(s => s.name));
  return [];
}

// ── Step 2: AI Rewrite via Gemini ──
async function aiRewrite(item: CrawledItem): Promise<AIRewriteResult> {
  // Try to fetch full article content from source URL
  let fullContent = item.content;
  if (item.sourceUrl) {
    try {
      const pageRes = await fetch(item.sourceUrl, {
        headers: { "User-Agent": "ADN-Capital-Bot/1.0" },
        signal: AbortSignal.timeout(10000),
      });
      if (pageRes.ok) {
        const html = await pageRes.text();
        item.imageUrl = item.imageUrl || extractImageFromHtml(html);
        // Extract main article body from VnExpress / CafeF / generic pages
        const bodyMatch =
          html.match(/<article[^>]*class="[^"]*fck_detail[^"]*"[^>]*>([\s\S]*?)<\/article>/i) ||
          html.match(/<div[^>]*class="[^"]*fck_detail[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<div|<\/section)/i) ||
          html.match(/<div[^>]*class="[^"]*detail-content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<div[^>]*class="[^"]*(?:relate|tag|box-social|author-info))/i) ||
          html.match(/<div[^>]*class="[^"]*knc-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
          html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
        if (bodyMatch?.[1] && bodyMatch[1].length > 200) {
          // Clean VnExpress/CafeF bloat: strip figures, scripts, styles, data-components
          fullContent = bodyMatch[1]
            .replace(/<figure[\s\S]*?<\/figure>/gi, "")
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<div[^>]*data-component[^>]*>[\s\S]*?<\/div>/gi, "")
            .replace(/<span[^>]*id="article-end"[^>]*><\/span>/gi, "")
            .replace(/<img[^>]*>/gi, "")
            .replace(/\s{2,}/g, " ")
            .trim();
        }
      }
    } catch {
      // Fallback to RSS excerpt
    }
  }

  const qualityRules = `
YEU CAU CHAT LUONG BAT BUOC CHO WEB ADN:
- Chi bien tap tin lien quan den tai chinh, chung khoan, ngan hang, vi mo, doanh nghiep niem yet, trai phieu, bat dong san hoac thi truong von.
- Bai viet phai co do dai toi thieu 1000 tu sau khi bien tap, day du boi canh, so lieu, dien bien, tac dong va rui ro.
- Noi dung phai chia dong nhu bai bao truyen thong: moi y trong mot the <p>, moi doan toi da 3-4 cau, co <h3> khi doi y lon.
- Phai tao hashtag SEO trong mang tags, uu tien: chung khoan, tai chinh, VNIndex, ten nguon va chu de lien quan.
- Khong viet nhu status ngan tren mang xa hoi; khong tao KPI, loi nhuan hay khuyen nghi khong co co so.
`;

  const prompt = `${qualityRules}

Bạn là một Chuyên gia phân tích vĩ mô và Nhà báo tài chính kỳ cựu đang làm việc tại ADN Capital. Nhiệm vụ của bạn là biên tập lại bài báo thô được cung cấp. Bạn phải tuân thủ TUYỆT ĐỐI các luật lệ sau:

1. GIỌNG VĂN KHÁCH QUAN, LẠNH LÙNG: Viết theo phong cách báo chí tài chính quốc tế (Reuters, Bloomberg, CafeF). Tập trung 100% vào sự kiện, dữ liệu, con số và luận điểm logic.
2. CÁC TỪ CẤM (BLACKLIST): Tuyệt đối KHÔNG sử dụng các cụm từ sáo rỗng của AI như: "bức tranh toàn cảnh", "hành trình", "nhìn chung", "đáng chú ý", "không thể phủ nhận", "thời đại số", "có thể thấy", "như chúng ta đã biết", "sự trỗi dậy", "thắp sáng", "SỐC", "bùng nổ", "chấn động". Không dùng dấu chấm than (!).
3. CẤU TRÚC: aiSummary phải là 3 gạch đầu dòng súc tích (dùng •), đi thẳng vào số liệu. Phần content phải giữ nguyên 100% độ dài bài gốc, giữ mọi số liệu, trích dẫn, luận điểm, nhưng được format lại bằng các thẻ <p>, <h3> rõ ràng, mạch lạc. KHÔNG liệt kê kiểu checklist. KHÔNG tóm tắt, cắt xén hay rút ngắn.
4. CHIA ĐOẠN VĂN BẮT BUỘC: Mỗi đoạn văn (paragraph) PHẢI nằm trong thẻ <p> riêng biệt. TUYỆT ĐỐI KHÔNG viết liền nhiều câu trong cùng 1 thẻ <p> nếu chúng thuộc các ý khác nhau. Mỗi đoạn <p> tối đa 3-4 câu. Giữa các đoạn phải có khoảng cách rõ ràng. Khi chuyển sang ý mới → tạo thẻ <p> mới. Khi có tiểu mục → dùng <h3>. Bài viết phải thoáng, dễ đọc, KHÔNG được viết tường chữ dày đặc.
5. ĐỊNH DẠNG: Trả về chuẩn JSON (KHÔNG markdown code block).

TIÊU ĐỀ GỐC: ${item.originalTitle}

NỘI DUNG BÀI BÁO:
${fullContent}

Trả về JSON với các key:
- "title": Tiêu đề biên tập lại, ngắn gọn, khách quan, tối đa 100 ký tự, KHÔNG giật gân, KHÔNG dấu chấm than
- "aiSummary": 3 gạch đầu dòng (•) súc tích, toàn số liệu
- "content": HTML đầy đủ bài gốc, format bằng <p> <h3> <strong>, giữ 100% nội dung
- "sentiment": "Tích cực" hoặc "Tiêu cực" hoặc "Trung tính"
- "tags": Mảng 2-4 tags

{"title":"...","aiSummary":"...","content":"<p>...</p>","sentiment":"...","tags":["..."]}`;

  try {
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.2,
      },
    });

    const text = response.text ?? "";
    // Extract JSON from response (handle potential markdown wrapping)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in AI response");
    }

    const result = JSON.parse(jsonMatch[0]) as AIRewriteResult;
    // Validate required fields
    if (!result.title || !result.sentiment) {
      throw new Error("Missing required fields in AI response");
    }
    // Normalize aiSummary: Gemini sometimes returns array instead of string
    if (Array.isArray(result.aiSummary)) {
      result.aiSummary = (result.aiSummary as string[]).join("\n");
    }
    // If AI returned content, use it; otherwise keep original
    if (result.content) {
      item.content = result.content;
    }
    return result;
  } catch (err) {
    console.warn("[AI Rewrite] Failed, using fallback:", err);
    return {
      title: item.originalTitle,
      aiSummary: item.excerpt.slice(0, 200),
      content: fullContent,
      sentiment: "Trung tính",
      tags: ["Tin tức"],
    };
  }
}

// ── Step 3: Save to DB ──
async function saveArticle(
  item: CrawledItem,
  aiResult: AIRewriteResult,
  adminUserId: string
): Promise<SaveArticleResult> {
  // Check if article with same sourceUrl already exists
  if (item.sourceUrl) {
    const existing = await prisma.article.findFirst({
      where: { sourceUrl: item.sourceUrl },
      select: { id: true },
    });
    if (existing) {
      return { id: existing.id, title: aiResult.title, status: "SKIPPED" };
    }
  }

  // Find category
  const category = await prisma.category.findFirst({
    where: { slug: item.categorySlug },
    select: { id: true },
  });

  const sanitizedContent = sanitizeArticleHtml(aiResult.content || item.content);
  const seoTags = ensureSeoTags(aiResult.tags, item.sourceName);
  const quality = validateArticleQuality(item, sanitizedContent, seoTags);

  if (!quality.ok) {
    return {
      id: "",
      title: aiResult.title,
      status: "SKIPPED_QUALITY",
      reason: quality.reasons.join(","),
    };
  }

  const article = await prisma.article.create({
    data: {
      title: aiResult.title,
      originalTitle: item.originalTitle,
      slug: generateSlug(aiResult.title),
      content: sanitizedContent,
      excerpt: item.excerpt,
      aiSummary: aiResult.aiSummary,
      sourceUrl: item.sourceUrl,
      imageUrl: item.imageUrl,
      pdfUrl: item.pdfUrl,
      tags: JSON.stringify(seoTags),
      sentiment: aiResult.sentiment,
      categoryId: category?.id ?? null,
      authorId: adminUserId,
      status: item.trustedSource ? "PUBLISHED" : "PENDING_APPROVAL",
      publishedAt: item.trustedSource ? new Date() : null,
    },
  });

  return { id: article.id, title: article.title, status: article.status };
}

// ── Helpers ──
function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i"));
  return match?.[1]?.trim() ?? "";
}

function cleanHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

// ═══ Main Handler ═══
export async function POST(request: Request) {
  // Auth: ADMIN session OR x-api-key header (for cron/automation)
  const apiKey = request.headers.get("x-api-key");
  const CRAWLER_API_KEY = process.env.CRAWLER_API_KEY;
  const cronSecret = request.headers.get("x-cron-secret") ?? request.headers.get("x-internal-key");
  const expectedCronSecret = (process.env.CRON_SECRET ?? process.env.INTERNAL_API_KEY ?? "adn-cron-dev-key").trim();
  const isCronAuthorized = Boolean(cronSecret && expectedCronSecret && cronSecret.trim() === expectedCronSecret);

  let adminUserId: string;

  if ((apiKey && CRAWLER_API_KEY && apiKey === CRAWLER_API_KEY) || isCronAuthorized) {
    // API key auth: find first admin user
    const admin = await prisma.user.findFirst({
      where: { systemRole: "ADMIN" },
      select: { id: true },
    });
    if (!admin) {
      return NextResponse.json({ error: "No admin user found" }, { status: 500 });
    }
    adminUserId = admin.id;
  } else {
    // Session auth
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { systemRole: true },
    });
    if (dbUser?.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Chỉ ADMIN mới được chạy crawler" }, { status: 403 });
    }
    adminUserId = session.user.id;
  }

  try {
    // Step 1: Crawl
    const [newsItems, pdfItems] = await Promise.all([crawlNews(), crawlResearchPDFs()]);
    const allItems = [...newsItems, ...pdfItems];

    if (allItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Không có bài viết mới để crawl",
        results: [],
      });
    }

    const sourceUrls = Array.from(new Set(allItems.map((item) => item.sourceUrl).filter(Boolean)));
    const existingRows = sourceUrls.length > 0
      ? await prisma.article.findMany({
          where: { sourceUrl: { in: sourceUrls } },
          select: { sourceUrl: true },
        })
      : [];
    const existingUrls = new Set(existingRows.map((row) => row.sourceUrl).filter(Boolean));
    const newItems = allItems.filter((item) => item.sourceUrl && !existingUrls.has(item.sourceUrl)).slice(0, 8);

    if (newItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: "KhÃ´ng cÃ³ bÃ i viáº¿t má»›i Ä‘á»ƒ crawl",
        scanned: allItems.length,
        results: [],
      });
    }

    // Step 2 + 3: AI Rewrite + Save (sequential to avoid rate limits)
    const results: SaveArticleResult[] = [];

    for (const item of newItems) {
      const aiResult = await aiRewrite(item);
      const saved = await saveArticle(item, aiResult, adminUserId);
      results.push(saved);
    }

    const created = results.filter((r) => r.status === "PENDING_APPROVAL" || r.status === "PUBLISHED").length;
    const published = results.filter((r) => r.status === "PUBLISHED").length;
    const skipped = results.filter((r) => r.status === "SKIPPED" || r.status === "SKIPPED_QUALITY").length;
    const skippedQuality = results.filter((r) => r.status === "SKIPPED_QUALITY").length;

    return NextResponse.json({
      success: true,
      published,
      scanned: allItems.length,
      processed: newItems.length,
      message: `Crawled ${allItems.length} bài, tạo ${created} mới, bỏ qua ${skipped} bài (${skippedQuality} bài không đạt chuẩn chất lượng)`,
      results,
    });
  } catch (error) {
    console.error("[/api/crawler/run] Error:", error);
    return NextResponse.json({ error: "Lỗi chạy crawler" }, { status: 500 });
  }
}

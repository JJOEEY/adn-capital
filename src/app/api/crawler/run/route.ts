import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GoogleGenAI } from "@google/genai";

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
async function crawlNews(): Promise<CrawledItem[]> {
  const RSS_FEEDS = [
    { url: "https://vnexpress.net/rss/chung-khoan.rss", category: "thi-truong" },
    { url: "https://vnexpress.net/rss/kinh-doanh.rss", category: "doanh-nghiep" },
    { url: "https://vnexpress.net/rss/kinh-doanh/vi-mo.rss", category: "vi-mo" },
    { url: "https://vnexpress.net/rss/kinh-doanh/quoc-te.rss", category: "quoc-te" },
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
        // Extract main article body from CafeF / VnEconomy / generic pages
        const bodyMatch =
          html.match(/<div[^>]*class="[^"]*detail-content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<div[^>]*class="[^"]*(?:relate|tag|box-social|author-info))/i) ||
          html.match(/<div[^>]*id="[^"]*(?:mainContent|articleContent|newsContent)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div/i) ||
          html.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
          html.match(/<div[^>]*class="[^"]*knc-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
        if (bodyMatch?.[1] && bodyMatch[1].length > 200) {
          fullContent = bodyMatch[1];
        }
      }
    } catch {
      // Fallback to RSS excerpt
    }
  }

  const prompt = `Ngươi là một Biên tập viên Tài chính cấp cao. Dữ liệu đầu vào là một bài báo thô. Hãy trả về JSON (KHÔNG markdown code block) với các phần sau:

TIÊU ĐỀ GỐC: ${item.originalTitle}

NỘI DUNG BÀI BÁO:
${fullContent}

YÊU CẦU TRẢ VỀ JSON:
1. "title": Viết lại tiêu đề cho giật gân, hấp dẫn hơn (tiếng Việt, tối đa 120 ký tự)
2. "aiSummary": Tóm tắt cực ngắn gọn thành 3 gạch đầu dòng (dùng • thay cho -)
3. "content": Nội dung chi tiết của bài báo dạng HTML. [QUAN TRỌNG]: BẮT BUỘC phải giữ nguyên 100% độ dài, duy trì TẤT CẢ các đoạn văn, số liệu, trích dẫn và luận điểm của bài gốc. Chỉ thực hiện: làm sạch thẻ HTML lỗi, xóa text quảng cáo/liên kết nội bộ của báo gốc, format lại bằng các thẻ <p>, <h2>, <h3>, <strong>, <ul>, <li> cho đẹp mắt. TUYỆT ĐỐI KHÔNG ĐƯỢC TÓM TẮT, CẮT XÉN HAY RÚT NGẮN PHẦN content NÀY.
4. "sentiment": Phân loại "Tích cực" hoặc "Tiêu cực" hoặc "Trung tính"
5. "tags": Mảng 2-4 tags phù hợp (VD: ["Thị trường", "VN-Index", "Khối ngoại"])

Trả về ĐÚNG JSON format:
{"title":"...","aiSummary":"...","content":"<p>...</p>","sentiment":"...","tags":["..."]}`;

  try {
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
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
): Promise<{ id: string; title: string; status: string }> {
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

  const article = await prisma.article.create({
    data: {
      title: aiResult.title,
      originalTitle: item.originalTitle,
      slug: generateSlug(aiResult.title),
      content: aiResult.content || item.content,
      excerpt: item.excerpt,
      aiSummary: aiResult.aiSummary,
      sourceUrl: item.sourceUrl,
      imageUrl: item.imageUrl,
      pdfUrl: item.pdfUrl,
      tags: JSON.stringify(aiResult.tags),
      sentiment: aiResult.sentiment,
      categoryId: category?.id ?? null,
      authorId: adminUserId,
      status: "PENDING_APPROVAL",
    },
  });

  return { id: article.id, title: article.title, status: "PENDING_APPROVAL" };
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
export async function POST() {
  // Auth check: ADMIN only
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

    // Step 2 + 3: AI Rewrite + Save (sequential to avoid rate limits)
    const results: { id: string; title: string; status: string }[] = [];

    for (const item of allItems) {
      const aiResult = await aiRewrite(item);
      const saved = await saveArticle(item, aiResult, session.user.id);
      results.push(saved);
    }

    const created = results.filter((r) => r.status === "PENDING_APPROVAL").length;
    const skipped = results.filter((r) => r.status === "SKIPPED").length;

    return NextResponse.json({
      success: true,
      message: `Crawled ${allItems.length} bài, tạo ${created} mới, bỏ qua ${skipped} trùng`,
      results,
    });
  } catch (error) {
    console.error("[/api/crawler/run] Error:", error);
    return NextResponse.json({ error: "Lỗi chạy crawler" }, { status: 500 });
  }
}

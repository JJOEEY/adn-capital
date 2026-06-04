import type { DatabaseMorningBriefPayload, DatabaseNewsItem } from "@/lib/database/providers/news";

type MorningRewriteInput = {
  payload: DatabaseMorningBriefPayload;
  news: DatabaseNewsItem[];
};

type MorningRewriteOutput = {
  vn_market: string[];
  macro: string[];
  risk_opportunity: string[];
};

const DEFAULT_FREEMODEL_BASE_URL = "https://api.freemodel.dev/v1";
const DEFAULT_FREEMODEL_MODEL = "gpt-5.4";
const DEFAULT_TIMEOUT_MS = 18_000;

function decodeHtmlEntities(text: string) {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: "\"",
  };
  return text
    .replace(/&#(\d+);/g, (match, code) => {
      const value = Number(code);
      if (!Number.isFinite(value)) return match;
      try {
        return String.fromCodePoint(value);
      } catch {
        return match;
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (match, code) => {
      const value = Number.parseInt(code, 16);
      if (!Number.isFinite(value)) return match;
      try {
        return String.fromCodePoint(value);
      } catch {
        return match;
      }
    })
    .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match);
}

function cleanOutputLine(value: unknown) {
  return decodeHtmlEntities(String(value ?? ""))
    .replace(/<[^>]+>/g, " ")
    .replace(/[*_`]/g, "")
    .replace(/^\s*(?:[-•]+|\d+[.)])\s*/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeArray(value: unknown, maxItems: number) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const items: string[] = [];
  for (const raw of value) {
    const item = cleanOutputLine(raw);
    if (!item || item.length < 24) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
    if (items.length >= maxItems) break;
  }
  return items;
}

function extractJsonObject(text: string) {
  const cleaned = text
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first < 0 || last <= first) return null;
  return cleaned.slice(first, last + 1);
}

function buildPrompt(input: MorningRewriteInput) {
  const news = input.news.slice(0, 36).map((item) => ({
    category: item.category,
    title: item.title,
    summary: item.summary,
    publishedAt: item.publishedAt,
  }));

  return [
    "Bạn là biên tập viên bản tin sáng thị trường chứng khoán Việt Nam cho ADN Capital.",
    "Nhiệm vụ: đọc các tin đã crawl, gom nhóm và viết lại thành bản tin phân tích buổi sáng. Không chép tiêu đề, không liệt kê thời gian đăng tin.",
    "Chỉ dùng dữ liệu được cung cấp. Không bịa số liệu, không khuyến nghị mua bán chắc chắn.",
    "Không nhắc tên nguồn dữ liệu, API, backend, provider, cache hoặc lỗi kỹ thuật.",
    "Văn phong: ngắn gọn, rõ ý, giống bản tin thị trường cho nhà đầu tư cá nhân. Mỗi ý phải nói được tin này ảnh hưởng gì tới thị trường hoặc nhóm ngành.",
    "Trả về JSON thuần, không markdown, không giải thích ngoài JSON.",
    'Schema bắt buộc: {"vn_market":["..."],"macro":["..."],"risk_opportunity":["..."]}',
    "Yêu cầu nội dung:",
    "- vn_market: 4-6 ý, gom theo nhóm ngành hoặc mã nổi bật, ví dụ Năng lượng & Điện, Doanh nghiệp biến động lớn, Dòng tiền/Huy động vốn, Cổ tức/KQKD.",
    "- macro: 3-5 ý. Tin category macro dùng cho vĩ mô trong nước; tin category global dùng cho vĩ mô quốc tế.",
    "- risk_opportunity: 3-5 ý, phân tích rõ rủi ro/cơ hội và nhận định chung cho phiên tới.",
    "",
    "Dữ liệu hiện có:",
    JSON.stringify({
      date: input.payload.date,
      reference_indices: input.payload.reference_indices,
      draft: {
        vn_market: input.payload.vn_market,
        macro: input.payload.macro,
        risk_opportunity: input.payload.risk_opportunity,
      },
      news,
    }),
  ].join("\n");
}

export async function rewriteMorningBriefWithFreeModel(input: MorningRewriteInput): Promise<MorningRewriteOutput | null> {
  const apiKey = process.env.FREEMODEL_API_KEY?.trim();
  if (!apiKey) return null;

  const baseUrl = (process.env.FREEMODEL_OPENAI_BASE_URL || DEFAULT_FREEMODEL_BASE_URL).replace(/\/+$/, "");
  const model = process.env.MORNING_BRIEF_FREEMODEL_MODEL || DEFAULT_FREEMODEL_MODEL;
  const parsedTimeoutMs = Number(process.env.MORNING_BRIEF_FREEMODEL_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(parsedTimeoutMs) ? parsedTimeoutMs : DEFAULT_TIMEOUT_MS;

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.25,
        max_tokens: 1500,
        messages: [
          {
            role: "system",
            content: "Bạn viết tiếng Việt rõ ràng, thực dụng, dành cho nhà đầu tư cá nhân. Luôn trả JSON hợp lệ.",
          },
          { role: "user", content: buildPrompt(input) },
        ],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) throw new Error(`freemodel_http_${res.status}`);
    const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? "";
    const parsedText = extractJsonObject(content);
    if (!parsedText) throw new Error("freemodel_invalid_json");
    const parsed = JSON.parse(parsedText) as Partial<MorningRewriteOutput>;

    const output = {
      vn_market: sanitizeArray(parsed.vn_market, 6),
      macro: sanitizeArray(parsed.macro, 5),
      risk_opportunity: sanitizeArray(parsed.risk_opportunity, 5),
    };
    if (!output.vn_market.length || !output.macro.length || !output.risk_opportunity.length) {
      throw new Error("freemodel_incomplete_output");
    }
    return output;
  } catch (error) {
    console.warn("[database:morning] FreeModel rewrite skipped", error instanceof Error ? error.message : String(error));
    return null;
  }
}

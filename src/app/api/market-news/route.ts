import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketSnapshot, getInvestorTradingText } from "@/lib/marketDataFetcher";
import { fetchAllCafefNews } from "@/lib/cafefScraper";
import { fetchEodNews, fetchMorningNews, type FiinEodNews, type FiinMorningNews } from "@/lib/fiinquantClient";

export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

type IndexRow = {
  name: string;
  value: number;
  change_pct: number;
};

type ExchangeLiquidity = {
  HOSE: number | null;
  HNX: number | null;
  UPCOM: number | null;
};

type MorningPayload = {
  date: string;
  reference_indices: Array<{
    name: string;
    value: number | null;
    change_pct: number | null;
  }>;
  vn_market: string[];
  macro: string[];
  risk_opportunity: string[];
};

type EodPayload = {
  date: string;
  vnindex: number;
  change_pct: number;
  liquidity: number;
  total_liquidity?: number | null;
  matched_liquidity?: number | null;
  negotiated_liquidity?: number | null;
  liquidity_by_exchange?: ExchangeLiquidity;
  breadth: { up: number; down: number; unchanged: number; total: number };
  session_summary: string;
  liquidity_detail: string;
  foreign_flow: string;
  notable_trades: string;
  outlook: string;
  sub_indices: Array<{ name: string; change_pts: number; change_pct: number }>;
  foreign_top_buy: string[];
  foreign_top_sell: string[];
  prop_trading_top_buy: string[];
  prop_trading_top_sell: string[];
  individual_top_buy: string[];
  individual_top_sell: string[];
  sector_gainers: string[];
  sector_losers: string[];
  buy_signals: string[];
  sell_signals: string[];
  top_breakout: string[];
  top_new_high: string[];
};

function fromBridgeMorningPayload(raw: FiinMorningNews): MorningPayload {
  return {
    date: raw.date,
    reference_indices: Array.isArray(raw.reference_indices)
      ? raw.reference_indices.map((item) => ({
          name: normalizeIndexName(repairMojibake(item.name)),
          value: toNumberOrNull(item.value),
          change_pct: toNumberOrNull(item.change_pct),
        }))
      : [],
    vn_market: Array.isArray(raw.vn_market)
      ? raw.vn_market.map((line) => sanitizeNewsLine(line)).filter(Boolean).slice(0, 5)
      : [],
    macro: Array.isArray(raw.macro)
      ? raw.macro.map((line) => sanitizeNewsLine(line)).filter(Boolean).slice(0, 5)
      : [],
    risk_opportunity: Array.isArray(raw.risk_opportunity)
      ? raw.risk_opportunity.map((line) => sanitizeNewsLine(line)).filter(Boolean).slice(0, 5)
      : [],
  };
}

function fromBridgeEodPayload(raw: FiinEodNews): EodPayload {
  const rawRecord = raw as unknown as JsonRecord;
  const liquidityByExchange = normalizeExchangeLiquidity({
    HOSE: toNumberOrNull(rawRecord.hose_val),
    HNX: toNumberOrNull(rawRecord.hnx_val),
    UPCOM: toNumberOrNull(rawRecord.upcom_val),
  });
  const liquidityBreakdown = extractLiquidityBreakdown(rawRecord, rawRecord, raw.liquidity_detail ?? "", liquidityByExchange);
  const matchedLiquidity = liquidityBreakdown.matched ?? sumExchangeLiquidity(liquidityByExchange) ?? toNumberOrNull(raw.liquidity);
  const displayLiquidity = liquidityBreakdown.total ?? matchedLiquidity ?? toNumber(raw.liquidity);

  return {
    date: raw.date,
    vnindex: toNumber(raw.vnindex),
    change_pct: toNumber(raw.change_pct),
    liquidity: toNumber(displayLiquidity),
    total_liquidity: liquidityBreakdown.total,
    matched_liquidity: matchedLiquidity,
    negotiated_liquidity: liquidityBreakdown.negotiated,
    liquidity_by_exchange: liquidityByExchange,
    breadth: {
      up: toNumber(raw.breadth?.up),
      down: toNumber(raw.breadth?.down),
      unchanged: toNumber(raw.breadth?.unchanged),
      total: toNumber(raw.breadth?.total),
    },
    session_summary: raw.session_summary ?? "",
    liquidity_detail: buildLiquidityDetail(toNumber(displayLiquidity), liquidityByExchange, {
      total: liquidityBreakdown.total,
      matched: matchedLiquidity,
      negotiated: liquidityBreakdown.negotiated,
    }) || raw.liquidity_detail || "",
    foreign_flow: raw.foreign_flow ?? "",
    notable_trades: raw.notable_trades ?? "",
    outlook: raw.outlook ?? "",
    sub_indices: Array.isArray(raw.sub_indices) ? raw.sub_indices : [],
    foreign_top_buy: parseStringArray(raw.foreign_top_buy),
    foreign_top_sell: parseStringArray(raw.foreign_top_sell),
    prop_trading_top_buy: parseStringArray(raw.prop_trading_top_buy),
    prop_trading_top_sell: parseStringArray(raw.prop_trading_top_sell),
    individual_top_buy: parseStringArray(rawRecord.individual_top_buy),
    individual_top_sell: parseStringArray(rawRecord.individual_top_sell),
    sector_gainers: parseStringArray(raw.sector_gainers),
    sector_losers: parseStringArray(raw.sector_losers),
    buy_signals: parseStringArray(raw.buy_signals),
    sell_signals: parseStringArray(raw.sell_signals),
    top_breakout: parseStringArray(raw.top_breakout),
    top_new_high: parseStringArray(rawRecord.top_new_high),
  };
}

type ReportRow = {
  createdAt: Date;
  content: string;
  rawData: string | null;
};

function parseJsonMaybe(value: string | null): JsonRecord | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? (parsed as JsonRecord) : null;
  } catch {
    return null;
  }
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.,-]/g, "").replace(/,/g, "");
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toNumber(value: unknown, fallback = 0): number {
  const n = toNumberOrNull(value);
  return n ?? fallback;
}

function normalizeExchangeValue(value: number | null): number | null {
  return value != null && Number.isFinite(value) && value > 0 ? value : null;
}

function normalizeExchangeLiquidity(exchanges: ExchangeLiquidity): ExchangeLiquidity {
  return {
    HOSE: normalizeExchangeValue(exchanges.HOSE),
    HNX: normalizeExchangeValue(exchanges.HNX),
    UPCOM: normalizeExchangeValue(exchanges.UPCOM),
  };
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function pickRecord(base: JsonRecord, keys: string[]): JsonRecord | null {
  for (const key of keys) {
    const value = base[key];
    if (isRecord(value)) return value;
  }
  return null;
}

function pickArray(base: JsonRecord, keys: string[]): unknown[] {
  for (const key of keys) {
    const value = base[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function stripDiacritics(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function mojibakeScore(text: string): number {
  const direct =
    (text.match(/[ÃÂÆÐ€�]/g)?.length ?? 0) * 4 +
    (text.match(/(?:áº|á»|â€|â€“|â€”|â€¢)/g)?.length ?? 0) * 3;
  return direct;
}

function latin1ToUtf8(text: string): string {
  try {
    return Buffer.from(text, "latin1").toString("utf8");
  } catch {
    return text;
  }
}

function repairMojibake(text: string): string {
  if (!text) return "";
  const candidates = [text, latin1ToUtf8(text)];
  candidates.push(latin1ToUtf8(candidates[1]));

  let best = candidates[0];
  let bestScore = mojibakeScore(best);
  for (const candidate of candidates.slice(1)) {
    const score = mojibakeScore(candidate);
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&quot;/gi, "\"")
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ");
}

function normalizeForCheck(text: string): string {
  return stripDiacritics(repairMojibake(text)).toLowerCase().replace(/\s+/g, " ").trim();
}

function isUnavailableText(text: string): boolean {
  if (!text?.trim()) return true;
  const n = normalizeForCheck(text);
  return (
    n.includes("chua cap nhat") ||
    n.includes("dang cap nhat") ||
    n.includes("khong co du lieu") ||
    n.includes("khong co thong tin") ||
    n.includes("n/a")
  );
}

function toViDate(value: Date): string {
  return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }).format(value);
}

function toViDateFromDateKey(dateKey: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return dateKey;
  const value = new Date(`${dateKey}T00:00:00+07:00`);
  if (Number.isNaN(value.getTime())) return dateKey;
  return toViDate(value);
}

function stripMarkdownAndBullets(text: string): string {
  return text
    .replace(/[*_`]/g, "")
    .replace(/\\([|_*`])/g, "$1")
    .replace(/^\s*(?:[-•●▪▫◦‣▶►]+|\d+[.)]|[^\p{L}\p{N}]*)/u, "")
    .trim();
}

function sanitizeNewsLine(text: string): string {
  return repairMojibake(stripMarkdownAndBullets(decodeHtmlEntities(text)));
}

function sanitizeNarrativeLine(text: string): string {
  const cleaned = sanitizeNewsLine(text).replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  if (isUnavailableText(cleaned)) return "";
  const noSpace = cleaned.replace(/\s+/g, "");
  if (/^0+$/.test(noSpace)) return "";
  if (/^[\d.,:+\-|/()%\s]+$/.test(cleaned)) return "";
  return cleaned;
}

function isGenericCategoryLine(text: string): boolean {
  const cleaned = sanitizeNewsLine(text);
  if (!cleaned) return true;
  const words = cleaned.split(/\s+/).filter(Boolean);
  const normalized = normalizeForCheck(cleaned);
  if (/\d/.test(cleaned)) return false;
  if (/[,:;.!?]/.test(cleaned)) return false;
  if (words.length <= 4 && cleaned.length <= 36) return true;
  return normalized === "thi truong chung khoan" || normalized === "hang hoa nguyen lieu";
}

function isRiskOpportunityHeader(text: string): boolean {
  const cleaned = stripMarkdownAndBullets(text);
  const n = normalizeForCheck(cleaned);
  const compact = n.replace(/[^a-z]/g, "");
  if (compact === "ruirocohoi" || compact === "ruiro" || compact === "cohoi") return true;
  if (!n.includes("rui ro") && !n.includes("co hoi")) return false;
  return cleaned.length <= 48 && !/[:：]/.test(cleaned);
}

function isHeadingLike(text: string): boolean {
  const n = normalizeForCheck(stripMarkdownAndBullets(text));
  return (
    n.includes("chi so tham chieu") ||
    n.includes("thi truong viet nam") ||
    n.includes("vi mo trong nuoc") ||
    n.includes("quoc te") ||
    isRiskOpportunityHeader(text) ||
    n.includes("ban tin sang")
  );
}

function isSectionHeaderLine(text: string): boolean {
  const n = normalizeForCheck(sanitizeNewsLine(text));
  return (
    isHeadingLike(text) ||
    n.includes("ban tin tong hop") ||
    n.includes("adn capital flashnote") ||
    n.includes("bang dong tien chi tiet")
  );
}

function parseMorningSections(content: string): {
  vnMarket: string[];
  macro: string[];
  riskOpportunity: string[];
} {
  const vnMarket: string[] = [];
  const macro: string[] = [];
  const riskOpportunity: string[] = [];
  let section: "vn" | "macro" | "risk" | null = null;

  const lines = content.split("\n").map((line) => line.trim());
  for (const line of lines) {
    if (!line) continue;
    const cleanedLine = sanitizeNewsLine(line);
    const normalized = normalizeForCheck(cleanedLine);

    if (normalized.includes("thi truong viet nam")) {
      section = "vn";
      continue;
    }
    if (normalized.includes("vi mo") || normalized.includes("quoc te")) {
      section = "macro";
      continue;
    }
    if (isRiskOpportunityHeader(cleanedLine)) {
      section = "risk";
      continue;
    }
    if (
      normalized.startsWith("rui ro") ||
      normalized.startsWith("co hoi") ||
      normalized.startsWith("ap luc") ||
      normalized.startsWith("than trong") ||
      normalized.startsWith("luu y")
    ) {
      section = "risk";
    }

    if (!section) continue;
    if (isSectionHeaderLine(line)) continue;

    const cleaned = sanitizeNewsLine(line);
    if (!cleaned || cleaned.length < 10) continue;
    if (isUnavailableText(cleaned)) continue;
    if (isGenericCategoryLine(cleaned)) continue;

    if (section === "vn") vnMarket.push(cleaned);
    if (section === "macro") macro.push(cleaned);
    if (section === "risk") riskOpportunity.push(cleaned);
  }

  return {
    vnMarket: vnMarket.slice(0, 5),
    macro: macro.slice(0, 5),
    riskOpportunity: riskOpportunity.slice(0, 5),
  };
}

function isMacroHeadline(line: string): boolean {
  const n = normalizeForCheck(line);
  const macroKeywords = [
    "my",
    "us",
    "fed",
    "ecb",
    "dxy",
    "usd",
    "wti",
    "vang",
    "gold",
    "quoc te",
    "toan cau",
    "vi mo",
    "lai suat",
    "ty gia",
    "cpi",
    "pmi",
    "trung quoc",
    "chau au",
  ];
  return macroKeywords.some((k) => n.includes(k));
}

function isVietnamMarketHeadline(line: string): boolean {
  const n = normalizeForCheck(line);
  const vnKeywords = [
    "vn-index",
    "vnindex",
    "vn30",
    "hose",
    "hnx",
    "upcom",
    "co phieu",
    "doanh nghiep",
    "nganh",
    "khoi ngoai",
    "chung khoan viet nam",
    "thi truong viet nam",
  ];
  return vnKeywords.some((k) => n.includes(k));
}

function dedupeKeepOrder(items: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const item of items) {
    const cleaned = sanitizeNewsLine(item);
    if (!cleaned) continue;
    const key = normalizeForCheck(cleaned);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(cleaned);
  }
  return output;
}

function isLikelyNewsLine(line: string): boolean {
  const cleaned = sanitizeNewsLine(line);
  const n = normalizeForCheck(cleaned);
  if (!n || n.length < 14) return false;
  if (isGenericCategoryLine(cleaned)) return false;
  if (isSectionHeaderLine(cleaned)) return false;
  if (n.includes("ban tin sang") || n.includes("chi so tham chieu")) return false;
  if (n.includes("powered by adn capital")) return false;
  if (n.startsWith("vn-index:") || n.startsWith("vnindex:")) return false;
  if (/^[a-z0-9\\-\\s]+:\\s*[\\d.,]+/.test(n)) return false;
  if (cleaned.includes("| +") || cleaned.includes("| -")) return false;
  if (isTemplateHeadingLine(cleaned)) return false;
  return true;
}

function isBoilerplateLine(line: string): boolean {
  const n = normalizeForCheck(sanitizeNewsLine(line));
  return (
    n.includes("powered by adn capital") ||
    n.includes("adncapital.com.vn") ||
    n.includes("khuyen nghi dua tren thuat toan") ||
    n.includes("nha dau tu vui long tuan thu") ||
    n.includes("he thong") ||
    n.includes("ban tin sang adn capital") ||
    isTemplateHeadingLine(line)
  );
}

function isTemplateHeadingLine(line: string): boolean {
  const n = normalizeForCheck(sanitizeNewsLine(line));
  return (
    n.includes("ban tin sang adn capital") ||
    n.includes("ban tin tong hop") ||
    n.includes("nhan dinh smart money") ||
    n.includes("chi so tham chieu")
  );
}

function toMorningHighlight(line: string): string {
  const cleaned = sanitizeNewsLine(line).replace(/\s+/g, " ").trim();
  if (!cleaned) return "";

  let result = cleaned
    .replace(/^tin nhanh[:\-\s]*/i, "")
    .replace(/^ban tin sang adn capital[:\-\s]*/i, "")
    .replace(/^thi truong viet nam[:\-\s]*/i, "")
    .replace(/^vi mo(?:\s+trong\s+nuoc)?(?:\s*&?\s*quoc\s*te)?[:\-\s]*/i, "")
    .trim();

  if (!result) return "";
  if (result.length > 170) {
    const cut = result.slice(0, 170);
    result = `${cut.slice(0, cut.lastIndexOf(" ") > 120 ? cut.lastIndexOf(" ") : 170).trim()}…`;
  }

  return result;
}

function buildMorningHighlights(lines: string[], limit = 5): string[] {
  return dedupeKeepOrder(
    lines
      .map(toMorningHighlight)
      .filter((line) => line.length >= 14)
      .filter((line) => !isTemplateHeadingLine(line))
      .filter((line) => !isBoilerplateLine(line))
      .filter(isLikelyNewsLine),
  ).slice(0, limit);
}

function ensureMinimumHighlights(primary: string[], fallbackPool: string[], min = 4, max = 5): string[] {
  const merged = dedupeKeepOrder([...primary, ...fallbackPool]).slice(0, max);
  if (merged.length >= min) return merged;
  return dedupeKeepOrder([...fallbackPool, ...primary]).slice(0, max);
}

async function fetchPublishedMorningFallback(): Promise<{ vn: string[]; macro: string[] }> {
  try {
    const rows = await prisma.article.findMany({
      where: { status: "PUBLISHED" },
      select: {
        title: true,
        category: { select: { slug: true, name: true } },
      },
      orderBy: { publishedAt: "desc" },
      take: 40,
    });

    const vn: string[] = [];
    const macro: string[] = [];
    for (const row of rows) {
      const title = sanitizeNewsLine(row.title ?? "");
      if (!title || !isLikelyNewsLine(title)) continue;
      const categorySlug = normalizeForCheck(String(row.category?.slug ?? ""));
      const categoryName = normalizeForCheck(String(row.category?.name ?? ""));
      const categoryHint = `${categorySlug} ${categoryName}`;

      const macroByCategory =
        categoryHint.includes("macro") ||
        categoryHint.includes("vi-mo") ||
        categoryHint.includes("quoc-te") ||
        categoryHint.includes("quoc te");

      if (macroByCategory || isMacroHeadline(title)) {
        macro.push(title);
      } else {
        vn.push(title);
      }
    }

    return {
      vn: buildMorningHighlights(vn, 10),
      macro: buildMorningHighlights(macro, 10),
    };
  } catch {
    return { vn: [], macro: [] };
  }
}

function detectNewsSentiment(title: string): "positive" | "negative" | "neutral" {
  const n = normalizeForCheck(title);
  const positiveWords = ["tang", "mua rong", "ho tro", "dot pha", "tich cuc", "hoi phuc", "ha lai suat"];
  const negativeWords = ["giam", "ban rong", "rui ro", "ap luc", "that chat", "suy yeu", "chot loi"];
  if (positiveWords.some((w) => n.includes(w))) return "positive";
  if (negativeWords.some((w) => n.includes(w))) return "negative";
  return "neutral";
}

async function enrichMorningPayload(
  base: MorningPayload,
  bridgeMorningHint: MorningPayload | null = null,
): Promise<MorningPayload> {
  const normalizedBaseVn = dedupeKeepOrder(base.vn_market.filter(isLikelyNewsLine).filter((line) => !isBoilerplateLine(line)));
  const normalizedBaseMacro = dedupeKeepOrder(base.macro.filter(isLikelyNewsLine).filter((line) => !isBoilerplateLine(line)));
  const normalizedBaseRisk = dedupeKeepOrder(
    base.risk_opportunity.filter(isMeaningfulLine).filter((line) => !isBoilerplateLine(line)),
  );

  const [cafefNews, snapshot, publishedFallback] = await Promise.all([
    fetchAllCafefNews().catch(() => null),
    getMarketSnapshot().catch(() => null),
    fetchPublishedMorningFallback(),
  ]);

  const vnNews = cafefNews
    ? dedupeKeepOrder(
        [
          ...cafefNews.stockMarket.articles.map((a) => sanitizeNewsLine(a.title)),
          ...publishedFallback.vn,
        ].filter(isLikelyNewsLine),
      )
    : dedupeKeepOrder(publishedFallback.vn.filter(isLikelyNewsLine));
  const macroNews = cafefNews
    ? dedupeKeepOrder(
        [
          ...cafefNews.macro.articles,
          ...cafefNews.global.articles,
          ...cafefNews.goldForex.articles,
          ...publishedFallback.macro.map((title) => ({ title })),
        ]
          .map((a) => sanitizeNewsLine(a.title))
          .filter(isLikelyNewsLine),
      )
    : dedupeKeepOrder(publishedFallback.macro.filter(isLikelyNewsLine));

  const needsBridgeNews =
    normalizedBaseVn.length + vnNews.length < 4 ||
    normalizedBaseMacro.length + macroNews.length < 4;
  const bridgeMorningPayload =
    bridgeMorningHint ??
    (needsBridgeNews
      ? await fetchMorningNews()
          .then((value) => (value ? fromBridgeMorningPayload(value) : null))
          .catch(() => null)
      : null);

  const mergedVn = ensureMinimumHighlights(buildMorningHighlights([
    ...(bridgeMorningPayload?.vn_market ?? []),
    ...normalizedBaseVn,
    ...vnNews,
  ]), [...vnNews, ...publishedFallback.vn], 4, 5);
  const mergedMacro = ensureMinimumHighlights(buildMorningHighlights([
    ...(bridgeMorningPayload?.macro ?? []),
    ...normalizedBaseMacro,
    ...macroNews,
  ]), [...macroNews, ...publishedFallback.macro], 4, 5);

  const computedRiskOpportunity: string[] = [...normalizedBaseRisk];
  if (snapshot) {
    const vnindex = snapshot.indices.find((item) => item.ticker === "VNINDEX");
    if (vnindex) {
      if (vnindex.changePct < 0) {
        computedRiskOpportunity.push(
          `Rủi ro: VN-INDEX giảm ${Math.abs(vnindex.changePct).toFixed(2)}%, cần ưu tiên kỷ luật tỷ trọng và stoploss.`,
        );
      } else {
        computedRiskOpportunity.push(
          `Cơ hội: VN-INDEX tăng ${vnindex.changePct.toFixed(2)}%, xu hướng ngắn hạn đang giữ nhịp tích cực.`,
        );
      }
    }

    const breadth = snapshot.breadth;
    if (breadth) {
      if (breadth.down > breadth.up) {
        computedRiskOpportunity.push(
          `Rủi ro: Độ rộng nghiêng tiêu cực (giảm ${breadth.down} mã > tăng ${breadth.up} mã), hạn chế mua đuổi.`,
        );
      } else {
        computedRiskOpportunity.push(
          `Cơ hội: Độ rộng tích cực (tăng ${breadth.up} mã > giảm ${breadth.down} mã), ưu tiên nhóm có dòng tiền xác nhận.`,
        );
      }
    }

    const foreignNet = toNumberOrNull(snapshot.investorTrading.foreign.net);
    if (foreignNet != null) {
      if (foreignNet < 0) {
        computedRiskOpportunity.push(`Rủi ro: Khối ngoại đang bán ròng ${Math.abs(foreignNet).toFixed(1)} tỷ, dễ tạo áp lực ngắn hạn.`);
      } else if (foreignNet > 0) {
        computedRiskOpportunity.push(`Cơ hội: Khối ngoại mua ròng ${foreignNet.toFixed(1)} tỷ, hỗ trợ tâm lý và thanh khoản thị trường.`);
      }
    }
  }

  const firstNegativeNews = [...mergedVn, ...mergedMacro].find((title) => detectNewsSentiment(title) === "negative");
  if (firstNegativeNews) {
    computedRiskOpportunity.push(`Rủi ro tin tức: ${firstNegativeNews}`);
  }
  const firstPositiveNews = [...mergedVn, ...mergedMacro].find((title) => detectNewsSentiment(title) === "positive");
  if (firstPositiveNews) {
    computedRiskOpportunity.push(`Cơ hội tin tức: ${firstPositiveNews}`);
  }

  const mergedRisk = dedupeKeepOrder([
    ...(bridgeMorningPayload?.risk_opportunity ?? []),
    ...computedRiskOpportunity,
  ]
    .filter((line) => !isBoilerplateLine(line)))
    .slice(0, 4);
  return {
    ...base,
    vn_market: mergedVn.length > 0 ? mergedVn : buildMorningHighlights(normalizedBaseVn, 5),
    macro: mergedMacro.length > 0 ? mergedMacro : buildMorningHighlights(normalizedBaseMacro, 5),
    risk_opportunity: mergedRisk,
  };
}

function normalizeIndexName(raw: unknown): string {
  const source = String(raw ?? "").trim();
  const n = normalizeForCheck(source).replace(/[^a-z0-9]/g, "");
  if (n === "vnindex") return "VN-INDEX";
  if (n === "vn30") return "VN30";
  if (n === "hnxindex" || n === "hnx") return "HNX-INDEX";
  if (n === "upcomindex" || n === "upcom") return "UPCOM-INDEX";
  if (n === "dowjones" || n === "dow") return "DOW JONES";
  if (n === "dxy") return "DXY";
  if (n === "vang" || n === "gold") return "VÀNG";
  if (n === "dauwti" || n === "wti" || n === "oilwti") return "DẦU WTI";
  return source.toUpperCase();
}

function getSnapshot(raw: JsonRecord | null): JsonRecord {
  if (!raw) return {};
  const nested = pickRecord(raw, ["snapshot", "data", "payload"]);
  return nested ?? raw;
}

function normalizeSentenceList(content: string, fallback: string): string[] {
  const lines = content
    .split("\n")
    .map((line) => line.replace(/^[-*#>\s•]+/g, "").trim())
    .filter((line) => line.length >= 4)
    .slice(0, 12);
  if (lines.length === 0) return [fallback];
  return lines;
}

function parseIndexLine(content: string, ticker: "VN-INDEX" | "DOW JONES" | "DXY" | "VÀNG" | "DẦU WTI") {
  const escaped = ticker
    .replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")
    .replace("VÀNG", "(?:VÀNG|VANG|GOLD)")
    .replace("DẦU WTI", "(?:DẦU\\s*WTI|DAU\\s*WTI|WTI)")
    .replace("DOW JONES", "(?:DOW\\s*JONES|DOWJONES)");

  const rgx = new RegExp(`${escaped}[^\\d]{0,12}([\\d.,]+)(?:\\s*\\|\\s*([+-]?[\\d.,]+)%)?`, "i");
  const match = content.match(rgx);
  if (!match) return null;
  return {
    value: toNumberOrNull(match[1]),
    change_pct: toNumberOrNull(match[2]),
  };
}

function extractIndices(snapshot: JsonRecord, content: string): IndexRow[] {
  const direct = pickArray(snapshot, ["indices", "reference_indices", "referenceIndices"]);
  const rows = direct
    .map((item) => {
      if (!isRecord(item)) return null;
      const name = normalizeIndexName(item.ticker ?? item.name ?? item.symbol ?? "");
      if (!name) return null;
      return {
        name,
        value: toNumber(item.value ?? item.close ?? item.price),
        change_pct: toNumber(item.changePct ?? item.change_pct ?? item.percentChange),
      } satisfies IndexRow;
    })
    .filter((item): item is IndexRow => item !== null);

  const byName = new Map<string, IndexRow>();
  for (const row of rows) byName.set(row.name, row);

  const refs: Array<"VN-INDEX" | "DOW JONES" | "DXY" | "VÀNG" | "DẦU WTI"> = [
    "VN-INDEX",
    "DOW JONES",
    "DXY",
    "VÀNG",
    "DẦU WTI",
  ];
  for (const ref of refs) {
    if (byName.has(ref)) continue;
    const parsed = parseIndexLine(content, ref);
    if (!parsed?.value || parsed.value <= 0) continue;
    byName.set(ref, {
      name: ref,
      value: parsed.value,
      change_pct: parsed.change_pct ?? 0,
    });
  }

  if (!byName.has("VN-INDEX")) {
    const vn = rows.find((r) => normalizeForCheck(r.name).includes("vn"));
    if (vn) byName.set("VN-INDEX", { ...vn, name: "VN-INDEX" });
  }

  return Array.from(byName.values());
}

function parseBreadthFromString(raw: string) {
  const normalized = normalizeForCheck(raw);
  const upMatch = normalized.match(/(?:tang|up|↑)\s*(\d+)/);
  const downMatch = normalized.match(/(?:giam|down|↓)\s*(\d+)/);
  const unchMatch = normalized.match(/(?:khong doi|dung|unchanged|flat|→|=)\s*(\d+)/);
  if (upMatch || downMatch || unchMatch) {
    const up = upMatch ? Number.parseInt(upMatch[1], 10) : 0;
    const down = downMatch ? Number.parseInt(downMatch[1], 10) : 0;
    const unchanged = unchMatch ? Number.parseInt(unchMatch[1], 10) : 0;
    return { up, down, unchanged, total: up + down + unchanged };
  }

  const nums = raw.match(/\d+/g);
  if (nums && nums.length >= 3) {
    const up = Number.parseInt(nums[0], 10);
    const down = Number.parseInt(nums[1], 10);
    const unchanged = Number.parseInt(nums[2], 10);
    return { up, down, unchanged, total: up + down + unchanged };
  }
  return null;
}

function parseBreadth(raw: unknown, content: string): { up: number; down: number; unchanged: number; total: number } {
  if (isRecord(raw)) {
    const up = toNumber(raw.up);
    const down = toNumber(raw.down);
    const unchanged = toNumber(raw.unchanged);
    const total = toNumber(raw.total, up + down + unchanged);
    if (up + down + unchanged > 0) return { up, down, unchanged, total };
  }

  if (typeof raw === "string") {
    const parsed = parseBreadthFromString(raw);
    if (parsed) return parsed;
  }

  const line =
    content
      .split("\n")
      .map((x) => x.trim())
      .find((x) => normalizeForCheck(x).includes("do rong")) ?? "";
  const parsedFromContent = line ? parseBreadthFromString(line) : null;
  if (parsedFromContent) return parsedFromContent;

  return { up: 0, down: 0, unchanged: 0, total: 0 };
}

function parseLiquidityFromContent(content: string): number | null {
  const compact = content.replace(/\n/g, " ");
  const patterns = [
    /TK:\s*([\d.,]+)/i,
    /Thanh khoản[^0-9]{0,16}([\d.,]+)\s*tỷ/i,
    /Tổng:\s*([\d.,]+)\s*tỷ/i,
  ];
  for (const pattern of patterns) {
    const match = compact.match(pattern);
    if (!match) continue;
    const value = toNumberOrNull(match[1]);
    if (value !== null && value > 0) return value;
  }

  const plain = normalizeForCheck(compact).replace(/[^a-z0-9.,:\s|+-]/g, " ");
  const fallbackPatterns = [
    /tk[:\s]*([\d.,]+)/i,
    /thanh\s*kho[a-z0-9]*[^0-9]{0,24}([\d.,]+)/i,
    /tong[:]\s*([\d.,]+)\s*(?:ty|tyvnd|vnd)?/i,
  ];
  for (const pattern of fallbackPatterns) {
    const match = plain.match(pattern);
    if (!match) continue;
    const value = toNumberOrNull(match[1]);
    if (value !== null && value > 0) return value;
  }

  return null;
}

function pickContentLine(content: string, keyword: string): string {
  const lines = content
    .split("\n")
    .map((line) => line.replace(/^[-*#>\s•]+/g, "").trim())
    .filter(Boolean);
  const normalizedKeyword = normalizeForCheck(keyword);
  return (
    lines.find((line) => normalizeForCheck(line).includes(normalizedKeyword)) ?? ""
  );
}

function parseNetFromTextLine(line: string): number | null {
  if (!line) return null;
  const normalized = normalizeForCheck(line);
  const numberMatch = line.match(/([+-]?\d[\d.,]*)\s*tỷ/i);
  if (!numberMatch) return null;
  const value = toNumberOrNull(numberMatch[1]);
  if (value == null) return null;
  const direction = normalized.replace(/[^a-z\s]/g, " ");
  if (direction.includes("ban rong") || (direction.includes("ban") && direction.includes("rong"))) {
    return -Math.abs(value);
  }
  if (direction.includes("mua rong") || (direction.includes("mua") && direction.includes("rong"))) {
    return Math.abs(value);
  }
  return value;
}

function parseExchangeLiquidityFromContent(content: string): ExchangeLiquidity {
  const compact = normalizeForCheck(content.replace(/\n/g, " "));
  const read = (label: string): number | null => {
    const rx = new RegExp(`${label}[^\\d]{0,12}([\\d.,]+)`, "i");
    const match = compact.match(rx);
    if (!match) return null;
    return toNumberOrNull(match[1]);
  };

  return {
    HOSE: read("hose"),
    HNX: read("hnx"),
    UPCOM: read("upcom"),
  };
}

function hasFullExchangeLiquidity(exchanges: ExchangeLiquidity | undefined): boolean {
  if (!exchanges) return false;
  return ["HOSE", "HNX", "UPCOM"].every((exchange) => {
    const value = exchanges[exchange as keyof ExchangeLiquidity];
    return value != null && Number.isFinite(value) && value > 0;
  });
}

function sumExchangeLiquidity(exchanges: ExchangeLiquidity | undefined | null): number | null {
  if (!hasFullExchangeLiquidity(exchanges ?? undefined)) return null;
  const total = (exchanges!.HOSE ?? 0) + (exchanges!.HNX ?? 0) + (exchanges!.UPCOM ?? 0);
  return Number.isFinite(total) && total > 0 ? total : null;
}

type LiquidityBreakdown = {
  total: number | null;
  matched: number | null;
  negotiated: number | null;
};

function readFirstNumber(records: Array<JsonRecord | null | undefined>, keys: string[]): number | null {
  for (const record of records) {
    if (!record) continue;
    for (const key of keys) {
      const value = toNumberOrNull(record[key]);
      if (value != null && Number.isFinite(value) && value > 0) return value;
    }
  }
  return null;
}

function parseLiquidityNearLabel(content: string, labels: string[]): number | null {
  const compact = normalizeForCheck(content.replace(/\n/g, " "));
  for (const label of labels) {
    const index = compact.indexOf(label);
    if (index < 0) continue;
    const segment = compact.slice(index, index + 160);
    const match = segment.match(/([\d.,]+)\s*(?:ty|ti|tỷ)?/i);
    const value = match ? toNumberOrNull(match[1]) : null;
    if (value != null && value > 0) return value;
  }
  return null;
}

function extractLiquidityBreakdown(
  raw: JsonRecord | null,
  snapshot: JsonRecord,
  content: string,
  exchanges: ExchangeLiquidity | undefined,
): LiquidityBreakdown {
  const liquidityRoot = pickRecord(snapshot, ["liquidity", "marketLiquidity", "liquidityBreakdown", "liquidity_breakdown"]);
  const rawLiquidityRoot = raw
    ? pickRecord(raw, ["liquidity", "marketLiquidity", "liquidityBreakdown", "liquidity_breakdown"])
    : null;
  const eodRoot = raw ? pickRecord(raw, ["eodDetail", "eod_detail", "eod", "brief", "payload"]) : null;
  const records = [raw, snapshot, liquidityRoot, rawLiquidityRoot, eodRoot];
  const exchangeTotal = sumExchangeLiquidity(exchanges);

  const negotiated =
    readFirstNumber(records, [
      "negotiated_liquidity",
      "negotiatedLiquidity",
      "put_through_liquidity",
      "putThroughLiquidity",
      "agreement_liquidity",
      "agreementLiquidity",
      "dealValue",
      "deal_value",
      "totalDealValue",
      "TotalDealValue",
      "gtgdThoaThuan",
    ]) ??
    parseLiquidityNearLabel(content, ["gtgd thoa thuan", "thoa thuan", "giao dich thoa thuan"]);

  const matched =
    readFirstNumber(records, [
      "matched_liquidity",
      "matchedLiquidity",
      "match_liquidity",
      "matchLiquidity",
      "matchValue",
      "match_value",
      "totalMatchValue",
      "TotalMatchValue",
      "gtgdKhopLenh",
    ]) ??
    parseLiquidityNearLabel(content, ["gtgd khop lenh", "khop lenh", "gia tri khop lenh"]) ??
    exchangeTotal ??
    null;

  const totalCandidate =
    readFirstNumber(records, [
      "total_liquidity",
      "totalLiquidity",
      "total_market_liquidity",
      "totalMarketLiquidity",
      "totalTradingValue",
      "total_trading_value",
      "totalValue",
      "total_value",
      "all",
      "gtgd",
    ]) ??
    parseLiquidityNearLabel(content, ["thanh khoan toan thi truong", "tong gtgd", "tong gia tri giao dich"]);
  const totalLooksLikeMatchedOnly =
    totalCandidate != null &&
    negotiated == null &&
    exchangeTotal != null &&
    Math.abs(totalCandidate - exchangeTotal) / exchangeTotal < 0.02;
  const total =
    totalLooksLikeMatchedOnly
      ? null
      : totalCandidate ?? (matched != null && negotiated != null ? matched + negotiated : null);

  return { total, matched, negotiated };
}

function formatTy(value: number): string {
  return Math.round(value).toLocaleString("vi-VN");
}

function buildLiquidityDetail(
  totalLiquidityRaw: number,
  exchanges: ExchangeLiquidity,
  breakdown: LiquidityBreakdown = { total: null, matched: null, negotiated: null },
): string {
  const exchangeTotal = sumExchangeLiquidity(exchanges);
  const matched = breakdown.matched ?? exchangeTotal ?? totalLiquidityRaw;
  const negotiated = breakdown.negotiated ?? null;
  const total = breakdown.total ?? (matched > 0 && negotiated != null ? matched + negotiated : null);
  const displayValue = total ?? matched;
  if (!(displayValue > 0)) return "";
  const exchangeParts = [
    exchanges.HOSE != null && exchanges.HOSE > 0 ? `HoSE ${formatTy(exchanges.HOSE)}` : null,
    exchanges.HNX != null && exchanges.HNX > 0 ? `HNX ${formatTy(exchanges.HNX)}` : null,
    exchanges.UPCOM != null && exchanges.UPCOM > 0 ? `UPCoM ${formatTy(exchanges.UPCOM)}` : null,
  ].filter((item): item is string => Boolean(item));
  const exchangeSuffix = exchangeParts.length > 0 ? ` (${exchangeParts.join(" | ")})` : "";

  if (total != null && total > 0 && negotiated != null && negotiated > 0) {
    return `Thanh khoản toàn thị trường đạt ${formatTy(total)} tỷ đồng. GTGD khớp lệnh ${formatTy(
      matched,
    )} tỷ, thỏa thuận ${formatTy(negotiated)} tỷ${exchangeSuffix}.`;
  }
  if (total != null && total > 0 && total !== matched) {
    return `Thanh khoản toàn thị trường đạt ${formatTy(total)} tỷ đồng; GTGD khớp lệnh ${formatTy(matched)} tỷ${exchangeSuffix}.`;
  }
  return `GTGD khớp lệnh toàn thị trường đạt ${formatTy(matched)} tỷ đồng${exchangeSuffix}.`;
}

function hasImpossibleBreadthClaim(summary: string): boolean {
  const n = normalizeForCheck(summary);
  return (
    n.includes("khong co ma nao tang") ||
    n.includes("khong co ma nao giam") ||
    n.includes("khong co ma nao dung gia") ||
    n.includes("do rong thi truong hose khong ghi nhan")
  );
}

function buildDeterministicSessionSummary(payload: EodPayload): string {
  const direction =
    payload.change_pct > 0 ? "tang" : payload.change_pct < 0 ? "giam" : "di ngang";
  const breadthPart =
    payload.breadth.total > 0
      ? `Do rong: tang ${payload.breadth.up}, giam ${payload.breadth.down}, dung ${payload.breadth.unchanged}.`
      : "";
  return `VN-INDEX dong cua ${payload.vnindex.toFixed(2)} diem (${payload.change_pct >= 0 ? "+" : ""}${payload.change_pct.toFixed(
    2,
  )}%), thi truong ${direction}. Thanh khoan ${Math.round(payload.liquidity).toLocaleString("vi-VN")} ty. ${breadthPart}`.trim();
}

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === "string") return item;
      if (!isRecord(item)) return "";
      const ticker = String(item.ticker ?? item.symbol ?? item.code ?? "").trim().toUpperCase();
      const value =
        toNumberOrNull(item.value) ??
        toNumberOrNull(item.netValue) ??
        toNumberOrNull(item.net_bn) ??
        toNumberOrNull(item.value_bn) ??
        toNumberOrNull(item.amount);
      if (!ticker) return "";
      return value != null && value > 0 ? `${ticker} (${formatTy(value)} tỷ)` : ticker;
    })
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

function pickStringArray(records: Array<JsonRecord | null | undefined>, keys: string[]): string[] {
  for (const record of records) {
    if (!record) continue;
    for (const key of keys) {
      const value = parseStringArray(record[key]);
      if (value.length > 0) return value;
    }
  }
  return [];
}

function sanitizeFlowList(items: string[]): string[] {
  const output: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const cleaned = sanitizeNarrativeLine(item);
    if (!cleaned) continue;
    const firstToken = cleaned.split(/[:：\-–—(|]/)[0]?.trim() ?? "";
    const compactToken = firstToken.replace(/[^A-Za-z0-9]/g, "");
    if (compactToken && /^0+$/.test(compactToken)) continue;
    if (/^0{3,}\b/.test(cleaned)) continue;
    if (!/[A-Za-zÀ-ỹ]/u.test(cleaned) && /^[\d.,:+\-|/()%\s]+$/.test(cleaned)) continue;
    const key = normalizeForCheck(cleaned);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(cleaned);
  }
  return output;
}

function hasDetailedFlowLists(payload: EodPayload): boolean {
  return [
    payload.foreign_top_buy,
    payload.foreign_top_sell,
    payload.prop_trading_top_buy,
    payload.prop_trading_top_sell,
    payload.individual_top_buy,
    payload.individual_top_sell,
    payload.sector_gainers,
    payload.sector_losers,
    payload.buy_signals,
    payload.sell_signals,
    payload.top_breakout,
    payload.top_new_high,
  ].some((list) => sanitizeFlowList(list).length > 0);
}

function isInvalidEodOutlook(text: string): boolean {
  const cleaned = sanitizeNarrativeLine(text);
  if (!cleaned) return true;
  const n = normalizeForCheck(cleaned);
  const compact = n.replace(/[^a-z0-9]/g, "");
  if (/^(vn-?index|vni|vn30|hnx-?index|upcom-?index)\s*[:：]/i.test(cleaned) && cleaned.length < 120) {
    return true;
  }
  if (/^(thanh\s*kho|do\s*rong|d[oòóọỏõôộ]\s*r[oộ]ng|dong\s*tien|d[oòóọỏõ]\s*ng\s*ti[eề]n|chi\s*so|ch[iỉ]\s*s[oố]|nhan\s*dinh|nh[aậ]n\s*d[iị]nh|adn\s*capital)/i.test(cleaned)) {
    return true;
  }
  if (cleaned.length < 80) {
    return true;
  }
  if (
    compact === "chisochinh" ||
    compact === "bangdongtienchitiet" ||
    compact === "adncapitalflashnote" ||
    compact === "nhanđinhphiento" ||
    compact === "nhandinhphiento"
  ) {
    return true;
  }
  return (
    n.includes("ban tin tong hop") ||
    n.includes("end-of-day") ||
    n.includes("chi so chinh") ||
    n.includes("bang dong tien chi tiet") ||
    n.includes("adn capital flashnote")
  );
}

function buildDeterministicEodOutlook(payload: EodPayload): string {
  const direction =
    payload.change_pct > 0 ? "tích cực" : payload.change_pct < 0 ? "thận trọng" : "trung tính";
  const breadth =
    payload.breadth.total > 0
      ? `Độ rộng ghi nhận ${payload.breadth.up} mã tăng, ${payload.breadth.down} mã giảm và ${payload.breadth.unchanged} mã đứng giá.`
      : "";
  const liquidity =
    payload.liquidity > 0
      ? `Thanh khoản đạt ${Math.round(payload.liquidity).toLocaleString("vi-VN")} tỷ đồng.`
      : "";
  const foreign = payload.foreign_flow && !isUnavailableText(payload.foreign_flow) ? ` ${payload.foreign_flow}` : "";
  const action =
    payload.change_pct < 0
      ? "Phiên tới ưu tiên kiểm soát tỷ trọng, quan sát phản ứng tại vùng hỗ trợ gần và chỉ tăng mua khi lực cầu cải thiện rõ."
      : payload.change_pct > 0
        ? "Phiên tới có thể tiếp tục quan sát nhóm giữ nền tốt, nhưng tránh mua đuổi khi thanh khoản chưa xác nhận bền vững."
        : "Phiên tới ưu tiên theo dõi nhóm có dòng tiền riêng, hạn chế giải ngân mạnh khi xu hướng chung chưa rõ ràng.";

  return [`Nhận định phiên tới ở trạng thái ${direction}.`, liquidity, breadth, foreign, action]
    .filter(Boolean)
    .join(" ");
}

function parseSubIndices(raw: unknown): Array<{ name: string; change_pts: number; change_pct: number }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!isRecord(item)) return null;
      const name = String(item.name ?? item.ticker ?? item.symbol ?? "").trim();
      if (!name) return null;
      return {
        name,
        change_pts: toNumber(item.change_pts ?? item.changePts ?? item.change ?? 0),
        change_pct: toNumber(item.change_pct ?? item.changePct ?? item.percentChange ?? 0),
      };
    })
    .filter((x): x is { name: string; change_pts: number; change_pct: number } => x !== null);
}

async function getRecentReports(types: string[], take = 60) {
  return prisma.marketReport.findMany({
    where: { type: { in: types } },
    orderBy: { createdAt: "desc" },
    take,
  });
}

function reportDateFromCreatedAt(createdAt: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(createdAt);
}

function getReportDateKey(report: ReportRow): string {
  const raw = parseJsonMaybe(report.rawData);
  const snapshot = getSnapshot(raw);
  const dateFromSnapshot = typeof snapshot.requestDateVN === "string" ? snapshot.requestDateVN : null;
  if (dateFromSnapshot && /^\d{4}-\d{2}-\d{2}$/.test(dateFromSnapshot)) return dateFromSnapshot;
  return reportDateFromCreatedAt(report.createdAt);
}

function isWeekdayDateKey(dateKey: string): boolean {
  const d = new Date(`${dateKey}T00:00:00+07:00`);
  if (Number.isNaN(d.getTime())) return false;
  const day = d.getUTCDay();
  return day >= 1 && day <= 5;
}

function pickPreferredReportDateKey(reports: ReportRow[]): string | null {
  return reports[0] ? getReportDateKey(reports[0]) : null;
}

function isMeaningfulLine(text: string): boolean {
  const cleaned = sanitizeNewsLine(text);
  return cleaned.trim().length > 0 && !isUnavailableText(cleaned) && !isBoilerplateLine(cleaned);
}

function firstMeaningfulList(lists: string[][]): string[] {
  for (const list of lists) {
    const filtered = list.filter(isMeaningfulLine);
    if (filtered.length > 0) return filtered;
  }
  return [];
}

function ensureMorningRiskOpportunity(
  items: string[],
  indices: Array<{ name: string; value: number | null; change_pct: number | null }>,
): string[] {
  const cleaned = dedupeKeepOrder(items.filter(isMeaningfulLine));
  const normalized = cleaned.map((line) => normalizeForCheck(line));
  const hasRisk = normalized.some(
    (line) =>
      line.startsWith("rui ro") ||
      line.startsWith("ap luc") ||
      line.startsWith("canh bao") ||
      line.startsWith("than trong"),
  );
  const hasOpportunity = normalized.some((line) => line.includes("co hoi") || line.includes("tich cuc"));
  const vnindex = indices.find((item) => normalizeIndexKey(item.name) === "vnindex");
  const fallback: string[] = [];

  if (!hasRisk) {
    const value = typeof vnindex?.value === "number" && vnindex.value > 0 ? vnindex.value.toLocaleString("vi-VN", { maximumFractionDigits: 2 }) : "vùng hiện tại";
    const change = typeof vnindex?.change_pct === "number" ? `${vnindex.change_pct >= 0 ? "+" : ""}${vnindex.change_pct.toFixed(2)}%` : "chưa rõ biên độ";
    fallback.push(
      `Rủi ro: VN-INDEX đang ở ${value} (${change}); cần kiểm soát tỷ trọng nếu áp lực bán lan rộng hoặc thanh khoản suy yếu.`,
    );
  }

  if (!hasOpportunity) {
    fallback.push(
      "Cơ hội: Ưu tiên theo dõi nhóm cổ phiếu giữ nền giá tốt, dòng tiền cải thiện và có câu chuyện kết quả kinh doanh rõ ràng.",
    );
  }

  return dedupeKeepOrder([...cleaned, ...fallback]).filter(isMeaningfulLine).slice(0, 4);
}

function normalizeIndexKey(name: string): string {
  return normalizeForCheck(name).replace(/[^a-z0-9]/g, "");
}

function toMorningPayload(report: { createdAt: Date; content: string; rawData: string | null }): MorningPayload {
  const normalizedContent = repairMojibake(report.content);
  const raw = parseJsonMaybe(report.rawData);
  const snapshot = getSnapshot(raw);
  const indices = extractIndices(snapshot, normalizedContent);
  const reportDateKey = getReportDateKey(report);
  const parsed = parseMorningSections(normalizedContent);
  const lines = normalizeSentenceList(
    normalizedContent,
    "Bản tin sáng đã được tạo. Hệ thống đang đồng bộ thêm dữ liệu thị trường.",
  );

  const cleanedLines = dedupeKeepOrder(
    lines
      .map(sanitizeNewsLine)
      .filter((line) => line.length >= 12 && !isSectionHeaderLine(line) && !isUnavailableText(line) && !isGenericCategoryLine(line)),
  );
  const fallbackNewsLines = dedupeKeepOrder(cleanedLines.filter(isLikelyNewsLine));
  const fallbackVn = fallbackNewsLines.filter(isVietnamMarketHeadline);
  const fallbackMacro = fallbackNewsLines.filter(isMacroHeadline);
  const fallbackRisk = dedupeKeepOrder(
    cleanedLines.filter((line) => {
      const n = normalizeForCheck(line);
      return (
        n.includes("rui ro") ||
        n.includes("co hoi") ||
        n.includes("ap luc") ||
        n.includes("than trong") ||
        n.includes("luu y")
      );
    }),
  );
  const vnMarket = dedupeKeepOrder([
    ...parsed.vnMarket,
    ...fallbackVn,
    ...fallbackNewsLines,
  ]).slice(0, 5);
  const macro = dedupeKeepOrder([
    ...parsed.macro,
    ...fallbackMacro,
    ...fallbackNewsLines.filter((line) => !isVietnamMarketHeadline(line)),
  ]).slice(0, 5);
  const riskOpportunity = ensureMorningRiskOpportunity(dedupeKeepOrder([
    ...parsed.riskOpportunity,
    ...fallbackRisk,
  ]), indices);

  return {
    date: toViDateFromDateKey(reportDateKey),
    reference_indices: indices,
    vn_market: buildMorningHighlights(vnMarket, 5),
    macro: buildMorningHighlights(macro, 5),
    risk_opportunity: riskOpportunity,
  };
}

function toEodPayload(report: { createdAt: Date; content: string; rawData: string | null }): EodPayload {
  const normalizedContent = repairMojibake(report.content);
  const raw = parseJsonMaybe(report.rawData);
  const snapshot = getSnapshot(raw);
  const indices = extractIndices(snapshot, normalizedContent);
  const reportDateKey = getReportDateKey(report);
  const vnindex = indices.find((item) => item.name === "VN-INDEX");

  const breadth = parseBreadth(snapshot.breadth ?? snapshot.market_breadth, normalizedContent);
  const liquidityByExchangeRaw = pickRecord(snapshot, ["liquidityByExchange", "liquidity_by_exchange"]) ?? {};
  const exchangeFromContent = parseExchangeLiquidityFromContent(normalizedContent);
  const exchangeLiquidity = normalizeExchangeLiquidity({
    HOSE:
      toNumberOrNull((raw ?? {})["hose_val"]) ??
      toNumberOrNull(liquidityByExchangeRaw.HOSE) ??
      exchangeFromContent.HOSE,
    HNX:
      toNumberOrNull((raw ?? {})["hnx_val"]) ??
      toNumberOrNull(liquidityByExchangeRaw.HNX) ??
      exchangeFromContent.HNX,
    UPCOM:
      toNumberOrNull((raw ?? {})["upcom_val"]) ??
      toNumberOrNull(liquidityByExchangeRaw.UPCOM) ??
      exchangeFromContent.UPCOM,
  });
  const liquidityByExchange = {
    HOSE: exchangeLiquidity.HOSE,
    HNX: exchangeLiquidity.HNX,
    UPCOM: exchangeLiquidity.UPCOM,
    total: toNumberOrNull(liquidityByExchangeRaw.total),
  };
  const inferredTotalFromExchanges = sumExchangeLiquidity(exchangeLiquidity);
  const liquidityBreakdown = extractLiquidityBreakdown(raw, snapshot, normalizedContent, exchangeLiquidity);
  const matchedLiquidity =
    liquidityBreakdown.matched ??
    inferredTotalFromExchanges ??
    toNumberOrNull(snapshot.matchedLiquidity) ??
    toNumberOrNull(snapshot.liquidity) ??
    parseLiquidityFromContent(normalizedContent) ??
    0;
  const totalLiquidityRaw =
    liquidityBreakdown.total ??
    liquidityByExchange.total ??
    (liquidityBreakdown.negotiated != null && matchedLiquidity > 0
      ? matchedLiquidity + liquidityBreakdown.negotiated
      : null) ??
    matchedLiquidity ??
    0;

  const investorRoot =
    pickRecord(snapshot, ["investorTrading", "investor_trading"]) ??
    pickRecord(raw ?? {}, ["investorTrading", "investor_trading"]) ??
    {};
  const foreign = pickRecord(investorRoot, ["foreign"]) ?? {};
  const proprietary = pickRecord(investorRoot, ["proprietary"]) ?? {};
  const retail = pickRecord(investorRoot, ["retail"]) ?? {};

  const foreignLineFromContent = pickContentLine(normalizedContent, "khối ngoại");
  const propLineFromContent = pickContentLine(normalizedContent, "tự doanh");
  const retailLineFromContent = pickContentLine(normalizedContent, "cá nhân");

  const foreignNet =
    toNumberOrNull(foreign.net) ??
    toNumberOrNull(investorRoot.foreignNet) ??
    parseNetFromTextLine(foreignLineFromContent) ??
    null;
  const proprietaryNet =
    toNumberOrNull(proprietary.net) ??
    toNumberOrNull(investorRoot.proprietaryNet) ??
    parseNetFromTextLine(propLineFromContent) ??
    null;
  const retailNet =
    toNumberOrNull(retail.net) ??
    toNumberOrNull(investorRoot.retailNet) ??
    parseNetFromTextLine(retailLineFromContent) ??
    null;

  const lines = normalizeSentenceList(
    normalizedContent,
    "Bản tin kết phiên đã được tạo. Hệ thống đang đồng bộ thêm dữ liệu hiển thị.",
  );
  const eodDetail = raw ? pickRecord(raw, ["eodDetail", "eod_detail", "eod", "brief", "payload"]) : null;
  const propDataRecord = raw ? pickRecord(raw, ["propData", "prop_data", "proprietaryTrading"]) : null;
  const arrayRecords = [raw, eodDetail, snapshot, propDataRecord];

  const sentimentLine =
    lines.find((line) => normalizeForCheck(line).includes("nhan dinh") && !isInvalidEodOutlook(line)) ??
    lines.find((line) => normalizeForCheck(line).includes("smart money")) ??
    lines.find((line) => !isInvalidEodOutlook(line) && !isSectionHeaderLine(line)) ??
    "";

  const payload: EodPayload = {
    date: toViDateFromDateKey(reportDateKey),
    vnindex: toNumber(vnindex?.value),
    change_pct: toNumber(vnindex?.change_pct),
    liquidity: Math.max(totalLiquidityRaw, 0),
    total_liquidity: liquidityBreakdown.total,
    matched_liquidity: matchedLiquidity > 0 ? matchedLiquidity : null,
    negotiated_liquidity: liquidityBreakdown.negotiated,
    liquidity_by_exchange: exchangeLiquidity,
    breadth,
    session_summary: lines[0] && !hasImpossibleBreadthClaim(lines[0]) ? lines[0] : "",
    liquidity_detail:
      totalLiquidityRaw > 0
        ? buildLiquidityDetail(totalLiquidityRaw, exchangeLiquidity, {
            total: liquidityBreakdown.total,
            matched: matchedLiquidity > 0 ? matchedLiquidity : null,
            negotiated: liquidityBreakdown.negotiated,
          })
        : "",
    foreign_flow:
      foreignNet != null
        ? `Khối ngoại ${foreignNet >= 0 ? "mua ròng" : "bán ròng"} ${Math.abs(foreignNet).toFixed(1)} tỷ.`
        : (foreignLineFromContent || ""),
    notable_trades:
      proprietaryNet != null || retailNet != null
        ? [
            proprietaryNet != null ? `Tự doanh: ${proprietaryNet >= 0 ? "+" : ""}${proprietaryNet.toFixed(1)} tỷ` : null,
            retailNet != null ? `Cá nhân: ${retailNet >= 0 ? "+" : ""}${retailNet.toFixed(1)} tỷ` : null,
          ]
            .filter((line): line is string => Boolean(line))
            .join(" | ")
        : [propLineFromContent, retailLineFromContent].filter(Boolean).join(" | "),
    outlook: sentimentLine,
    sub_indices: parseSubIndices(raw?.sub_indices),
    foreign_top_buy: sanitizeFlowList(pickStringArray(arrayRecords, ["foreign_top_buy", "foreignTopBuy"])),
    foreign_top_sell: sanitizeFlowList(pickStringArray(arrayRecords, ["foreign_top_sell", "foreignTopSell"])),
    prop_trading_top_buy: sanitizeFlowList(pickStringArray(arrayRecords, ["prop_trading_top_buy", "propTradingTopBuy", "topBuy", "top_buy"])),
    prop_trading_top_sell: sanitizeFlowList(pickStringArray(arrayRecords, ["prop_trading_top_sell", "propTradingTopSell", "topSell", "top_sell"])),
    individual_top_buy: sanitizeFlowList(pickStringArray(arrayRecords, ["individual_top_buy", "individualTopBuy"])),
    individual_top_sell: sanitizeFlowList(pickStringArray(arrayRecords, ["individual_top_sell", "individualTopSell"])),
    sector_gainers: sanitizeFlowList(pickStringArray(arrayRecords, ["sector_gainers", "sectorGainers"])),
    sector_losers: sanitizeFlowList(pickStringArray(arrayRecords, ["sector_losers", "sectorLosers"])),
    buy_signals: sanitizeFlowList(pickStringArray(arrayRecords, ["buy_signals", "buySignals"])),
    sell_signals: sanitizeFlowList(pickStringArray(arrayRecords, ["sell_signals", "sellSignals"])),
    top_breakout: sanitizeFlowList(pickStringArray(arrayRecords, ["top_breakout", "topBreakout"])),
    top_new_high: sanitizeFlowList(pickStringArray(arrayRecords, ["top_new_high", "topNewHigh", "new_highs", "newHighs"])),
  };
  if (isInvalidEodOutlook(payload.outlook)) {
    payload.outlook = buildDeterministicEodOutlook(payload);
  }
  return payload;
}

function morningPayloadScore(payload: MorningPayload): number {
  const validRefs = payload.reference_indices.filter(
    (item) => typeof item.value === "number" && item.value > 0,
  ).length;
  let score = validRefs * 20;
  if (payload.vn_market.some(isMeaningfulLine)) score += 20;
  if (payload.macro.some(isMeaningfulLine)) score += 20;
  if (payload.risk_opportunity.some(isMeaningfulLine)) score += 20;
  return score;
}

function backfillMorningPayload(base: MorningPayload, history: MorningPayload[]): MorningPayload {
  const fallbackByIndex = new Map<string, { name: string; value: number | null; change_pct: number | null }>();
  for (const payload of history) {
    for (const item of payload.reference_indices) {
      if (typeof item.value !== "number" || item.value <= 0) continue;
      const key = normalizeIndexKey(item.name);
      if (!fallbackByIndex.has(key)) {
        fallbackByIndex.set(key, {
          name: item.name,
          value: item.value,
          change_pct: item.change_pct,
        });
      }
    }
  }

  const referenceIndices = base.reference_indices.map((item) => {
    if (typeof item.value === "number" && item.value > 0) return item;
    const fallback = fallbackByIndex.get(normalizeIndexKey(item.name));
    if (!fallback) return item;
    return {
      name: item.name || fallback.name,
      value: fallback.value,
      change_pct: fallback.change_pct,
    };
  });

  const preferredIndexNames = ["VN-INDEX", "DOW JONES", "DXY", "VÃ€NG", "Dáº¦U WTI", "VÀNG", "DẦU WTI"];
  for (const preferredName of preferredIndexNames) {
    const exists = referenceIndices.some(
      (item) => normalizeIndexKey(item.name) === normalizeIndexKey(preferredName),
    );
    if (exists) continue;
    const fallback = fallbackByIndex.get(normalizeIndexKey(preferredName));
    if (!fallback) continue;
    referenceIndices.push({
      name: preferredName,
      value: fallback.value,
      change_pct: fallback.change_pct,
    });
  }

  return {
    ...base,
    reference_indices: referenceIndices,
    vn_market:
      base.vn_market.filter(isMeaningfulLine).length > 0
        ? base.vn_market.filter(isMeaningfulLine)
        : firstMeaningfulList(history.map((payload) => payload.vn_market)),
    macro:
      base.macro.filter(isMeaningfulLine).length > 0
        ? base.macro.filter(isMeaningfulLine)
        : firstMeaningfulList(history.map((payload) => payload.macro)),
    risk_opportunity:
      base.risk_opportunity.filter(isMeaningfulLine).length > 0
        ? base.risk_opportunity.filter(isMeaningfulLine)
        : firstMeaningfulList(history.map((payload) => payload.risk_opportunity)),
  };
}

function backfillEodPayload(base: EodPayload, history: EodPayload[]): EodPayload {
  const pickNumberField = (getter: (payload: EodPayload) => number): number | null => {
    for (const payload of history) {
      const value = getter(payload);
      if (Number.isFinite(value) && value > 0) return value;
    }
    return null;
  };

  const pickTextField = (getter: (payload: EodPayload) => string): string => {
    for (const payload of history) {
      const value = getter(payload);
      if (value && !isUnavailableText(value)) return value;
    }
    return "";
  };

  const pickArrayField = (getter: (payload: EodPayload) => string[]): string[] => {
    for (const payload of history) {
      const value = getter(payload);
      if (value.length > 0) return value;
    }
    return [];
  };

  const result: EodPayload = { ...base };

  if (!(Number.isFinite(result.vnindex) && result.vnindex > 0)) {
    result.vnindex = pickNumberField((payload) => payload.vnindex) ?? result.vnindex;
  }
  if (!(Number.isFinite(result.liquidity) && result.liquidity > 0)) {
    result.liquidity = pickNumberField((payload) => payload.liquidity) ?? result.liquidity;
  }
  if (!(Number.isFinite(result.total_liquidity) && (result.total_liquidity ?? 0) > 0)) {
    result.total_liquidity = pickNumberField((payload) => payload.total_liquidity ?? 0) ?? result.total_liquidity ?? null;
  }
  if (!(Number.isFinite(result.matched_liquidity) && (result.matched_liquidity ?? 0) > 0)) {
    result.matched_liquidity = pickNumberField((payload) => payload.matched_liquidity ?? 0) ?? result.matched_liquidity ?? null;
  }
  if (!(Number.isFinite(result.negotiated_liquidity) && (result.negotiated_liquidity ?? 0) > 0)) {
    result.negotiated_liquidity =
      pickNumberField((payload) => payload.negotiated_liquidity ?? 0) ?? result.negotiated_liquidity ?? null;
  }
  if (!result.liquidity_by_exchange) {
    const source = history.find((payload) => payload.liquidity_by_exchange != null);
    if (source?.liquidity_by_exchange) {
      result.liquidity_by_exchange = source.liquidity_by_exchange;
    }
  }
  if (!hasFullExchangeLiquidity(result.liquidity_by_exchange)) {
    const source = history.find((payload) => hasFullExchangeLiquidity(payload.liquidity_by_exchange));
    if (source?.liquidity_by_exchange) {
      result.liquidity_by_exchange = source.liquidity_by_exchange;
    }
  }
  if (!(result.breadth.total > 0)) {
    const source = history.find((payload) => payload.breadth.total > 0);
    if (source) result.breadth = source.breadth;
  }

  if (!result.session_summary || isUnavailableText(result.session_summary)) {
    result.session_summary = pickTextField((payload) => payload.session_summary);
  }
  if (
    result.session_summary &&
    result.breadth.total > 0 &&
    hasImpossibleBreadthClaim(result.session_summary)
  ) {
    result.session_summary = buildDeterministicSessionSummary(result);
  }
  if (!result.liquidity_detail || isUnavailableText(result.liquidity_detail)) {
    result.liquidity_detail = pickTextField((payload) => payload.liquidity_detail);
  }
  if (!result.foreign_flow || isUnavailableText(result.foreign_flow)) {
    result.foreign_flow = pickTextField((payload) => payload.foreign_flow);
  }
  if (!result.notable_trades || isUnavailableText(result.notable_trades)) {
    result.notable_trades = pickTextField((payload) => payload.notable_trades);
  }
  if (!result.outlook || isUnavailableText(result.outlook) || isInvalidEodOutlook(result.outlook)) {
    result.outlook =
      history
        .map((payload) => sanitizeNarrativeLine(payload.outlook))
        .find((value) => value && !isUnavailableText(value) && !isInvalidEodOutlook(value)) ??
      "";
  }

  if (result.sub_indices.length === 0) {
    const source = history.find((payload) => payload.sub_indices.length > 0);
    if (source) result.sub_indices = source.sub_indices;
  }

  if (result.foreign_top_buy.length === 0) result.foreign_top_buy = pickArrayField((payload) => payload.foreign_top_buy);
  if (result.foreign_top_sell.length === 0)
    result.foreign_top_sell = pickArrayField((payload) => payload.foreign_top_sell);
  if (result.prop_trading_top_buy.length === 0)
    result.prop_trading_top_buy = pickArrayField((payload) => payload.prop_trading_top_buy);
  if (result.prop_trading_top_sell.length === 0)
    result.prop_trading_top_sell = pickArrayField((payload) => payload.prop_trading_top_sell);
  if (result.individual_top_buy.length === 0)
    result.individual_top_buy = pickArrayField((payload) => payload.individual_top_buy);
  if (result.individual_top_sell.length === 0)
    result.individual_top_sell = pickArrayField((payload) => payload.individual_top_sell);
  if (result.sector_gainers.length === 0) result.sector_gainers = pickArrayField((payload) => payload.sector_gainers);
  if (result.sector_losers.length === 0) result.sector_losers = pickArrayField((payload) => payload.sector_losers);
  if (result.buy_signals.length === 0) result.buy_signals = pickArrayField((payload) => payload.buy_signals);
  if (result.sell_signals.length === 0) result.sell_signals = pickArrayField((payload) => payload.sell_signals);
  if (result.top_breakout.length === 0) result.top_breakout = pickArrayField((payload) => payload.top_breakout);
  if (result.top_new_high.length === 0) result.top_new_high = pickArrayField((payload) => payload.top_new_high);

  result.foreign_top_buy = sanitizeFlowList(result.foreign_top_buy);
  result.foreign_top_sell = sanitizeFlowList(result.foreign_top_sell);
  result.prop_trading_top_buy = sanitizeFlowList(result.prop_trading_top_buy);
  result.prop_trading_top_sell = sanitizeFlowList(result.prop_trading_top_sell);
  result.individual_top_buy = sanitizeFlowList(result.individual_top_buy);
  result.individual_top_sell = sanitizeFlowList(result.individual_top_sell);
  result.sector_gainers = sanitizeFlowList(result.sector_gainers);
  result.sector_losers = sanitizeFlowList(result.sector_losers);
  result.buy_signals = sanitizeFlowList(result.buy_signals);
  result.sell_signals = sanitizeFlowList(result.sell_signals);
  result.top_breakout = sanitizeFlowList(result.top_breakout);
  result.top_new_high = sanitizeFlowList(result.top_new_high);

  const exchangeLiquidityTotal = sumExchangeLiquidity(result.liquidity_by_exchange);
  if (exchangeLiquidityTotal != null && !(Number.isFinite(result.matched_liquidity) && (result.matched_liquidity ?? 0) > 0)) {
    result.matched_liquidity = exchangeLiquidityTotal;
  }
  if (
    !(Number.isFinite(result.total_liquidity) && (result.total_liquidity ?? 0) > 0) &&
    (result.matched_liquidity ?? 0) > 0 &&
    (result.negotiated_liquidity ?? 0) > 0
  ) {
    result.total_liquidity = (result.matched_liquidity ?? 0) + (result.negotiated_liquidity ?? 0);
  }
  result.liquidity = result.total_liquidity ?? result.matched_liquidity ?? result.liquidity;

  if (result.liquidity > 0 && result.liquidity_by_exchange) {
    result.liquidity_detail = buildLiquidityDetail(result.liquidity, result.liquidity_by_exchange, {
      total: result.total_liquidity ?? null,
      matched: result.matched_liquidity ?? null,
      negotiated: result.negotiated_liquidity ?? null,
    });
  }
  if (result.liquidity > 0 && (!result.liquidity_detail || isUnavailableText(result.liquidity_detail))) {
    result.liquidity_detail =
      result.total_liquidity != null && result.total_liquidity > 0
        ? `Thanh khoản toàn thị trường đạt ${Math.round(result.total_liquidity).toLocaleString("vi-VN")} tỷ đồng.`
        : `GTGD khớp lệnh toàn thị trường đạt ${Math.round(result.liquidity).toLocaleString("vi-VN")} tỷ đồng.`;
  }

  if (!result.session_summary || isUnavailableText(result.session_summary)) {
    result.session_summary = buildDeterministicSessionSummary(result);
  }
  if (!result.outlook || isUnavailableText(result.outlook) || isInvalidEodOutlook(result.outlook)) {
    result.outlook = buildDeterministicEodOutlook(result);
  }
  return result;
}

function hasValidMorningPayload(payload: MorningPayload): boolean {
  const validRefs = payload.reference_indices.filter(
    (item) => typeof item.value === "number" && item.value > 0,
  ).length;
  const hasVni = payload.reference_indices.some(
    (item) =>
      normalizeIndexKey(item.name) === normalizeIndexKey("VN-INDEX") &&
      typeof item.value === "number" &&
      item.value > 0,
  );
  const hasAnyContent =
    payload.vn_market.some(isMeaningfulLine) ||
    payload.macro.some(isMeaningfulLine) ||
    payload.risk_opportunity.some(isMeaningfulLine);
  return validRefs >= 2 || (hasVni && hasAnyContent);
}

function hasValidEodPayload(payload: EodPayload): boolean {
  const hasVni = Number.isFinite(payload.vnindex) && payload.vnindex > 0;
  const hasBreadth = payload.breadth.total > 0;
  const hasLiquidity = Number.isFinite(payload.liquidity) && payload.liquidity > 0;
  const hasExchangeLiquidity = hasFullExchangeLiquidity(payload.liquidity_by_exchange);
  const hasSummary = payload.session_summary.length > 0 && !isUnavailableText(payload.session_summary);
  return hasVni && hasLiquidity && hasExchangeLiquidity && hasBreadth && hasSummary;
}

function shouldUseBridgeEod(payload: EodPayload): boolean {
  const lowLiquidity = !Number.isFinite(payload.liquidity) || payload.liquidity <= 0 || payload.liquidity < 1_000;
  const weakBreadth = !payload.breadth || payload.breadth.total <= 0;
  const missingExchangeLiquidity = !hasFullExchangeLiquidity(payload.liquidity_by_exchange);
  const missingFlows = isUnavailableText(payload.foreign_flow) && isUnavailableText(payload.notable_trades);
  const missingDetailedFlows = !hasDetailedFlowLists(payload);
  const badOutlook = isInvalidEodOutlook(payload.outlook);
  return (
    lowLiquidity ||
    weakBreadth ||
    missingExchangeLiquidity ||
    missingFlows ||
    missingDetailedFlows ||
    badOutlook ||
    !hasValidEodPayload(payload)
  );
}

function eodPayloadScore(payload: EodPayload): number {
  let score = 0;
  if (Number.isFinite(payload.vnindex) && payload.vnindex > 0) score += 20;
  if (Number.isFinite(payload.liquidity) && payload.liquidity > 0) score += 40;
  if (hasFullExchangeLiquidity(payload.liquidity_by_exchange)) score += 30;
  if (payload.breadth.total > 0) score += 20;
  if (payload.foreign_flow.length > 0 && !isUnavailableText(payload.foreign_flow)) score += 10;
  if (payload.notable_trades.length > 0 && !isUnavailableText(payload.notable_trades)) score += 10;
  if (hasDetailedFlowLists(payload)) score += 20;
  if (payload.outlook.length > 0 && !isInvalidEodOutlook(payload.outlook)) score += 10;
  return score;
}

function hasDisplayableMorningPayload(payload: MorningPayload): boolean {
  const hasAnyIndex = payload.reference_indices.some(
    (item) => typeof item.value === "number" && item.value > 0,
  );
  const hasAnyContent =
    payload.vn_market.some(isMeaningfulLine) ||
    payload.macro.some(isMeaningfulLine) ||
    payload.risk_opportunity.some(isMeaningfulLine);
  return hasAnyIndex || hasAnyContent;
}

function hasDisplayableEodPayload(payload: EodPayload): boolean {
  const hasMarketNumber =
    (Number.isFinite(payload.vnindex) && payload.vnindex > 0) ||
    (Number.isFinite(payload.liquidity) && payload.liquidity > 0) ||
    payload.breadth.total > 0;
  const hasNarrative =
    [payload.session_summary, payload.liquidity_detail, payload.foreign_flow, payload.notable_trades, payload.outlook]
      .some((line) => line.length > 0 && !isUnavailableText(line));
  const hasLists = [
    payload.foreign_top_buy,
    payload.foreign_top_sell,
    payload.prop_trading_top_buy,
    payload.prop_trading_top_sell,
    payload.individual_top_buy,
    payload.individual_top_sell,
    payload.sector_gainers,
    payload.sector_losers,
    payload.buy_signals,
    payload.sell_signals,
    payload.top_breakout,
    payload.top_new_high,
  ].some((list) => sanitizeFlowList(list).length > 0);
  return hasMarketNumber || hasNarrative || hasLists;
}

async function buildLiveEodFallbackPayload(): Promise<EodPayload | null> {
  try {
    const candidates: EodPayload[] = [];
    const marketRes = await fetch("http://127.0.0.1:3000/api/market", {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    if (marketRes?.ok) {
      const marketData = (await marketRes.json()) as JsonRecord;
      const vn = isRecord(marketData.vnindex) ? marketData.vnindex : {};
      const updown = isRecord(marketData.updown) ? marketData.updown : {};
      const liquidity = toNumberOrNull(marketData.totalVolume) ?? 0;
      const vnValue = toNumberOrNull(vn.value) ?? 0;
      const vnChange = toNumberOrNull(vn.changePercent) ?? 0;
      const up = toNumber(updown.up);
      const down = toNumber(updown.down);
      const unchanged = toNumber(updown.unchanged);

      if (vnValue > 0 && liquidity > 0) {
        candidates.push({
          date: toViDate(new Date()),
          vnindex: vnValue,
          change_pct: vnChange,
          liquidity,
          total_liquidity: null,
          matched_liquidity: liquidity,
          negotiated_liquidity: null,
          breadth: { up, down, unchanged, total: up + down + unchanged },
          session_summary: "Bản tin EOD tạm thời từ dữ liệu thị trường trực tiếp.",
          liquidity_detail: `GTGD khớp lệnh toàn thị trường đạt ${Math.round(liquidity).toLocaleString("vi-VN")} tỷ đồng.`,
          foreign_flow: "",
          notable_trades: "",
          outlook: "",
          sub_indices: [],
          foreign_top_buy: [],
          foreign_top_sell: [],
          prop_trading_top_buy: [],
          prop_trading_top_sell: [],
          individual_top_buy: [],
          individual_top_sell: [],
          sector_gainers: [],
          sector_losers: [],
          buy_signals: [],
          sell_signals: [],
          top_breakout: [],
          top_new_high: [],
        });
      }
    }

    const snapshot = await getMarketSnapshot();
    const vnindex = snapshot.indices.find((item) => item.ticker === "VNINDEX");
    if (vnindex && snapshot.liquidity != null && snapshot.liquidity > 0) {
      const investorLines = getInvestorTradingText(snapshot, "full19");
      const foreignLine = investorLines.find((line) => normalizeForCheck(line).includes("khoi ngoai")) ?? "";
      const otherLines = investorLines.filter((line) => line !== foreignLine).join(" | ");
      const snapshotExchangeLiquidity: ExchangeLiquidity = normalizeExchangeLiquidity({
        HOSE: snapshot.liquidityByExchange.HOSE ?? null,
        HNX: snapshot.liquidityByExchange.HNX ?? null,
        UPCOM: snapshot.liquidityByExchange.UPCOM ?? null,
      });
      const snapshotBreadth = {
        up: snapshot.breadth?.up ?? 0,
        down: snapshot.breadth?.down ?? 0,
        unchanged: snapshot.breadth?.unchanged ?? 0,
        total: (snapshot.breadth?.up ?? 0) + (snapshot.breadth?.down ?? 0) + (snapshot.breadth?.unchanged ?? 0),
      };

      if (hasFullExchangeLiquidity(snapshotExchangeLiquidity) && snapshotBreadth.total > 0) {
        candidates.push({
          date: toViDate(new Date(snapshot.timestamp)),
          vnindex: vnindex.value,
          change_pct: vnindex.changePct,
          liquidity: snapshot.liquidity,
          total_liquidity: null,
          matched_liquidity: snapshot.liquidity,
          negotiated_liquidity: null,
          liquidity_by_exchange: snapshotExchangeLiquidity,
          breadth: snapshotBreadth,
          session_summary: `Bản tin EOD tạm thời từ snapshot trực tiếp (${snapshot.requestDateVN}).`,
          liquidity_detail: buildLiquidityDetail(snapshot.liquidity, snapshotExchangeLiquidity),
          foreign_flow: foreignLine || "",
          notable_trades: otherLines,
          outlook: snapshot.marketOverview?.action_message ?? "",
          sub_indices: [],
          foreign_top_buy: [],
          foreign_top_sell: [],
          prop_trading_top_buy: [],
          prop_trading_top_sell: [],
          individual_top_buy: [],
          individual_top_sell: [],
          sector_gainers: [],
          sector_losers: [],
          buy_signals: [],
          sell_signals: [],
          top_breakout: [],
          top_new_high: [],
        });
      }
    }

    if (candidates.length === 0) return null;
    return candidates.sort((a, b) => eodPayloadScore(b) - eodPayloadScore(a))[0];
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const typeParam = request.nextUrl.searchParams.get("type") ?? "morning";
  const storedOnly =
    request.nextUrl.searchParams.get("stored") === "1" ||
    request.nextUrl.searchParams.get("mode") === "stored";
  if (typeParam !== "morning" && typeParam !== "eod") {
    return NextResponse.json({ error: "type phải là 'morning' hoặc 'eod'" }, { status: 400 });
  }

  if (typeParam === "morning") {
    const reports = await getRecentReports(["morning_brief"]);
    if (reports.length === 0) {
      return NextResponse.json({ error: "Chưa có Morning Brief hợp lệ để hiển thị." }, { status: 404 });
    }

    const enriched = reports.map((report) => ({
      dateKey: getReportDateKey(report),
      payload: toMorningPayload(report),
    }));
    const preferredDateKey = pickPreferredReportDateKey(reports);
    const sameDatePayloads = preferredDateKey
      ? enriched.filter((item) => item.dateKey === preferredDateKey).map((item) => item.payload)
      : [];
    const orderedPayloads = [...enriched.map((item) => item.payload)].sort(
      (a, b) => morningPayloadScore(b) - morningPayloadScore(a),
    );
    let selected =
      [...sameDatePayloads].sort((a, b) => morningPayloadScore(b) - morningPayloadScore(a))[0] ??
      orderedPayloads[0];
    selected = backfillMorningPayload(selected, orderedPayloads);
    let bridgeMorningPayload: MorningPayload | null = null;
    if (!storedOnly) {
      const bridgeMorning = await fetchMorningNews().catch(() => null);
      if (bridgeMorning) {
        bridgeMorningPayload = fromBridgeMorningPayload(bridgeMorning);
        selected = backfillMorningPayload(selected, [bridgeMorningPayload]);
      }
      selected = await enrichMorningPayload(selected, bridgeMorningPayload);
    }
    selected = {
      ...selected,
      reference_indices: selected.reference_indices.map((item) => ({
        ...item,
        name: normalizeIndexName(repairMojibake(item.name)),
      })),
      vn_market: selected.vn_market.map((line) => sanitizeNewsLine(line)).filter(Boolean),
      macro: selected.macro.map((line) => sanitizeNewsLine(line)).filter(Boolean),
      risk_opportunity: selected.risk_opportunity.map((line) => sanitizeNewsLine(line)).filter(isMeaningfulLine),
    };
    if (storedOnly ? !hasDisplayableMorningPayload(selected) : !hasValidMorningPayload(selected)) {
      return NextResponse.json({ error: "Morning Brief chưa đủ dữ liệu hợp lệ để publish." }, { status: 503 });
    }
    return NextResponse.json(selected);
  }

  const reports = await getRecentReports(["eod_full_19h", "close_brief_15h"]);
  if (reports.length === 0) {
    return NextResponse.json({ error: "Chưa có EOD Brief hợp lệ để hiển thị." }, { status: 404 });
  }

  const enriched = reports.map((report) => ({
    dateKey: getReportDateKey(report),
    payload: toEodPayload(report),
  }));
  const preferredDateKey = pickPreferredReportDateKey(reports);
  const sameDatePayloads = preferredDateKey
    ? enriched.filter((item) => item.dateKey === preferredDateKey).map((item) => item.payload)
    : [];
  const orderedPayloads = [...enriched.map((item) => item.payload)].sort((a, b) => eodPayloadScore(b) - eodPayloadScore(a));

  let selected = [...sameDatePayloads].sort((a, b) => eodPayloadScore(b) - eodPayloadScore(a))[0] ?? orderedPayloads[0];
  selected = backfillEodPayload(selected, orderedPayloads);

  if (!storedOnly && (shouldUseBridgeEod(selected) || !hasFullExchangeLiquidity(selected.liquidity_by_exchange))) {
    const bridgeEod = await fetchEodNews().catch(() => null);
    if (bridgeEod) {
      selected = backfillEodPayload(fromBridgeEodPayload(bridgeEod), [selected, ...orderedPayloads]);
    }
  }

  if (!storedOnly && (!hasValidEodPayload(selected) || !hasFullExchangeLiquidity(selected.liquidity_by_exchange))) {
    const liveFallback = await buildLiveEodFallbackPayload();
    if (liveFallback) selected = backfillEodPayload(selected, [liveFallback]);
  }

  const liveSnapshot = storedOnly ? null : await getMarketSnapshot().catch(() => null);
  if (liveSnapshot) {
    const snapshotLiquidityByExchange: ExchangeLiquidity = normalizeExchangeLiquidity({
      HOSE: toNumberOrNull(liveSnapshot.liquidityByExchange.HOSE),
      HNX: toNumberOrNull(liveSnapshot.liquidityByExchange.HNX),
      UPCOM: toNumberOrNull(liveSnapshot.liquidityByExchange.UPCOM),
    });

    const shouldFillExchange =
      !hasFullExchangeLiquidity(selected.liquidity_by_exchange) &&
      hasFullExchangeLiquidity(snapshotLiquidityByExchange);
    if (shouldFillExchange) {
      selected.liquidity_by_exchange = snapshotLiquidityByExchange;
    }

    const snapshotLiquidity = sumExchangeLiquidity(snapshotLiquidityByExchange) ?? toNumberOrNull(liveSnapshot.liquidity);
    if (snapshotLiquidity != null && snapshotLiquidity > 0) {
      if (!(Number.isFinite(selected.matched_liquidity) && (selected.matched_liquidity ?? 0) > 0)) {
        selected.matched_liquidity = snapshotLiquidity;
      }
      const selectedLiquidity = toNumberOrNull(selected.liquidity) ?? 0;
      if (selectedLiquidity <= 0 || selectedLiquidity < snapshotLiquidity * 0.4) {
        selected.liquidity = selected.total_liquidity ?? snapshotLiquidity;
      }
    }
  }

  if (selected.liquidity_by_exchange) {
    selected.liquidity_by_exchange = normalizeExchangeLiquidity(selected.liquidity_by_exchange);
  }
  const selectedExchangeLiquidityTotal = sumExchangeLiquidity(selected.liquidity_by_exchange);
  if (selectedExchangeLiquidityTotal != null && !(Number.isFinite(selected.matched_liquidity) && (selected.matched_liquidity ?? 0) > 0)) {
    selected.matched_liquidity = selectedExchangeLiquidityTotal;
  }
  if (
    !(Number.isFinite(selected.total_liquidity) && (selected.total_liquidity ?? 0) > 0) &&
    (selected.matched_liquidity ?? 0) > 0 &&
    (selected.negotiated_liquidity ?? 0) > 0
  ) {
    selected.total_liquidity = (selected.matched_liquidity ?? 0) + (selected.negotiated_liquidity ?? 0);
  }
  selected.liquidity = selected.total_liquidity ?? selected.matched_liquidity ?? selected.liquidity;
  if (selected.liquidity > 0 && selected.liquidity_by_exchange) {
    selected.liquidity_detail = buildLiquidityDetail(selected.liquidity, selected.liquidity_by_exchange, {
      total: selected.total_liquidity ?? null,
      matched: selected.matched_liquidity ?? null,
      negotiated: selected.negotiated_liquidity ?? null,
    });
  }
  selected = {
    ...selected,
    session_summary: sanitizeNarrativeLine(selected.session_summary),
    liquidity_detail: sanitizeNarrativeLine(selected.liquidity_detail),
    foreign_flow: sanitizeNarrativeLine(selected.foreign_flow),
    notable_trades: sanitizeNarrativeLine(selected.notable_trades),
    outlook: sanitizeNarrativeLine(selected.outlook),
    foreign_top_buy: sanitizeFlowList(selected.foreign_top_buy),
    foreign_top_sell: sanitizeFlowList(selected.foreign_top_sell),
    prop_trading_top_buy: sanitizeFlowList(selected.prop_trading_top_buy),
    prop_trading_top_sell: sanitizeFlowList(selected.prop_trading_top_sell),
    individual_top_buy: sanitizeFlowList(selected.individual_top_buy),
    individual_top_sell: sanitizeFlowList(selected.individual_top_sell),
    sector_gainers: sanitizeFlowList(selected.sector_gainers),
    sector_losers: sanitizeFlowList(selected.sector_losers),
    buy_signals: sanitizeFlowList(selected.buy_signals),
    sell_signals: sanitizeFlowList(selected.sell_signals),
    top_breakout: sanitizeFlowList(selected.top_breakout),
    top_new_high: sanitizeFlowList(selected.top_new_high),
  };
  if (isInvalidEodOutlook(selected.outlook)) {
    selected.outlook = buildDeterministicEodOutlook(selected);
  }
  if (storedOnly ? !hasDisplayableEodPayload(selected) : !hasValidEodPayload(selected)) {
    return NextResponse.json({ error: "EOD Brief chưa đủ dữ liệu hợp lệ để publish." }, { status: 503 });
  }
  return NextResponse.json(selected);
}

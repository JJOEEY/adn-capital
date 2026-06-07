import type { DatabaseResult } from "@/lib/database/contracts";
import { databaseOk } from "@/lib/database/contracts";
import { getCachedDatabaseEodMarketDataset, getDatabaseEodMarketDataset } from "@/lib/database/eod";
import { rewriteMorningBriefWithFreeModel } from "@/lib/database/morning-freemodel";
import { getDatabaseNewsDataset } from "@/lib/database/providers/news";
import type { DatabaseMorningBriefPayload, DatabaseNewsItem, DatabaseNewsSourceName } from "@/lib/database/providers/news";

const GROUPS: Array<{ label: string; keywords: string[] }> = [
  { label: "Nhóm dầu khí & năng lượng", keywords: ["dau khi", "nang luong", "dien", "xang dau", "pvn", "bsr", "gas", "plx", "pow", "nt2", "tmp", "pvd", "pvs"] },
  { label: "Bất động sản & hạ tầng", keywords: ["bat dong san", "xay dung", "ha tang", "du an", "do thi", "long thanh", "vic", "vhm", "pdr", "dxg", "kdh", "acv"] },
  { label: "Ngân hàng & dòng tiền", keywords: ["ngan hang", "tin dung", "lai suat", "trai phieu", "huy dong von", "vpb", "ctg", "bid", "tcb", "mbb", "stb", "hdb", "vcb"] },
  { label: "Chứng khoán & huy động vốn", keywords: ["chung khoan", "moi gioi", "tu doanh", "ipo", "tang von", "ssi", "vnd", "vci", "hcm", "shs", "bsi"] },
  { label: "Cổ tức & kết quả kinh doanh", keywords: ["co tuc", "ket qua kinh doanh", "loi nhuan", "doanh thu", "san luong", "eps", "dtd", "fmc", "hlb"] },
  { label: "Bán lẻ & tiêu dùng", keywords: ["ban le", "tieu dung", "mwg", "pnj", "fpt retail", "dgw"] },
];

const POSITIVE_WORDS = ["tang", "mua rong", "ho tro", "huong loi", "ky luc", "dot pha", "loi nhuan", "co tuc", "mo rong", "hop tac"];
const NEGATIVE_WORDS = ["giam", "ban rong", "ap luc", "rui ro", "khoi to", "thua lo", "suy giam", "no xau", "pha san", "dieu tra"];
const REQUIRED_REFERENCE_INDICES = new Set(["VN-INDEX", "VN30", "HNX-INDEX", "UPCOM-INDEX"]);
const MORNING_NEWS_SOURCES: DatabaseNewsSourceName[] = ["vnstock_news"];
const MORNING_REWRITE_TIMEOUT_MS = 45_000;

function isOptionalMorningEodMissing(field: string) {
  return field.includes("requires-fiinquant-enrichment");
}

function dateKeyInVietnam(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function displayDate(dateKey: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return dateKey;
  return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(`${dateKey}T00:00:00+07:00`));
}

function previousTradingDateKey(date = new Date()) {
  const value = new Date(date);
  do {
    value.setDate(value.getDate() - 1);
    const weekday = value.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh", weekday: "short" });
    if (weekday !== "Sat" && weekday !== "Sun") break;
  } while (true);
  return dateKeyInVietnam(value);
}

function stripDiacritics(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeForCheck(text: string) {
  return stripDiacritics(text).toLowerCase().replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(text: string) {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
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

function cleanLine(text: string) {
  return decodeHtmlEntities(text)
    .replace(/<[^>]+>/g, " ")
    .replace(/[*_`]/g, "")
    .replace(/^\s*(?:[-•]+|\d+[.)])\s*/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(text: string, max = 245) {
  const cleaned = cleanLine(text);
  if (cleaned.length <= max) return cleaned.replace(/\s*(?:\.{3}|…)+$/u, ".");
  const cut = cleaned.slice(0, max);
  const at = cut.lastIndexOf(" ");
  const trimmed = cut
    .slice(0, at > 150 ? at : max)
    .trim()
    .replace(/[,:;–-]+$/u, "");
  if (!trimmed) return "";
  return /[.!?]$/u.test(trimmed) ? trimmed : `${trimmed}.`;
}

function lowerFirst(text: string) {
  if (!text) return text;
  return text.charAt(0).toLocaleLowerCase("vi-VN") + text.slice(1);
}

function isUsableNewsText(text: string) {
  const cleaned = cleanLine(text);
  if (cleaned.length < 18) return false;
  if (/(?:\.{3}|…)$/u.test(cleaned) || /&#\d+;|&#x[0-9a-f]+;|&[a-z]+;/iu.test(cleaned)) return false;
  const normalized = normalizeForCheck(cleaned);
  if (/^\d+\s*(phut|gio|ngay)\s+truoc$/.test(normalized)) return false;
  if (/^\d{1,2}[:/]\d{1,2}(?:[:/]\d{2,4})?$/.test(normalized)) return false;
  return true;
}

function dedupe(items: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items.map(cleanLine).filter(Boolean)) {
    const key = normalizeForCheck(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function itemText(item: DatabaseNewsItem) {
  const candidates = [item.summary, item.title].filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    const cleaned = cleanLine(candidate);
    if (isUsableNewsText(cleaned)) return cleaned;
  }
  return "";
}

function classifySentiment(item: DatabaseNewsItem): "positive" | "negative" | "neutral" {
  const n = normalizeForCheck(`${item.title} ${item.summary ?? ""}`);
  if (NEGATIVE_WORDS.some((word) => n.includes(word))) return "negative";
  if (POSITIVE_WORDS.some((word) => n.includes(word))) return "positive";
  return "neutral";
}

function extractTickers(items: DatabaseNewsItem[]) {
  const ignored = new Set(["ETF", "GDP", "USD", "VND", "CEO", "IPO", "FED", "SBV", "FTA", "WTI", "PMI"]);
  const tickers: string[] = [];
  for (const item of items) {
    const text = `${item.title} ${item.summary ?? ""}`;
    for (const ticker of text.match(/\b[A-Z]{2,5}\b/g) ?? []) {
      if (ignored.has(ticker) || tickers.includes(ticker)) continue;
      tickers.push(ticker);
      if (tickers.length >= 6) return tickers;
    }
  }
  return tickers;
}

function summarizeNewsItems(items: DatabaseNewsItem[], maxItems = 3) {
  const texts = dedupe(items.map(itemText)).slice(0, maxItems).map((item) => compact(item, 135));
  if (!texts.length) return "";
  if (texts.length === 1) return texts[0];
  if (texts.length === 2) return `${texts[0]}; đồng thời ${lowerFirst(texts[1])}`;
  return `${texts[0]}; ${texts[1]}; ngoài ra ${lowerFirst(texts[2])}`;
}

function summarizeGroup(items: DatabaseNewsItem[]) {
  const tickers = extractTickers(items);
  const positive = items.filter((item) => classifySentiment(item) === "positive").length;
  const negative = items.filter((item) => classifySentiment(item) === "negative").length;
  const tone = positive > negative
    ? "thiên về hỗ trợ tâm lý ngắn hạn"
    : negative > positive
      ? "cần theo dõi rủi ro và phản ứng dòng tiền"
      : "cho thấy thị trường đang phân hóa theo từng câu chuyện riêng";
  const tickerText = tickers.length ? ` Các mã đáng chú ý: ${tickers.join(", ")}.` : "";
  return compact(`${summarizeNewsItems(items)}. Nhóm này ${tone}.${tickerText}`, 310);
}

function buildVietnamHighlights(items: DatabaseNewsItem[]) {
  const used = new Set<string>();
  const output: string[] = [];
  const usableItems = items.filter((item) => Boolean(itemText(item)));

  for (const group of GROUPS) {
    const matched = usableItems.filter((item) => {
      const n = normalizeForCheck(`${item.title} ${item.summary ?? ""}`);
      return group.keywords.some((keyword) => n.includes(keyword));
    });
    if (!matched.length) continue;
    matched.forEach((item) => used.add(item.hash));
    output.push(`${group.label}: ${summarizeGroup(matched)}`);
    if (output.length >= 5) break;
  }

  const remaining = usableItems.filter((item) => !used.has(item.hash));
  if (remaining.length && output.length < 5) {
    output.push(`Các mã/doanh nghiệp đáng chú ý khác: ${summarizeGroup(remaining.slice(0, 5))}`);
  }

  return output;
}

function buildMacroHighlights(domestic: DatabaseNewsItem[], global: DatabaseNewsItem[]) {
  const output: string[] = [];
  if (domestic.length) {
    output.push(compact(`Vĩ mô trong nước: ${summarizeNewsItems(domestic, 4)}. Các thông tin này có thể ảnh hưởng tới kỳ vọng chính sách, lãi suất và dòng tiền trong nước.`, 330));
  }
  if (global.length) {
    output.push(compact(`Quốc tế: ${summarizeNewsItems(global, 4)}. Nhà đầu tư nên theo dõi tác động tới hàng hóa, tỷ giá và tâm lý rủi ro toàn cầu.`, 330));
  }
  return output;
}

function findIndex(
  data: Awaited<ReturnType<typeof getDatabaseEodMarketDataset>>["data"],
  ticker: string,
) {
  return data?.indices?.find((item) => item.ticker === ticker) ?? null;
}

function findIndexAny(
  data: Awaited<ReturnType<typeof getDatabaseEodMarketDataset>>["data"],
  tickers: string[],
) {
  for (const ticker of tickers) {
    const found = findIndex(data, ticker);
    if (found) return found;
  }
  return null;
}

function formatPct(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function buildReferenceIndices(data: Awaited<ReturnType<typeof getDatabaseEodMarketDataset>>["data"]) {
  return [
    { sources: ["VNINDEX"], name: "VN-INDEX" },
    { sources: ["VN30"], name: "VN30" },
    { sources: ["HNXINDEX", "HNX"], name: "HNX-INDEX" },
    { sources: ["UPCOMINDEX", "UPCOM"], name: "UPCOM-INDEX" },
  ].map((item) => {
    const found = findIndexAny(data, item.sources);
    return {
      name: item.name,
      value: found?.value ?? null,
      change_pct: found?.changePct ?? null,
    };
  });
}

function buildRiskOpportunity(params: {
  eod: Awaited<ReturnType<typeof getDatabaseEodMarketDataset>>["data"];
  news: DatabaseNewsItem[];
}) {
  const output: string[] = [];
  const vnindex = findIndex(params.eod, "VNINDEX");
  const vn30 = findIndex(params.eod, "VN30");
  const vnPct = formatPct(vnindex?.changePct);
  const vn30Pct = formatPct(vn30?.changePct);
  const breadth = params.eod?.breadth;

  if (vnPct || vn30Pct) {
    output.push(compact(
      `Diễn biến: VN-Index ${vnPct ?? "chưa đủ số liệu"}${vn30Pct ? `, VN30 ${vn30Pct}` : ""}. ${breadth?.down != null && breadth?.up != null
        ? `Độ rộng thị trường: ${breadth.up} mã tăng, ${breadth.down} mã giảm.`
        : "Cần theo dõi thêm độ rộng thị trường trong phiên."}`,
    ));
  }

  const negative = params.news.find((item) => classifySentiment(item) === "negative");
  const positive = params.news.find((item) => classifySentiment(item) === "positive");
  if (negative) {
    output.push(compact(`Rủi ro: ${itemText(negative)}. Nếu thông tin này lan rộng, tâm lý thận trọng có thể tăng ở nhóm liên quan.`));
  }
  if (positive) {
    output.push(compact(`Cơ hội: ${itemText(positive)}. Dòng tiền có thể ưu tiên các mã có câu chuyện rõ và thanh khoản xác nhận.`));
  }

  const marketTone =
    typeof vnindex?.changePct === "number"
      ? vnindex.changePct < 0
        ? "nghiêng về thận trọng"
        : "giữ được sắc thái tích cực"
      : "cần thêm xác nhận từ dữ liệu thị trường";
  output.push(compact(
    `Nhận định chung: Thị trường ${marketTone}, dòng tiền có xu hướng phân hóa theo nhóm ngành và câu chuyện riêng. Nhà đầu tư nên ưu tiên quan sát thanh khoản, độ rộng và phản ứng ở các mã dẫn dắt trước khi tăng tỷ trọng.`,
    300,
  ));

  return dedupe(output).slice(0, 5);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function getDatabaseMorningBrief(options?: {
  tradingDate?: string;
  previousTradingDate?: string;
  windowHours?: number;
  useFiinquantFallback?: boolean;
  useFiinquantEnrichment?: boolean;
}): Promise<DatabaseResult<DatabaseMorningBriefPayload>> {
  const startedAt = Date.now();
  const tradingDate = options?.tradingDate ?? dateKeyInVietnam();
  const previousTradingDate = options?.previousTradingDate ?? previousTradingDateKey();
  const newsWindowHours = options?.windowHours ?? 36;
  const eodPromise = getCachedDatabaseEodMarketDataset({ tradingDate: previousTradingDate })
    .then((cached) => cached ?? getDatabaseEodMarketDataset({
      tradingDate: previousTradingDate,
      useFiinquantEnrichment: options?.useFiinquantEnrichment ?? options?.useFiinquantFallback ?? false,
    }));
  const [marketNews, macroNews, globalNews, eod] = await Promise.all([
    getDatabaseNewsDataset({ category: "market", sources: MORNING_NEWS_SOURCES, limit: 24, windowHours: newsWindowHours }),
    getDatabaseNewsDataset({ category: "macro", sources: MORNING_NEWS_SOURCES, limit: 12, windowHours: newsWindowHours }),
    getDatabaseNewsDataset({ category: "global", sources: MORNING_NEWS_SOURCES, limit: 12, windowHours: newsWindowHours }),
    eodPromise,
  ]);

  const vnNews = marketNews.data ?? [];
  const macroDomestic = macroNews.data ?? [];
  const macroGlobal = globalNews.data ?? [];
  const allNews = [...vnNews, ...macroDomestic, ...macroGlobal];
  const payload: DatabaseMorningBriefPayload = {
    date: displayDate(tradingDate),
    reference_indices: buildReferenceIndices(eod.data),
    vn_market: buildVietnamHighlights(vnNews),
    macro: buildMacroHighlights(macroDomestic, macroGlobal),
    risk_opportunity: buildRiskOpportunity({ eod: eod.data, news: allNews }),
    metadata: {
      tradingDate,
      previousTradingDate,
      generatedAt: new Date().toISOString(),
      newsSources: Array.from(new Set(allNews.map((item) => item.source))),
      format: "database-v2-morning-brief",
      rewriteSource: "deterministic",
    },
  };

  const rewritten = await withTimeout(
    rewriteMorningBriefWithFreeModel({ payload, news: allNews }),
    MORNING_REWRITE_TIMEOUT_MS,
  );
  if (rewritten) {
    payload.vn_market = rewritten.vn_market;
    payload.macro = rewritten.macro;
    payload.risk_opportunity = rewritten.risk_opportunity;
    payload.metadata.rewriteSource = rewritten.provider;
  }

  const macroOrGlobalMissing = !macroDomestic.length || !macroGlobal.length
    ? [...macroNews.missingFields, ...globalNews.missingFields]
    : [];
  const blockingEodMissingFields = eod.missingFields.filter((field) => !isOptionalMorningEodMissing(field));
  const missingFields = [
    ...(!payload.vn_market.length ? ["morning.vn_market"] : []),
    ...(!payload.macro.length ? ["morning.macro"] : []),
    ...(!payload.risk_opportunity.length ? ["morning.risk_opportunity"] : []),
    ...payload.reference_indices
      .filter((item) => REQUIRED_REFERENCE_INDICES.has(item.name) && item.value == null)
      .map((item) => `morning.reference_index:${item.name}`),
    ...(!vnNews.length ? marketNews.missingFields.map((field) => `news:${field}`) : []),
    ...macroOrGlobalMissing.map((field) => `news:${field}`),
    ...blockingEodMissingFields.map((field) => `eod:${field}`),
  ];

  const providerStatus = {
    provider: "database" as const,
    ok: missingFields.length === 0,
    endpoint: "postgres:DatabaseNewsItem+DatabaseMarketLatest",
    latencyMs: Date.now() - startedAt,
    code: missingFields.length ? "database_v2_morning_brief_partial" : undefined,
    message: missingFields.length
      ? "Database v2 Morning Brief is partial. Keep v1 publishing until readiness passes."
      : undefined,
    retryable: missingFields.length > 0,
  };

  return databaseOk("news.morning", "database", payload, providerStatus, missingFields);
}

function bulletList(items: string[]) {
  return items.map((item) => `• ${cleanLine(item)}`).join("\n");
}

function formatIndexLine(item: DatabaseMorningBriefPayload["reference_indices"][number]) {
  const value = typeof item.value === "number"
    ? item.value.toLocaleString("vi-VN", { maximumFractionDigits: 2 })
    : "chưa đủ số liệu";
  const pct = typeof item.change_pct === "number"
    ? `${item.change_pct > 0 ? "+" : ""}${item.change_pct.toFixed(2)}%`
    : "chưa đủ số liệu";
  return `• ${item.name}: ${value} | ${pct}`;
}

export function formatDatabaseMorningBriefText(payload: DatabaseMorningBriefPayload) {
  return [
    `☀️ *BẢN TIN SÁNG ADN CAPITAL — ${payload.date}*`,
    "",
    "📊 *CHỈ SỐ THAM CHIẾU:*",
    payload.reference_indices.map(formatIndexLine).join("\n"),
    "",
    "🇻🇳 *ĐIỂM TIN VIỆT NAM NỔI BẬT:*",
    bulletList(payload.vn_market),
    "",
    "🌐 *VĨ MÔ TRONG NƯỚC & QUỐC TẾ:*",
    bulletList(payload.macro),
    "",
    "⚠️ *RỦI RO / CƠ HỘI:*",
    bulletList(payload.risk_opportunity),
    "",
    "_Powered by ADN Capital AI_",
  ].join("\n").slice(0, 3900);
}

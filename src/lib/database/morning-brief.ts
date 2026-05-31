import type { DatabaseResult } from "@/lib/database/contracts";
import { databaseOk } from "@/lib/database/contracts";
import { getCachedDatabaseEodMarketDataset, getDatabaseEodMarketDataset } from "@/lib/database/eod";
import { rewriteMorningBriefWithFreeModel } from "@/lib/database/morning-freemodel";
import { getDatabaseNewsDataset } from "@/lib/database/providers/news";
import type { DatabaseMorningBriefPayload, DatabaseNewsItem } from "@/lib/database/providers/news";

const GROUPS: Array<{ label: string; keywords: string[] }> = [
  { label: "Nhóm dầu khí & năng lượng", keywords: ["dau khi", "nang luong", "dien", "xang dau", "pvn", "bsr", "gas", "plx", "pow", "pvd", "pvs"] },
  { label: "Nhóm bất động sản & xây dựng", keywords: ["bat dong san", "xay dung", "ha tang", "du an", "can gio", "long thanh", "vic", "vhm", "pdr", "dxg", "kdh", "acv"] },
  { label: "Nhóm ngân hàng", keywords: ["ngan hang", "tin dung", "lai suat", "trai phieu", "vpb", "ctg", "bid", "tcb", "mbb", "stb", "hdb", "vcb"] },
  { label: "Nhóm chứng khoán", keywords: ["chung khoan", "moi gioi", "tu doanh", "ssi", "vnd", "vci", "hcm", "shs", "bsi"] },
  { label: "Nhóm thép & vật liệu", keywords: ["thep", "vat lieu", "xi mang", "hpg", "hsg", "nkg"] },
  { label: "Nhóm bán lẻ & tiêu dùng", keywords: ["ban le", "tieu dung", "mw g", "mwg", "pnj", "fpt retail", "dg w", "dgw"] },
];

const POSITIVE_WORDS = ["tang", "mua rong", "ho tro", "huong loi", "ky luc", "dot pha", "loi nhuan", "co tuc", "mo rong", "hop tac"];
const NEGATIVE_WORDS = ["giam", "ban rong", "ap luc", "rui ro", "khoi to", "thua lo", "suy giam", "no xau", "pha san", "dieu tra"];
const REQUIRED_REFERENCE_INDICES = new Set(["VN-INDEX", "VN30"]);

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

function cleanLine(text: string) {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/[*_`]/g, "")
    .replace(/^\s*(?:[-•]+|\d+[.)])\s*/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(text: string, max = 245) {
  const cleaned = cleanLine(text);
  if (cleaned.length <= max) return cleaned;
  const cut = cleaned.slice(0, max);
  const at = cut.lastIndexOf(" ");
  return `${cut.slice(0, at > 150 ? at : max).trim()}...`;
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
  return cleanLine(item.summary || item.title);
}

function joinTitles(items: DatabaseNewsItem[], maxItems = 3) {
  return dedupe(items.map(itemText))
    .slice(0, maxItems)
    .map((item) => compact(item, 120))
    .join("; ");
}

function classifySentiment(item: DatabaseNewsItem): "positive" | "negative" | "neutral" {
  const n = normalizeForCheck(`${item.title} ${item.summary ?? ""}`);
  if (NEGATIVE_WORDS.some((word) => n.includes(word))) return "negative";
  if (POSITIVE_WORDS.some((word) => n.includes(word))) return "positive";
  return "neutral";
}

function buildVietnamHighlights(items: DatabaseNewsItem[]) {
  const used = new Set<string>();
  const output: string[] = [];

  for (const group of GROUPS) {
    const matched = items.filter((item) => {
      const n = normalizeForCheck(`${item.title} ${item.summary ?? ""}`);
      return group.keywords.some((keyword) => n.includes(keyword));
    });
    if (!matched.length) continue;
    matched.forEach((item) => used.add(item.hash));
    output.push(compact(`${group.label}: ${joinTitles(matched)}`));
    if (output.length >= 5) break;
  }

  const remaining = items.filter((item) => !used.has(item.hash));
  if (remaining.length && output.length < 5) {
    output.push(compact(`Các mã đáng chú ý khác: ${joinTitles(remaining, 4)}`));
  }

  return output;
}

function buildMacroHighlights(domestic: DatabaseNewsItem[], global: DatabaseNewsItem[]) {
  const output: string[] = [];
  if (domestic.length) output.push(compact(`Vĩ mô trong nước: ${joinTitles(domestic, 3)}`));
  if (global.length) output.push(compact(`Quốc tế: ${joinTitles(global, 3)}`));
  return output;
}

function findIndex(
  data: Awaited<ReturnType<typeof getDatabaseEodMarketDataset>>["data"],
  ticker: string,
) {
  return data?.indices?.find((item) => item.ticker === ticker) ?? null;
}

function formatPct(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function buildReferenceIndices(data: Awaited<ReturnType<typeof getDatabaseEodMarketDataset>>["data"]) {
  return [
    { source: "VNINDEX", name: "VN-INDEX" },
    { source: "VN30", name: "VN30" },
    { source: "VN30F1M", name: "VN30F1M" },
  ].map((item) => {
    const found = findIndex(data, item.source);
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
  if (negative) output.push(compact(`Rủi ro: ${itemText(negative)}`));
  if (positive) output.push(compact(`Cơ hội: ${itemText(positive)}`));

  const marketTone =
    typeof vnindex?.changePct === "number"
      ? vnindex.changePct < 0
        ? "nghiêng về thận trọng"
        : "giữ được sắc thái tích cực"
      : "cần thêm xác nhận từ dữ liệu thị trường";
  output.push(compact(
    `Nhận định chung: Thị trường ${marketTone}, dòng tiền có xu hướng phân hóa theo từng nhóm ngành. Nhà đầu tư nên ưu tiên quan sát dòng tiền và thông tin hỗ trợ cụ thể của từng mã.`,
    300,
  ));

  return dedupe(output).slice(0, 5);
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
  const eodPromise = getCachedDatabaseEodMarketDataset({ tradingDate: previousTradingDate })
    .then((cached) => cached ?? getDatabaseEodMarketDataset({
      tradingDate: previousTradingDate,
      useFiinquantEnrichment: options?.useFiinquantEnrichment ?? options?.useFiinquantFallback ?? false,
    }));
  const [marketNews, macroNews, globalNews, eod] = await Promise.all([
    getDatabaseNewsDataset({ category: "market", limit: 24, windowHours: options?.windowHours ?? 36 }),
    getDatabaseNewsDataset({ category: "macro", limit: 12, windowHours: options?.windowHours ?? 36 }),
    getDatabaseNewsDataset({ category: "global", limit: 12, windowHours: options?.windowHours ?? 36 }),
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

  const rewritten = await rewriteMorningBriefWithFreeModel({ payload, news: allNews });
  if (rewritten) {
    payload.vn_market = rewritten.vn_market;
    payload.macro = rewritten.macro;
    payload.risk_opportunity = rewritten.risk_opportunity;
    payload.metadata.rewriteSource = "freemodel";
  }

  const macroOrGlobalMissing = !macroNews.data?.length && !globalNews.data?.length
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
    ...marketNews.missingFields.map((field) => `news:${field}`),
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

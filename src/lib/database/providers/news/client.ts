import crypto from "crypto";
import type { Prisma } from "@prisma/client";
import type { DatabaseDataset, DatabaseResult } from "@/lib/database/contracts";
import { databaseOk } from "@/lib/database/contracts";
import { fetchAllCafefNews } from "@/lib/cafefScraper";
import { prisma } from "@/lib/prisma";
import { fetchVnstockMorningNews } from "@/lib/vnstockClient";
import type {
  DatabaseNewsCategory,
  DatabaseNewsCollectResult,
  DatabaseNewsHealth,
  DatabaseNewsItem,
  DatabaseNewsSourceName,
} from "./types";

type RawNewsItem = {
  source: DatabaseNewsSourceName;
  category: DatabaseNewsCategory;
  title: string;
  url: string;
  summary: string | null;
  publishedAt: string | null;
  fetchedAt: string;
  rawPayload: Record<string, unknown>;
};

const VIETSTOCK_MARKET_URL = "https://vietstock.vn/chung-khoan.htm";
const NEWS_WINDOW_HOURS = 36;

function normalizeText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function decodeXml(text: string) {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&quot;/g, "\"")
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(text: string) {
  return decodeXml(text).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function tagValue(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? stripHtml(match[1] ?? "") : "";
}

function parseDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoDate(value: string | null) {
  const date = parseDate(value);
  return date ? date.toISOString() : null;
}

function hashNews(source: string, title: string, url: string) {
  return crypto.createHash("sha256").update(`${source}|${url}|${title}`).digest("hex");
}

function toPrismaJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function normalizeRawItem(item: RawNewsItem): RawNewsItem | null {
  const title = normalizeText(item.title);
  const url = normalizeText(item.url);
  if (!title || title.length < 12 || !url) return null;
  return {
    ...item,
    title,
    url,
    summary: normalizeText(item.summary) || null,
    publishedAt: toIsoDate(item.publishedAt) ?? item.publishedAt,
  };
}

function rowToNewsItem(row: {
  id: string;
  source: string;
  category: string;
  title: string;
  url: string;
  summary: string | null;
  publishedAt: Date | null;
  fetchedAt: Date;
  hash: string;
}): DatabaseNewsItem {
  return {
    id: row.id,
    source: row.source as DatabaseNewsSourceName,
    category: row.category as DatabaseNewsCategory,
    title: row.title,
    url: row.url,
    summary: row.summary,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    fetchedAt: row.fetchedAt.toISOString(),
    hash: row.hash,
  };
}

function datasetForCategory(category?: DatabaseNewsCategory): DatabaseDataset {
  if (category === "market") return "news.market";
  if (category === "macro") return "news.macro";
  if (category === "global") return "news.global";
  if (category === "morning") return "news.morning";
  return "news.latest";
}

async function fetchCafefItems(): Promise<RawNewsItem[]> {
  const news = await fetchAllCafefNews();
  const fetchedAt = new Date().toISOString();
  const mapItems = (
    category: DatabaseNewsCategory,
    articles: Array<{ title: string; url: string; summary?: string; publishedAt?: string }>,
  ): RawNewsItem[] =>
    articles.map((article) => ({
      source: "cafef",
      category,
      title: article.title,
      url: article.url,
      summary: article.summary ?? null,
      publishedAt: article.publishedAt ?? null,
      fetchedAt,
      rawPayload: { ...article, category },
    }));

  return [
    ...mapItems("market", news.stockMarket.articles),
    ...mapItems("macro", news.macro.articles),
    ...mapItems("global", news.global.articles),
    ...mapItems("global", news.goldForex.articles),
  ];
}

async function fetchVietstockItems(): Promise<RawNewsItem[]> {
  const fetchedAt = new Date().toISOString();
  const res = await fetch(VIETSTOCK_MARKET_URL, {
    headers: { "User-Agent": "ADN-Capital-DatabaseV2/1.0" },
    redirect: "follow",
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`vietstock_http_${res.status}`);
  const body = await res.text();
  const items: RawNewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(body)) && items.length < 20) {
    const itemXml = match[1] ?? "";
    const title = tagValue(itemXml, "title");
    const url = tagValue(itemXml, "link");
    const summary = tagValue(itemXml, "description");
    const publishedAt = tagValue(itemXml, "pubDate") || null;
    items.push({
      source: "vietstock",
      category: "market",
      title,
      url,
      summary,
      publishedAt,
      fetchedAt,
      rawPayload: { title, url, summary, publishedAt },
    });
  }
  if (items.length > 0) return items;

  const linkRegex = /<a\s+[^>]*href="([^"]*\/\d{4}\/[^"]+\.htm)"[^>]*>([\s\S]*?)<\/a>/gi;
  const seen = new Set<string>();
  while ((match = linkRegex.exec(body)) && items.length < 20) {
    const url = match[1]?.startsWith("http") ? match[1] : `https://vietstock.vn${match[1]}`;
    const title = stripHtml(match[2] ?? "");
    if (!url || !title || seen.has(url)) continue;
    seen.add(url);
    items.push({
      source: "vietstock",
      category: "market",
      title,
      url,
      summary: null,
      publishedAt: null,
      fetchedAt,
      rawPayload: { title, url },
    });
  }
  return items;
}

async function fetchVnstockNewsItems(): Promise<RawNewsItem[]> {
  const response = await fetchVnstockMorningNews({ limit: 42, timeout: 60_000 });
  if (!response?.articles?.length) return [];
  return response.articles.map((article) => ({
    source: "vnstock_news",
    category: article.category,
    title: article.title,
    url: article.url,
    summary: article.summary,
    publishedAt: article.publishedAt,
    fetchedAt: article.fetchedAt,
    rawPayload: {
      ...(article.rawPayload ?? {}),
      providerSite: article.providerSite,
      source: article.source,
    },
  }));
}

export async function collectDatabaseNews(options?: {
  sources?: DatabaseNewsSourceName[];
}): Promise<DatabaseNewsCollectResult> {
  const sources: DatabaseNewsSourceName[] = options?.sources?.length ? options.sources : ["vnstock_news", "cafef", "vietstock"];
  const errors: string[] = [];
  const rawItems: RawNewsItem[] = [];

  if (sources.includes("cafef")) {
    try {
      rawItems.push(...await fetchCafefItems());
    } catch (error) {
      errors.push(error instanceof Error ? `cafef:${error.message}` : `cafef:${String(error)}`);
    }
  }
  if (sources.includes("vietstock")) {
    try {
      rawItems.push(...await fetchVietstockItems());
    } catch (error) {
      errors.push(error instanceof Error ? `vietstock:${error.message}` : `vietstock:${String(error)}`);
    }
  }
  if (sources.includes("vnstock_news")) {
    try {
      rawItems.push(...await fetchVnstockNewsItems());
    } catch (error) {
      errors.push(error instanceof Error ? `vnstock_news:${error.message}` : `vnstock_news:${String(error)}`);
    }
  }

  const normalized = rawItems.map(normalizeRawItem).filter((item): item is RawNewsItem => Boolean(item));
  let stored = 0;
  for (const item of normalized) {
    const hash = hashNews(item.source, item.title, item.url);
    await prisma.databaseNewsItem.upsert({
      where: {
        source_url: {
          source: item.source,
          url: item.url,
        },
      },
      create: {
        source: item.source,
        category: item.category,
        title: item.title,
        url: item.url,
        summary: item.summary,
        publishedAt: parseDate(item.publishedAt),
        fetchedAt: parseDate(item.fetchedAt) ?? new Date(),
        hash,
        rawPayload: toPrismaJson(item.rawPayload),
      },
      update: {
        category: item.category,
        title: item.title,
        summary: item.summary,
        publishedAt: parseDate(item.publishedAt),
        fetchedAt: parseDate(item.fetchedAt) ?? new Date(),
        hash,
        rawPayload: toPrismaJson(item.rawPayload),
      },
    });
    stored += 1;
  }

  const bySource: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  for (const item of normalized) {
    bySource[item.source] = (bySource[item.source] ?? 0) + 1;
    byCategory[item.category] = (byCategory[item.category] ?? 0) + 1;
  }
  const missingFields = [
    sources.includes("vnstock_news") && !bySource.vnstock_news ? "news.vnstock_news" : null,
    sources.includes("cafef") && !bySource.cafef ? "news.cafef" : null,
    sources.includes("vietstock") && !bySource.vietstock ? "news.vietstock" : null,
  ].filter((item): item is string => Boolean(item));

  return {
    ok: missingFields.length === 0 && errors.length === 0,
    sources,
    fetched: rawItems.length,
    stored,
    skipped: Math.max(0, rawItems.length - normalized.length),
    bySource,
    byCategory,
    errors,
    missingFields,
    collectedAt: new Date().toISOString(),
  };
}

export async function getDatabaseNewsDataset(options?: {
  category?: DatabaseNewsCategory;
  limit?: number;
  windowHours?: number;
}): Promise<DatabaseResult<DatabaseNewsItem[]>> {
  const startedAt = Date.now();
  const windowHours = options?.windowHours ?? NEWS_WINDOW_HOURS;
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const where = {
    fetchedAt: { gte: since },
    ...(options?.category && options.category !== "latest" ? { category: options.category } : {}),
  };
  const rows = await prisma.databaseNewsItem.findMany({
    where,
    orderBy: [{ fetchedAt: "desc" }, { publishedAt: "desc" }],
    take: options?.limit ?? 30,
  });
  const items = rows.map(rowToNewsItem);
  const missingFields = items.length ? [] : [`${datasetForCategory(options?.category)}:empty`];
  return databaseOk(datasetForCategory(options?.category), "database", items, {
    provider: "database",
    ok: missingFields.length === 0,
    endpoint: "postgres:DatabaseNewsItem",
    latencyMs: Date.now() - startedAt,
    code: missingFields.length ? "database_v2_news_empty" : undefined,
    retryable: missingFields.length > 0,
  }, missingFields);
}

export async function getDatabaseNewsHealth(options?: {
  windowHours?: number;
}): Promise<DatabaseNewsHealth> {
  const windowHours = options?.windowHours ?? NEWS_WINDOW_HOURS;
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const rows = await prisma.databaseNewsItem.findMany({
    where: { fetchedAt: { gte: since } },
    orderBy: [{ publishedAt: "desc" }, { fetchedAt: "desc" }],
    take: 80,
  });
  const bySource: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  for (const row of rows) {
    bySource[row.source] = (bySource[row.source] ?? 0) + 1;
    byCategory[row.category] = (byCategory[row.category] ?? 0) + 1;
  }
  const missingFields = [
    !bySource.vnstock_news ? "news.vnstock_news" : null,
    !bySource.cafef && !bySource.vietstock ? "news.cafef_or_vietstock" : null,
    !(byCategory.market || byCategory.morning) ? "news.market" : null,
    !byCategory.macro && !byCategory.global ? "news.macro_or_global" : null,
  ].filter((item): item is string => Boolean(item));

  return {
    status: missingFields.length === 0 ? "ok" : rows.length > 0 ? "degraded" : "blocked",
    checkedAt: new Date().toISOString(),
    windowHours,
    total: rows.length,
    bySource,
    byCategory,
    latest: rows.slice(0, 12).map(rowToNewsItem),
    missingFields,
  };
}

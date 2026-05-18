import fs from "fs";
import path from "path";

const ROOT = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function countCafefArticles(html) {
  const matches = html.matchAll(/<a\s+[^>]*href="([^"]*\.chn)"[^>]*title="([^"]{12,})"[^>]*>/gi);
  return Array.from(matches).length;
}

function countRssItems(xml) {
  return Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g)).length;
}

function countVietstockHtmlItems(html) {
  return Array.from(html.matchAll(/<a\s+[^>]*href="([^"]*\/\d{4}\/[^"]+\.htm)"[^>]*>([\s\S]*?)<\/a>/gi))
    .map((match) => String(match[2] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    .filter((title) => title.length > 20).length;
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "ADN-Capital-DatabaseV2-Verify/1.0" },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
  return res.text();
}

const checks = [];
const schema = read("prisma/schema.prisma");
const contract = read("src/lib/database/contracts/types.ts");

checks.push({
  name: "schema_has_database_news_item",
  ok: schema.includes("model DatabaseNewsItem") && schema.includes("@@unique([source, url])"),
});
checks.push({
  name: "contracts_include_news_datasets",
  ok: ["news.morning", "news.market", "news.macro", "news.global", "news.latest"].every((item) => contract.includes(item)),
});
checks.push({
  name: "collect_endpoint_exists",
  ok: fs.existsSync(path.join(ROOT, "src/app/api/internal/database/news/collect/route.ts")),
});
checks.push({
  name: "health_endpoint_exists",
  ok: fs.existsSync(path.join(ROOT, "src/app/api/internal/database/news/health/route.ts")),
});

let cafefCount = 0;
let vietstockCount = 0;
try {
  cafefCount = countCafefArticles(await fetchText("https://cafef.vn/thi-truong-chung-khoan.chn"));
  checks.push({ name: "cafef_parse_non_empty", ok: cafefCount > 0, count: cafefCount });
} catch (error) {
  checks.push({ name: "cafef_parse_non_empty", ok: false, error: error instanceof Error ? error.message : String(error) });
}

try {
  const vietstockBody = await fetchText("https://vietstock.vn/chung-khoan.htm");
  vietstockCount = countRssItems(vietstockBody) || countVietstockHtmlItems(vietstockBody);
  checks.push({ name: "vietstock_rss_parse_non_empty", ok: vietstockCount > 0, count: vietstockCount });
} catch (error) {
  checks.push({ name: "vietstock_rss_parse_non_empty", ok: false, error: error instanceof Error ? error.message : String(error) });
}

const report = {
  checkedAt: new Date().toISOString(),
  ok: checks.every((check) => check.ok),
  checks,
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);

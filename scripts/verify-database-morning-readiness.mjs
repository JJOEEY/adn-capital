import fs from "fs";
import path from "path";

const ROOT = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

const readinessFile = "src/lib/database/morning-readiness.ts";
const endpointFile = "src/app/api/internal/database/morning/readiness/route.ts";
const checks = [];

const readiness = read(readinessFile);
const endpoint = read(endpointFile);

checks.push({
  name: "readiness_endpoint_exists",
  ok: fs.existsSync(path.join(ROOT, endpointFile)) && endpoint.includes("getDatabaseMorningReadiness"),
});
checks.push({
  name: "readiness_checks_reference_indices",
  ok: readiness.includes("VNINDEX") && readiness.includes("VN30") && readiness.includes("reference_index:"),
});
checks.push({
  name: "readiness_checks_news_sources",
  ok: readiness.includes("cafefCount") && readiness.includes("vietstockCount") && readiness.includes("news.missingFields"),
});
checks.push({
  name: "readiness_checks_previous_eod",
  ok: readiness.includes("getDatabaseEodMarketDataset") && readiness.includes("market.eod:previous_trading_date"),
});
checks.push({
  name: "readiness_returns_publish_allowed",
  ok: readiness.includes("publishAllowed") && readiness.includes("missingFields.length === 0"),
});

const report = {
  checkedAt: new Date().toISOString(),
  ok: checks.every((check) => check.ok),
  checks,
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);

const baseUrl = (process.env.VNSTOCK_BRIDGE_URL || "http://127.0.0.1:8010").replace(/\/$/, "");
const date = process.env.VERIFY_VNSTOCK_DATE || new Date().toISOString().slice(0, 10);

async function fetchJson(path) {
  const res = await fetch(`${baseUrl}${path}`, { cache: "no-store" });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${path} returned non-JSON: ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(`${path} HTTP ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  }
  return json;
}

const health = await fetchJson("/health");
if (!health.ok) {
  throw new Error(`vnstock bridge health failed: ${JSON.stringify(health).slice(0, 300)}`);
}

const eod = await fetchJson(`/api/v1/eod-market-data?date=${encodeURIComponent(date)}`);
const checks = {
  foreignTopBuy: Array.isArray(eod.foreignTopBuy) && eod.foreignTopBuy.length > 0,
  propTradingTopBuy: Array.isArray(eod.propTradingTopBuy) && eod.propTradingTopBuy.length > 0,
  indexContribution: Array.isArray(eod.indexContribution) && eod.indexContribution.length > 0,
};
const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => key);
if (failed.length) {
  throw new Error(`vnstock EOD missing usable fields: ${failed.join(", ")}`);
}

console.log(JSON.stringify({
  ok: true,
  baseUrl,
  date,
  packages: health.packages,
  counts: {
    foreignTopBuy: eod.foreignTopBuy.length,
    propTradingTopBuy: eod.propTradingTopBuy.length,
    activeTopBuy: eod.activeTopBuy.length,
    indexContribution: eod.indexContribution.length,
  },
}, null, 2));

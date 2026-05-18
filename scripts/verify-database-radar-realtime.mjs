import fs from "fs";
import path from "path";

const ROOT = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function exists(file) {
  return fs.existsSync(path.join(ROOT, file));
}

const files = {
  radar: "src/lib/database/radar-realtime.ts",
  cache: "src/lib/database/realtime-cache.ts",
  cron: "src/app/api/cron/route.ts",
  contracts: "src/lib/cron-contracts.ts",
  setup: "deploy/setup-cron.sh",
  vercel: "vercel.json",
  healthRoute: "src/app/api/internal/database/realtime/health/route.ts",
  radarRoute: "src/app/api/internal/database/radar/realtime/route.ts",
  schema: "prisma/schema.prisma",
};

const radar = read(files.radar);
const cron = read(files.cron);
const contracts = read(files.contracts);
const setup = read(files.setup);
const vercel = read(files.vercel);
const schema = read(files.schema);

const checks = [
  {
    name: "radar_realtime_module_exists",
    ok: exists(files.radar) && radar.includes("collectDatabaseRadarRealtime") && radar.includes("collectDnseLightspeedMessages"),
  },
  {
    name: "realtime_cache_exists",
    ok: exists(files.cache) && read(files.cache).includes("setRealtimeCache") && read(files.cache).includes("getRealtimeCache"),
  },
  {
    name: "does_not_use_rest_polling_for_ticks",
    ok: !radar.includes("fetch(") && radar.includes("tick_extra.G1.json"),
  },
  {
    name: "cron_contracts_registered",
    ok: contracts.includes("database_radar_realtime_collect") && contracts.includes("database_realtime_health"),
  },
  {
    name: "cron_handler_registered",
    ok: cron.includes('type === "database_radar_realtime_collect"') && cron.includes('type === "database_realtime_health"'),
  },
  {
    name: "deploy_schedules_registered",
    ok: setup.includes("database_radar_realtime_collect") && vercel.includes("database_radar_realtime_collect"),
  },
  {
    name: "internal_endpoints_exist",
    ok: exists(files.healthRoute) && exists(files.radarRoute),
  },
  {
    name: "tool_latest_schema_exists",
    ok: schema.includes("model DatabaseToolLatest") && schema.includes("@@unique([tool, dataset, key, tradingDate])"),
  },
];

const report = {
  checkedAt: new Date().toISOString(),
  ok: checks.every((check) => check.ok),
  checks,
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);

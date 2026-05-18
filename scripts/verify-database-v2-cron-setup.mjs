import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const CRONS = [
  "database_news_collect",
  "database_dnse_market_collect",
  "database_morning_readiness",
  "database_morning_brief",
  "database_eod_collect",
  "database_eod_readiness",
  "database_radar_realtime_collect",
  "database_realtime_health",
  "database_adn_radar_collect",
  "database_adn_radar_readiness",
  "database_adn_art_collect",
  "database_adn_art_readiness",
  "database_adncore_collect",
  "database_adncore_readiness",
  "database_adn_rank_collect",
  "database_adn_rank_readiness",
];

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

const contracts = read("src/lib/cron-contracts.ts");
const cronRoute = read("src/app/api/cron/route.ts");
const adminStatus = read("src/app/api/admin/system/cron-status/route.ts");
const deployEnv = read("deploy/cron-contracts.env");
const setupCron = read("deploy/setup-cron.sh");
const vercel = read("vercel.json");

const checks = [
  {
    name: "cron_contracts_include_database_v2",
    ok: CRONS.every((cron) => contracts.includes(cron)),
  },
  {
    name: "cron_dispatcher_handles_database_v2",
    ok:
      cronRoute.includes("handleDatabaseV2Cron") &&
      cronRoute.includes("collectDatabaseNews") &&
      cronRoute.includes("collectDnseEodMarketToDatabase") &&
      cronRoute.includes("getDatabaseMorningBrief") &&
      cronRoute.includes("getDatabaseEodMarketDataset") &&
      cronRoute.includes("DATABASE_RADAR_TOPIC_KEYS") &&
      cronRoute.includes("collectDatabaseArtPayload") &&
      cronRoute.includes("DATABASE_ADNCORE_TOPIC_KEYS") &&
      cronRoute.includes("ADN_RANK_TOPIC_KEYS"),
  },
  {
    name: "admin_status_has_database_v2_policies",
    ok: CRONS.every((cron) => adminStatus.includes(`${cron}:`)),
  },
  {
    name: "deploy_cron_contracts_include_database_v2",
    ok: CRONS.every((cron) => deployEnv.includes(cron)),
  },
  {
    name: "vps_setup_installs_database_v2_crons",
    ok: CRONS.every((cron) => setupCron.includes(cron)),
  },
  {
    name: "vercel_crons_include_database_v2",
    ok: CRONS.every((cron) => vercel.includes(cron)),
  },
  {
    name: "database_v2_crons_do_not_publish_v1_topics",
    ok: !cronRoute.includes("brief:morning:latest\", {") && !cronRoute.includes("brief:eod:latest\", {"),
  },
  {
    name: "adncore_and_art_keep_existing_formula_sources",
    ok:
      cronRoute.includes("ART_DAILY_TOPIC_KEY") &&
      cronRoute.includes("calculateRPI(rows)") &&
      cronRoute.includes("SMARTFLOW_TOPIC_KEY") &&
      cronRoute.includes("getTopicEnvelope"),
  },
  {
    name: "database_v2_replaces_morning_and_eod_publish",
    ok:
      cronRoute.includes("DATABASE_V2_REPLACES_V1") &&
      cronRoute.includes("handleDatabaseMorningPublish") &&
      cronRoute.includes("handleDatabaseEodPublish") &&
      cronRoute.includes("cron:morning_brief:database_v2") &&
      cronRoute.includes("cron:eod_full_19h:database_v2"),
  },
  {
    name: "database_v2_publish_keeps_rollback_switch",
    ok: cronRoute.includes("process.env.DATABASE_V2_REPLACE_V1 !== \"false\""),
  },
];

const report = {
  checkedAt: new Date().toISOString(),
  ok: checks.every((check) => check.ok),
  checks,
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);

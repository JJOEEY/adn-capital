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
  readiness: "src/lib/database/readiness.ts",
  route: "src/app/api/internal/database/readiness/route.ts",
  registry: "src/lib/datahub/registry.ts",
  toolLatest: "src/lib/database/tool-latest.ts",
  featureFlags: "src/lib/database/feature-flags.ts",
  index: "src/lib/database/index.ts",
  packageJson: "package.json",
};

const readiness = read(files.readiness);
const registry = read(files.registry);
const index = read(files.index);
const packageJson = read(files.packageJson);

const checks = [
  {
    name: "readiness_endpoint_exists",
    ok: exists(files.route) && read(files.route).includes("getDatabaseV2Readiness"),
  },
  {
    name: "readiness_checks_core_datasets",
    ok:
      readiness.includes("getDatabaseNewsHealth") &&
      readiness.includes("getDatabaseMorningReadiness") &&
      readiness.includes("getDatabaseEodMarketDataset") &&
      readiness.includes("getDatabaseRealtimeHealth") &&
      readiness.includes("getDatabaseAidenHealth"),
  },
  {
    name: "feature_flags_exist",
    ok:
      exists(files.featureFlags) &&
      read(files.featureFlags).includes("DATABASE_V2_REPLACE_V1") &&
      read(files.featureFlags).includes("DATABASE_V2_RADAR_REALTIME_ENABLED"),
  },
  {
    name: "datahub_reads_database_v2",
    ok:
      registry.includes("isDatabaseV2ReplaceV1Enabled") &&
      registry.includes("loadDatabaseV2MorningBriefTopic") &&
      registry.includes("loadDatabaseV2EodBriefTopic") &&
      registry.includes("loadDatabaseV2PulseTopic") &&
      registry.includes("loadDatabaseV2RankTopic"),
  },
  {
    name: "tool_latest_exported",
    ok: index.includes("upsertDatabaseToolLatest") && exists(files.toolLatest),
  },
  {
    name: "package_scripts_exist",
    ok: packageJson.includes('"verify:database:readiness"') && packageJson.includes('"verify:database:radar-realtime"'),
  },
];

const report = {
  checkedAt: new Date().toISOString(),
  ok: checks.every((check) => check.ok),
  checks,
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);

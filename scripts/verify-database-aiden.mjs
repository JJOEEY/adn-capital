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
  types: "src/lib/database/aiden/types.ts",
  context: "src/lib/database/aiden/context.ts",
  index: "src/lib/database/aiden/index.ts",
  chat: "src/lib/aiden/datahub-chat.ts",
  contracts: "src/lib/database/contracts/types.ts",
  healthRoute: "src/app/api/internal/database/aiden/health/route.ts",
  contextRoute: "src/app/api/internal/database/aiden/context/route.ts",
  packageJson: "package.json",
};

const context = read(files.context);
const chat = read(files.chat);
const contracts = read(files.contracts);
const packageJson = read(files.packageJson);

const checks = [
  {
    name: "aiden_database_folder_exists",
    ok: [files.types, files.context, files.index].every(exists),
  },
  {
    name: "aiden_context_contracts_exist",
    ok:
      context.includes("getDatabaseAidenContext") &&
      context.includes("getDatabaseAidenTickerContext") &&
      context.includes("getDatabaseAidenHealth"),
  },
  {
    name: "aiden_datasets_registered",
    ok:
      contracts.includes('"aiden.context"') &&
      contracts.includes('"aiden.stock_context"') &&
      contracts.includes('"aiden.market_context"'),
  },
  {
    name: "aiden_reads_database_v2_context",
    ok:
      chat.includes("getDatabaseAidenContext") &&
      chat.includes("getDatabaseAidenTickerContext") &&
      chat.includes("verifiedFacts"),
  },
  {
    name: "internal_endpoints_exist",
    ok: exists(files.healthRoute) && exists(files.contextRoute),
  },
  {
    name: "uses_database_storage_not_rest_openapi",
    ok:
      !context.includes("DNSE_MARKET_SNAPSHOT_URL") &&
      !context.includes("/instruments") &&
      context.includes("DatabaseMarketLatest"),
  },
  {
    name: "package_script_exists",
    ok: packageJson.includes('"verify:database:aiden"'),
  },
];

const report = {
  checkedAt: new Date().toISOString(),
  ok: checks.every((check) => check.ok),
  checks,
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);

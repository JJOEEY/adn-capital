import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function exists(path) {
  return fs.existsSync(path);
}

function check(ok, name, detail = undefined) {
  return { ok: Boolean(ok), name, ...(detail ? { detail } : {}) };
}

const files = {
  module: "src/lib/database/adn-signal-core.ts",
  index: "src/lib/database/index.ts",
  route: "src/app/api/internal/database/radar/adn-signal-core/route.ts",
  registry: "src/lib/datahub/registry.ts",
  cron: "src/app/api/cron/route.ts",
  contracts: "src/lib/cron-contracts.ts",
  setupCron: "deploy/setup-cron.sh",
  deployEnv: "deploy/cron-contracts.env",
  vercel: "vercel.json",
  packageJson: "package.json",
};

const moduleText = exists(files.module) ? read(files.module) : "";
const registry = read(files.registry);
const cron = read(files.cron);
const contracts = read(files.contracts);
const setupCron = read(files.setupCron);
const deployEnv = read(files.deployEnv);
const vercel = read(files.vercel);
const packageJson = read(files.packageJson);

const checks = [
  check(exists(files.module), "adn_signal_core_module_exists"),
  check(moduleText.includes("ADN_SIGNAL_CORE"), "signal_name_registered"),
  check(moduleText.includes("ADN_SIGNAL_CORE_MIN_AVG_VALUE_VND") && moduleText.includes("10_000_000_000"), "ten_billion_filter_default"),
  check(moduleText.includes("STOP_LOSS_PCT = 0.07") && moduleText.includes("Stoploss -7%"), "core_stoploss_registered"),
  check(moduleText.includes("priceCrossUpEma200") && moduleText.includes("macdCrossUpSignal"), "core_buy_rule_registered"),
  check(moduleText.includes("liveRsi >= 80") && moduleText.includes("liveRsi <= 100"), "core_rsi_exit_registered"),
  check(moduleText.includes('process.env.ADN_SIGNAL_CORE_TELEGRAM_ENABLED === "true"'), "telegram_disabled_by_default"),
  check(moduleText.includes("radar.adn_signal_core.positions"), "core_position_tracking_registered"),
  check(moduleText.includes("TELEGRAM_SIGNAL_BOT_TOKEN") && moduleText.includes("ADN SIGNAL CORE"), "telegram_current_group_formatter"),
  check(moduleText.includes("adn-signal-core:${tradingDate}:${signal.ticker}:${signal.side}"), "per_ticker_daily_dedupe"),
  check(registry.includes("signal:market:radar:adn-signal-core") && registry.includes("getAdnSignalCoreLatest"), "datahub_subtopic_registered"),
  check(
    cron.includes('"database_adn_signal_core_universe_collect"') &&
      cron.includes("if (type === \"database_adn_signal_core_universe_collect\")") &&
      cron.includes("runAdnSignalCoreScan"),
    "cron_handler_registered",
  ),
  check(contracts.includes('"database_adn_signal_core_universe_collect"'), "cron_contract_registered"),
  check(setupCron.includes("database_v2_adn_signal_core_universe_collect.log"), "vps_cron_registered"),
  check(deployEnv.includes("CRON_DATABASE_ADN_SIGNAL_CORE_UNIVERSE_COLLECT_SCHEDULE"), "deploy_env_registered"),
  check(vercel.includes("database_adn_signal_core_universe_collect"), "vercel_cron_registered"),
  check(packageJson.includes('"verify:adn-signal-core"'), "package_script_registered"),
  check(exists(files.route), "internal_route_exists"),
];

const failed = checks.filter((item) => !item.ok);
console.log(JSON.stringify({ ok: failed.length === 0, checks }, null, 2));
if (failed.length) process.exit(1);

import fs from "node:fs/promises";

const ROOT = process.cwd();

function fail(message, extra = {}) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: message,
        ...extra,
      },
      null,
      2,
    ),
  );
  process.exit(2);
}

function check(condition, name, detail = null) {
  return { name, ok: Boolean(condition), detail };
}

async function read(relativePath) {
  const file = `${ROOT}/${relativePath}`;
  return fs.readFile(file, "utf8");
}

async function exists(relativePath) {
  try {
    await fs.access(`${ROOT}/${relativePath}`);
    return true;
  } catch {
    return false;
  }
}

async function probeHttp(url) {
  try {
    const res = await fetch(url, { method: "GET", cache: "no-store" });
    return { ok: [200, 401].includes(res.status), status: res.status };
  } catch (error) {
    return { ok: false, status: null, error: error instanceof Error ? error.message : String(error) };
  }
}

async function main() {
  const checks = [];
  checks.push(check(await exists("src/lib/observability.ts"), "observability_helper_exists"));
  checks.push(check(await exists("src/app/api/admin/system/cron-status/route.ts"), "cron_status_route_exists"));
  checks.push(check(await exists("src/app/api/admin/system/topic-health/route.ts"), "topic_health_route_exists"));
  checks.push(check(await exists("src/app/admin/cron-health/page.tsx"), "admin_cron_health_page_exists"));
  checks.push(check(await exists("docs/ops/PHASE7_HARDENING_OBSERVABILITY.md"), "phase7_ops_doc_exists"));
  checks.push(check(await exists("docs/ops/CRON_HEALTH_OPERATIONS.md"), "cron_health_ops_doc_exists"));

  const cronContracts = await read("src/lib/cron-contracts.ts");
  const requiredCronNames = [
    "signal_scan_type1",
    "market_stats_type2",
    "morning_brief",
    "close_brief_15h",
    "eod_full_19h",
  ];
  for (const cronName of requiredCronNames) {
    checks.push(check(cronContracts.includes(`"${cronName}"`), `cron_contract_contains_${cronName}`));
  }

  const cronStatusRoute = await read("src/app/api/admin/system/cron-status/route.ts");
  checks.push(check(cronStatusRoute.includes("sourceOfTruth: \"canonical\""), "cron_status_source_of_truth_canonical"));
  checks.push(check(cronStatusRoute.includes("jobs"), "cron_status_includes_jobs_matrix"));

  const datahubCore = await read("src/lib/datahub/core.ts");
  checks.push(check(datahubCore.includes("getTopicCacheInspections"), "datahub_cache_inspection_exported"));
  checks.push(check(datahubCore.includes("emitObservabilityEvent"), "datahub_observability_instrumented"));

  const baseUrl = (process.env.BASE_URL || process.env.NEXTAUTH_URL || "").replace(/\/$/, "");
  if (baseUrl) {
    const cronProbe = await probeHttp(`${baseUrl}/api/admin/system/cron-status`);
    const topicProbe = await probeHttp(`${baseUrl}/api/admin/system/topic-health`);
    checks.push(check(cronProbe.ok, "cron_status_http_probe", cronProbe));
    checks.push(check(topicProbe.ok, "topic_health_http_probe", topicProbe));
  } else {
    checks.push(check(true, "http_probes_skipped_no_base_url", "BASE_URL/NEXTAUTH_URL not configured"));
  }

  const blockers = checks.filter((item) => !item.ok);
  const output = {
    mode: "phase7_observability_verify",
    timestamp: new Date().toISOString(),
    checks,
    blockers: blockers.map((item) => item.name),
    ready: blockers.length === 0,
  };

  console.log(JSON.stringify(output, null, 2));
  if (!output.ready) process.exitCode = 2;
}

main().catch((error) => fail("phase7_observability_verify_fatal", { detail: error instanceof Error ? error.message : String(error) }));

import fs from "node:fs";
import assert from "node:assert/strict";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

const core = read("src/lib/datahub/core.ts");
const redis = read("src/lib/datahub/redis-cache.ts");
const compose = read("docker-compose.yml");
const nextConfig = read("next.config.ts");
const pkg = JSON.parse(read("package.json"));
const lock = JSON.parse(read("package-lock.json"));
const redisBlock = compose.match(/\n  redis:\n[\s\S]*?\n\n  web:/)?.[0] ?? "";

const checks = [];

function check(name, fn) {
  try {
    fn();
    checks.push({ name, ok: true });
  } catch (error) {
    checks.push({ name, ok: false, error: error.message });
  }
}

check("ioredis_dependency_registered", () => {
  assert.equal(typeof pkg.dependencies.ioredis, "string");
  assert.ok(lock.packages["node_modules/ioredis"]);
});

check("redis_adapter_has_versioned_json_envelope", () => {
  assert.match(redis, /REDIS_SCHEMA_VERSION\s*=\s*1/);
  assert.match(redis, /DEFAULT_PREFIX\s*=\s*"adn:datahub:v1"/);
  assert.match(redis, /JSON\.stringify\(record\)/);
  assert.match(redis, /schemaVersion/);
});

check("redis_adapter_respects_scope_and_private_default", () => {
  assert.match(redis, /DATAHUB_REDIS_PRIVATE_ENABLED/);
  assert.match(redis, /access === "private" \|\| scope === "user"/);
  assert.match(redis, /isPrivateRedisEnabled\(\)/);
});

check("redis_adapter_uses_ttl_plus_stale_window", () => {
  assert.match(redis, /resolveTopicStaleWindowMs/);
  assert.match(redis, /definition\.ttlMs \+ staleWindowMs\(definition\)/);
  assert.match(redis, /staleUntilMs/);
});

check("redis_failure_falls_back_without_throwing", () => {
  assert.match(redis, /redis_cache_read_failed/);
  assert.match(redis, /return null/);
  assert.match(redis, /redis_cache_write_failed/);
  assert.match(redis, /redis_cache_invalidate_failed/);
});

check("datahub_core_reads_writes_and_invalidates_redis", () => {
  assert.match(core, /readDataHubRedisCache/);
  assert.match(core, /writeDataHubRedisCache/);
  assert.match(core, /invalidateDataHubRedisCache/);
  assert.match(core, /cached\?\.inFlight/);
});

check("docker_compose_has_internal_redis", () => {
  assert.match(compose, /\n  redis:\n/);
  assert.match(redisBlock, /image: redis:7-alpine/);
  assert.match(redisBlock, /container_name: adn-redis/);
  assert.match(redisBlock, /redis-cli", "ping"/);
  assert.doesNotMatch(redisBlock, /ports:/);
});

check("web_depends_on_redis_and_env_flags", () => {
  assert.match(compose, /REDIS_URL=\$\{REDIS_URL:-redis:\/\/redis:6379\}/);
  assert.match(compose, /DATAHUB_REDIS_ENABLED=\$\{DATAHUB_REDIS_ENABLED:-true\}/);
  assert.match(compose, /DATAHUB_REDIS_PREFIX=\$\{DATAHUB_REDIS_PREFIX:-adn:datahub:v1\}/);
  assert.match(compose, /DATAHUB_REDIS_PRIVATE_ENABLED=\$\{DATAHUB_REDIS_PRIVATE_ENABLED:-false\}/);
  assert.match(compose, /redis:\s*\n\s*condition: service_healthy/);
});

check("next_headers_cache_static_and_bypass_api", () => {
  assert.match(nextConfig, /source: "\/_next\/static\/:path\*"/);
  assert.match(nextConfig, /public, max-age=31536000, immutable/);
  assert.match(nextConfig, /source: "\/api\/:path\*"/);
  assert.match(nextConfig, /Cache-Control", value: "no-store"/);
  assert.match(nextConfig, /source: "\/sw\.js"/);
  assert.match(nextConfig, /no-cache, no-store, must-revalidate/);
});

check("package_script_registered", () => {
  assert.equal(pkg.scripts["verify:datahub:redis-cache"], "node scripts/verify-datahub-redis-cache.mjs");
});

const ok = checks.every((item) => item.ok);
console.log(JSON.stringify({ ok, checks }, null, 2));
if (!ok) process.exit(1);

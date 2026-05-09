# Cron Health Operations

Status: Canonical operational guide for cron/runtime staleness.

## 1) Endpoints
- `GET /api/admin/system/cron-status` (admin)
- `GET /api/admin/system/topic-health` (admin)
- `/admin/cron-health` (admin UI)

Auth for API checks:
- Admin session cookie, or
- `x-internal-key` / `x-cron-secret` for internal ops smoke only.

## 2) Canonical cron matrix
- `signal_scan_type1`
- `market_stats_type2`
- `morning_brief`
- `close_brief_15h`
- `eod_full_19h`
- `adn_rank_15h`

Legacy aliases are accepted only for compatibility and normalized internally.

## 3) Cron status payload (minimum)
Each canonical job returns:
- `cronType`
- `aliases`
- `isStale`
- `staleReason`
- `expectedSlot`
- `staleGraceMinutes`
- `lastRun`
- `lastSuccess`
- `lastError`
- `minutesSinceLastRun`
- `usesLegacyAliasInLastRun`

Top-level:
- `sourceOfTruth=canonical`
- `isStale` (aggregated over canonical jobs)
- backward-compat `scanner` block for existing admin tab

## 4) Stale semantics
- Stale uses expected slot + grace model per canonical job.
- For trading-window jobs (`signal_scan_type1`, `market_stats_type2`), stale is only evaluated during VN trading session.
- For non-trading days, stale is not raised.
- Stale state must be surfaced in admin paths and logs, but must not crash user-facing requests.

## 5) Topic health semantics
`/api/admin/system/topic-health` reports:
- total definitions
- current cache entries
- stale/error/expired count
- grouped counts by family
- cache inspection list (topic, source, freshness, family, updatedAt/expiresAt)

## 6) Runbook integration
When deploy smoke reports cron or topic staleness:
1. Inspect `/admin/cron-health`.
2. Confirm canonical cron names exist in cron scheduler config.
3. Trigger canonical cron route manually with internal secret if needed.
4. Recheck `cron-status` and recent `CronLog` rows.

## 7) Safety constraints
- Do not introduce new scheduler engine.
- Do not replace canonical cron names with aliases.
- Do not treat alias-only rows as new source-of-truth.

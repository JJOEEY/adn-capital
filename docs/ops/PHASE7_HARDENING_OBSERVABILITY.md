# Phase 7 — Hardening, Observability, Cleanup

Status: `PHASE7` implementation baseline  
Scope: production-safe hardening only (no scheduler rewrite, no real-submit enablement)

## 1) What Phase 7 adds
- Standardized observability envelope via `src/lib/observability.ts`.
- DataHub instrumentation:
  - cache hit / in-flight dedupe / stale-min-interval / refresh success / refresh fallback / refresh error
  - invalidate events
- Cron instrumentation:
  - normalized dispatch events
  - persisted cron log events (`cron_log_persisted` / `cron_log_failed`)
  - notification/report/webpush events
- Workflow runtime instrumentation:
  - trigger intake
  - run persistence status
  - trigger failure logging
- Provider runtime instrumentation:
  - manifest fallback and run fallback telemetry
- Broker execution instrumentation:
  - parse/validate/preview/submit decision telemetry in safe/pilot mode

## 2) Canonical health visibility
- Canonical cron health API:
  - `GET /api/admin/system/cron-status`
- Canonical topic health API:
  - `GET /api/admin/system/topic-health`
- Minimal admin view:
  - `/admin/cron-health`

## 3) Cron stale model (canonical)
Canonical jobs:
- `signal_scan_type1`
- `market_stats_type2`
- `morning_brief`
- `close_brief_15h`
- `eod_full_19h`

Stale is evaluated by expected slot + grace window per canonical job.
Legacy aliases are compatibility-only and surfaced as `usesLegacyAliasInLastRun=true` if detected.

## 4) DataHub freshness policy
DataHub topic family policy:
- market_public
- brief
- research
- signal_public
- portfolio_private
- broker_private
- workflow_admin
- misc

Runtime stale window is resolved from:
1. explicit `staleWhileRevalidateMs` on topic definition
2. fallback by family policy (`src/lib/datahub/policy.ts`)

## 5) Validation commands
- Build:
```bash
npm run build
```
- Phase 7 static/runtime-aware verification:
```bash
npm run verify:phase7:observability
```

`verify:phase7:observability` validates:
- canonical files/routes/scripts exist
- canonical scheduler names remain present in contracts
- cron status route exports canonical matrix behavior
- DataHub instrumentation exports cache inspection
- optional HTTP probe (if `BASE_URL`/`NEXTAUTH_URL` is configured)

## 6) Out of scope (still unchanged)
- No Redis/Kafka
- No scheduler second engine
- No public DNSE real submit rollout
- No compliance bypass
- No AI override on deterministic signal/risk/broker decisions

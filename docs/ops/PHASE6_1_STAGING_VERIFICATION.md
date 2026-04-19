# Phase 6.1 - Workflow Runtime Staging Verification

Status: verified on staging/runtime  
Related:
- [docs/ops/PHASE6_WORKFLOW_RUNTIME.md](./PHASE6_WORKFLOW_RUNTIME.md)
- [docs/ops/WORKFLOW_RUNTIME_OPERATIONS.md](./WORKFLOW_RUNTIME_OPERATIONS.md)

## 1) Verification scope
- Keep Phase 6 architecture unchanged (JSON-first runtime, no second scheduler).
- Verify runtime on staging/VPS with real Postgres + real app runtime.
- Verify:
  - 3 default workflows run end-to-end
  - admin/debug read model
  - canonical cron/webhook trigger ingestion
  - `CronLog` persistence contract

## 2) Runtime dependency checklist
Mandatory:
- `DATABASE_URL` valid postgres URL
- `DIRECT_DATABASE_URL` valid postgres URL
- DB reachable from runtime
- `CronLog` writable
- `INTERNAL_API_KEY` or `CRON_SECRET` available
- `BASE_URL`/`WORKFLOW_INTERNAL_BASE_URL`/`NEXTAUTH_URL` reachable

Optional:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

Admin verification:
- admin credentials + session
- account role = `ADMIN`

## 3) Commands
- `npm run build`
- `npm run verify:phase6:runtime`
- `npm run verify:phase6:smoke`
- `npm run verify:phase6:staging`

## 4) Pass criteria
- Manual triggers accepted and matched:
  - `morning-brief-ready-refresh`
  - `signal-active-notify`
  - `portfolio-risk-alert`
- Every run has persisted `CronLog` payload with:
  - `actions[]`
  - `retries`
  - `warnings`
  - `triggerSource`
  - `startedAt/completedAt`
- Admin APIs and `/admin/workflows` load with authenticated admin.
- At least one cron route and one webhook/signal route produce canonical workflow trigger source.

## 5) Execution evidence
Verification date (UTC): `2026-04-19T20:27Z` to `2026-04-19T20:28Z`  
Runtime: VPS `14.225.204.117`, app dir `/home/adncapital/app/adn-capital`, web container runtime.

- Runtime readiness (`npm run verify:phase6:runtime`): **PASS**
  - mandatory dependencies: pass (`DATABASE_URL`, `DIRECT_DATABASE_URL`, internal key, base URL)
  - DB + `CronLog` write probe: pass
  - internal trigger auth probe: pass
  - optional warnings only: `PHASE6_ADMIN_EMAIL`, `PHASE6_ADMIN_PASSWORD` not explicitly set
- Smoke (`npm run verify:phase6:smoke`): **PASS**
  - manual triggers matched and persisted for:
    - `morning-brief-ready-refresh`
    - `signal-active-notify`
    - `portfolio-risk-alert`
  - action statuses, retries, warnings/errors surfaced in `CronLog.resultData`
- Staging verifier (`npm run verify:phase6:staging`): **PASS**
  - admin/debug routes:
    - `GET /api/admin/system/workflows` -> 200
    - `GET /api/admin/system/workflows/runs` -> 200
    - `/admin/workflows` -> 200
  - canonical trigger ingestion:
    - cron path: `/api/cron?type=signal_scan_type1&sync=1` -> workflow `cron-canonical-pulse`, source `cron-dispatch:sync`
    - webhook path: `/api/webhooks/signals` -> workflow `signal-active-notify`, source `webhook:signals`
  - persistence:
    - workflow runs recorded with `actions[]`, `retries`, `warnings`, `triggerSource`, timestamps

Residual blockers:
- none for Phase 6 runtime verification scope.
- known optional behavior:
  - `send_telegram` can fail with provider-side formatting error in one workflow branch, but is recorded and does not crash run path (`continueOnError` behavior verified).

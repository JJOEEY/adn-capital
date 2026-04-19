# Phase 6.1 - Workflow Runtime Staging Verification

Status: pending verification run (update after execution)  
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

## 5) Execution evidence (fill after run)
- Runtime readiness: _pending_
- Smoke (manual internal triggers): _pending_
- Staging verifier: _pending_
- Residual blockers: _pending_

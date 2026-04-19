# Phase 6 - Workflow Automation Runtime (JSON-First)

Status: Canonical phase record  
Master references:
- [docs/architecture/ADN_MASTER_ARCHITECTURE.md](../architecture/ADN_MASTER_ARCHITECTURE.md)
- [docs/ops/SOURCE_OF_TRUTH.md](./SOURCE_OF_TRUTH.md)

## 1) Scope
- Implement workflow runtime in `web` as registry-driven, JSON-first automation.
- Keep scheduler ownership in `fiinquant`; workflow runtime does not create a second scheduler.
- Keep DNSE execution safety/compliance guards unchanged.

## 2) Runtime placement
- Core engine: `src/lib/workflows/*`
- Internal trigger ingress:
  - `POST /api/internal/workflows/trigger`
- Admin debug/read-model:
  - `GET /api/admin/system/workflows`
  - `GET /api/admin/system/workflows/runs`
  - `/admin/workflows`

## 3) Supported triggers
- `cron`
- `signal_status_changed`
- `market_threshold`
- `portfolio_risk_threshold`
- `brief_ready`

## 4) Supported actions
- `invalidate_topic` (deterministic)
- `refresh_topic` (deterministic)
- `run_scanner` (deterministic, guarded against cron recursion by default)
- `create_notification` (best-effort)
- `send_telegram` (best-effort)
- `persist_report` (deterministic with dedupe window)
- `write_log` (deterministic, `Changelog` component=`WORKFLOW_RUNTIME`)

## 5) Execution log model
- Persisted in `CronLog` with:
  - `cronName = workflow:{workflowKey}`
  - `status = success|error|skipped`
  - `message = {triggerType} via {triggerSource}`
  - `duration`
  - `resultData` JSON:
    - trigger snapshot
    - action statuses
    - retries
    - warnings/errors
    - startedAt/completedAt

No new DB infra was introduced for phase 6.

## 6) Default workflows
0. `cron-canonical-pulse`
   - trigger: `cron` for `signal_scan_type1`
   - actions: write runtime log for canonical cron ingestion path
1. `morning-brief-ready-refresh`
   - trigger: `brief_ready` for `morning_brief`
   - actions: invalidate topics, refresh topics, persist report (deduped), write log
2. `signal-active-notify`
   - trigger: `signal_status_changed` to `ACTIVE`
   - actions: invalidate signal topics, create notification, optional telegram, write log
3. `portfolio-risk-alert`
   - trigger: `portfolio_risk_threshold` (`riskPercent >= 70`)
   - actions: create notification, optional telegram, write log

## 7) Retry policy
- Minimal retry per action:
  - default attempts: `2`
  - default delay: `800ms`
- Retry applies only to retryable action failures.
- `continueOnError` allows workflow to keep running best-effort actions without collapsing the entire run.

## 8) Deterministic boundaries
- Workflow runtime cannot bypass deterministic core:
  - does not create raw trading signal logic
  - does not bypass DNSE compliance/kill-switch/allowlist gates
  - does not enable real submit

## 9) Integration points wired
- `brief_ready` emitted from:
  - `cron/morning-report`
  - `cron/afternoon-review`
  - `cron eod_full_19h`
- `signal_status_changed` emitted from:
  - `cron signal scan`
  - `webhook signals`
- `cron` trigger emitted from `cron dispatcher` sync + async paths.

## 10) Runtime dependencies for verification
Mandatory:
- `DATABASE_URL` (postgres/pgbouncer URL)
- `DIRECT_DATABASE_URL` (postgres direct DB URL)
- Writable `CronLog` table
- Internal trigger auth secret (`INTERNAL_API_KEY` or `CRON_SECRET`)
- Reachable runtime base URL (`BASE_URL` or `WORKFLOW_INTERNAL_BASE_URL` or `NEXTAUTH_URL`)

Optional (best-effort actions):
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

Admin verification dependencies:
- Valid admin session (credentials + role `ADMIN`)
- Admin routes:
  - `GET /api/admin/system/workflows`
  - `GET /api/admin/system/workflows/runs`
  - `/admin/workflows`

## 11) Validation commands
- `npm run build`
- `npm run verify:phase6:runtime`
- `npm run verify:phase6:smoke`
- `npm run verify:phase6:staging` (for staging/VPS runtime verification)

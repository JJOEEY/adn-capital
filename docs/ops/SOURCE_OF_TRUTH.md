# ADN Capital Source Of Truth (Phase 0 Freeze)

Status: Canonical runtime contract  
Master architecture: [docs/architecture/ADN_MASTER_ARCHITECTURE.md](../architecture/ADN_MASTER_ARCHITECTURE.md)  
Decision records: [docs/architecture/ADR_INDEX.md](../architecture/ADR_INDEX.md)

## Documentation Hierarchy
- Canonical architecture baseline:
  - [docs/architecture/ADN_MASTER_ARCHITECTURE.md](../architecture/ADN_MASTER_ARCHITECTURE.md)
- Canonical runtime/deploy contracts:
  - [docs/ops/SOURCE_OF_TRUTH.md](./SOURCE_OF_TRUTH.md)
  - [DEPLOY_SAFE_RUNBOOK.md](../../DEPLOY_SAFE_RUNBOOK.md)
  - [docs/ops/PRODUCTION_DEPLOY_CHECKLIST.md](./PRODUCTION_DEPLOY_CHECKLIST.md)
- Supporting phase records:
  - [docs/ops/PHASE4_PROVIDER_MANIFESTS.md](./PHASE4_PROVIDER_MANIFESTS.md)
  - [docs/ops/PHASE5_DNSE_EXECUTION.md](./PHASE5_DNSE_EXECUTION.md)
  - [docs/ops/PHASE5_2_STAGING_VERIFICATION.md](./PHASE5_2_STAGING_VERIFICATION.md)
  - [docs/ops/PHASE5_3_CONTROLLED_PILOT.md](./PHASE5_3_CONTROLLED_PILOT.md)
  - [docs/ops/PHASE5_4_ALLOWLIST_PILOT.md](./PHASE5_4_ALLOWLIST_PILOT.md)
  - [docs/ops/PHASE6_WORKFLOW_RUNTIME.md](./PHASE6_WORKFLOW_RUNTIME.md)
  - [docs/ops/WORKFLOW_RUNTIME_OPERATIONS.md](./WORKFLOW_RUNTIME_OPERATIONS.md)
  - [docs/ops/PHASE6_1_STAGING_VERIFICATION.md](./PHASE6_1_STAGING_VERIFICATION.md)
  - [docs/ops/PHASE7_HARDENING_OBSERVABILITY.md](./PHASE7_HARDENING_OBSERVABILITY.md)
  - [docs/ops/CRON_HEALTH_OPERATIONS.md](./CRON_HEALTH_OPERATIONS.md)
- Post-roadmap controlled operations tracks:
  - [docs/ops/COMPLIANCE_PACK.md](./COMPLIANCE_PACK.md)
  - [docs/ops/REAL_SUBMIT_APPROVAL_MATRIX.md](./REAL_SUBMIT_APPROVAL_MATRIX.md)
  - [docs/ops/DNSE_EXECUTION_POLICY.md](./DNSE_EXECUTION_POLICY.md)
  - [docs/ops/BROKER_SECRET_HANDLING_POLICY.md](./BROKER_SECRET_HANDLING_POLICY.md)
  - [docs/ops/KILL_SWITCH_DRILL.md](./KILL_SWITCH_DRILL.md)
  - [docs/ops/PILOT_OPERATIONS_HANDBOOK.md](./PILOT_OPERATIONS_HANDBOOK.md)
  - [docs/ops/ALLOWLIST_ONBOARDING.md](./ALLOWLIST_ONBOARDING.md)
  - [docs/ops/PILOT_SUPPORT_RUNBOOK.md](./PILOT_SUPPORT_RUNBOOK.md)
  - [docs/ops/AUDIT_REVIEW_PLAYBOOK.md](./AUDIT_REVIEW_PLAYBOOK.md)
  - [docs/ops/DNSE_PILOT_INTEGRATION.md](./DNSE_PILOT_INTEGRATION.md)
  - [docs/ops/DNSE_ENV_SETUP.md](./DNSE_ENV_SETUP.md)
  - [docs/ops/DNSE_RUNTIME_VERIFICATION.md](./DNSE_RUNTIME_VERIFICATION.md)
  - [docs/ops/REAL_SUBMIT_GOVERNANCE.md](./REAL_SUBMIT_GOVERNANCE.md)
  - [docs/ops/REAL_SUBMIT_ENABLEMENT_CHECKLIST.md](./REAL_SUBMIT_ENABLEMENT_CHECKLIST.md)
  - [docs/ops/EXECUTION_KILL_SWITCH_OPERATIONS.md](./EXECUTION_KILL_SWITCH_OPERATIONS.md)
  - [docs/ops/POST_EXECUTION_AUDIT_PLAYBOOK.md](./POST_EXECUTION_AUDIT_PLAYBOOK.md)

## 1) Runtime Ownership
- `web` owns DataHub cache/topic APIs (`/api/hub/*`), cron execution, Telegram publish, and dispatch dedupe.
- `fiinquant` owns raw provider data/compute endpoints only. It must not self-publish Telegram, self-webhook signals, or run publish schedulers unless explicitly enabled for local diagnostics.
- `db` stores persistent state (user/signal/report/cron log/broker sync).

## 2) Environment Contracts
- Canonical bridge env: `PYTHON_BRIDGE_URL`
- Backward-compat alias only: `FIINQUANT_URL`
- Canonical pooled DB env: `DATABASE_URL` (must point to `pgbouncer`)
- Canonical direct DB env: `DIRECT_DATABASE_URL` (must point to `db`)

Expected:
```env
PYTHON_BRIDGE_URL=http://fiinquant:8000
DATABASE_URL=postgresql://adnuser:***@pgbouncer:5432/adncapital?schema=public&pgbouncer=true
DIRECT_DATABASE_URL=postgresql://adnuser:***@db:5432/adncapital?schema=public
BRIDGE_SCHEDULER_ENABLED=false
BRIDGE_DIRECT_TELEGRAM_ENABLED=false
BRIDGE_WEBHOOK_ENABLED=false
SCANNER_WEBHOOK_INGEST_ENABLED=false
```

## 3) Scheduler Canonical Types
- `signal_scan_type1` (10:00, 10:30, 14:00, 14:25)
- `market_stats_type2` (10:00, 11:30, 14:00, 14:45)
- `morning_brief` (08:00)
- `close_brief_15h` (15:00)
- `eod_full_19h` (19:00)

ADN Radar scan contract:
- Universe chính là `RADAR_WATCHLIST_500`; hot scan dùng `RADAR_HOT_WATCHLIST`.
- Không quét sâu toàn bộ thị trường hoặc 1.700 mã theo chu kỳ 5 phút.
- Web cron chọn `hot`/`wide` theo slot và quota guard; bridge chỉ trả raw scan payload.

Telegram publish contract:
- All customer/admin Telegram messages must go through web, never directly from `fiinquant`.
- `TelegramDispatchLog.eventKey` is the message-level idempotency key.
- `SignalHistory` remains ticker/day dedupe for newly reported signals.
- ACTIVE notifications must be batched; avoid one Telegram message per ticker.

Legacy aliases (supported for compatibility only):
- `signal_scan_5m` -> `signal_scan_type1`
- `market_stats` / `intraday` -> `market_stats_type2`
- `prop_trading` -> `eod_full_19h`

## 4) Deploy Baseline
Safe deploy default:
```bash
bash deploy/predeploy-check.sh
bash deploy/safe-web-deploy.sh
bash deploy/postdeploy-smoke.sh
```

Forbidden in normal deploy:
```bash
docker-compose down
```

Rollback baseline:
```bash
bash deploy/rollback-web.sh <git-ref>
```

## 5) AI Policy Freeze
AI allowed:
- explain/summarize/personalize/compare

AI forbidden:
- generate raw trading signal
- override deterministic lifecycle/risk rules
- override broker truth state

## 6) Provider Runtime (Phase 4)
- Current mode: `CONTRACT_FIRST_FALLBACK_MODE`
- Reason: workspace does not include executable Python provider registry source; web keeps contract-first adapters.
- Canonical provider endpoints:
  - `GET /api/v1/providers/backtest/manifest`
  - `POST /api/v1/providers/backtest/run`
  - `GET /api/v1/providers/scanner/manifest`
  - `POST /api/v1/providers/scanner/run`
- Deterministic boundary:
  - Scanner/backtest result is source-of-truth.
  - `requestInsight` can only add explanation after deterministic result exists.
  - If deterministic source is unavailable, API returns degraded/error with warnings; no synthetic trading signal output.

## 7) DNSE Execution Runtime (Phase 5.1)
- Current mode: `SAFE_EXECUTION_ADAPTER_MODE`
- Reason:
  - Workspace currently has DNSE identity verification (`dnseId`, `dnseVerified`) but does not contain a compliance-approved end-user OTP/Trading-Token partner flow for auto submit.
  - Real order execution must remain server-side and deterministic-first with explicit human confirmation.
- Canonical endpoints:
  - `GET /api/user/dnse`
  - `GET /api/user/dnse/link`
  - `POST /api/user/dnse/link`
  - `DELETE /api/user/dnse/link`
  - `GET /api/user/dnse/link/accounts`
  - `POST /api/v1/brokers/dnse/order-intents/parse`
  - `POST /api/v1/brokers/dnse/order-intents/validate`
  - `POST /api/v1/brokers/dnse/orders/preview`
  - `POST /api/v1/brokers/dnse/orders/submit`
- Canonical private broker topics:
  - `broker:dnse:{userId}:{accountId}:positions`
  - `broker:dnse:{userId}:{accountId}:orders`
  - `broker:dnse:{userId}:{accountId}:balance`
  - `broker:dnse:{userId}:{accountId}:holdings`
- Compatibility aliases remain readable:
  - `broker:dnse:{accountId}:{channel}`
  - `broker:dnse:current-user:{channel}`
- Production-safe defaults:
  - `DNSE_TOKEN_ENCRYPTION_KEY=<required>`
  - `DNSE_API_KEY=<required>`
  - `DNSE_TRADING_BASE_URL=<required>`
  - `DNSE_BROKER_BALANCE_URL=<required for realtime NAV>`
  - `DNSE_BROKER_HOLDINGS_URL=<required for realtime holdings>`
  - `DNSE_BROKER_ORDERS_URL=<required for realtime order book>`
  - `DNSE_ORDER_SUBMIT_URL=<required for pilot submit path>`
  - `DNSE_ORDER_INTENT_ENABLED=true`
  - `DNSE_ORDER_PREVIEW_ENABLED=true`
  - `DNSE_REAL_ORDER_SUBMIT_ENABLED=false`
  - `DNSE_MANUAL_TEST_TOKEN_MODE=false`
  - `DNSE_COMPLIANCE_APPROVED_FLOW=false`
  - `DNSE_ALLOW_REAL_SUBMIT_IN_PROD=false`
  - `DNSE_ALLOW_MANUAL_TEST_IN_PROD=false`
- Deterministic boundary:
  - AI may suggest `OrderIntent` drafts only.
  - Deterministic gate decides valid/blocked/needs_confirmation.
  - Human confirmation is mandatory before submit.
  - If submit is not enabled/approved, API returns `blocked_not_enabled` or `approval_required` (never fake success).

## 8) DNSE Staging Verification (Phase 5.2)
- Canonical debug API:
  - `GET /api/admin/system/dnse-execution` (admin only)
- Canonical debug view:
  - `/admin/dnse-execution`
- Canonical runtime validator:
  - `npm run verify:phase5:runtime`
- Verification policy:
  - staging-safe flow must verify parse -> validate -> preview -> submit(safe-mode)
  - submit must remain blocked/degraded in safe defaults
  - audit trail and broker topic hydration must be visible with freshness/source/error contract
- Compliance policy:
  - if OTP/trading-token end-user flow is not compliance-approved, execution remains safe-gated only
  - real submit remains OFF by default

## 9) DNSE Controlled Pilot (Phase 5.3)
- Rollout mode:
  - `COMPLIANCE_GATED_CONTROLLED_PILOT` (implementation mode on top of SAFE execution adapter)
  - public rollout is not enabled
  - real submit remains OFF by default
- Pilot allowlist contract (env + DB-backed settings):
  - `DNSE_EXECUTION_ALLOWLIST_ENFORCED=true`
  - `DNSE_EXECUTION_ALLOWLIST_USER_IDS`
  - `DNSE_EXECUTION_ALLOWLIST_ACCOUNT_IDS`
  - `DNSE_EXECUTION_ALLOWLIST_EMAILS`
  - matching happens by `userId | accountId | email`
- Global kill switch:
  - `DNSE_EXECUTION_KILL_SWITCH`
  - `DNSE_EXECUTION_KILL_SWITCH_REASON`
  - when ON, parse/validate/preview/submit are blocked immediately
- Safety guards (deterministic):
  - idempotency cache + replay cooldown + duplicate submit window
  - market-session guard
  - max-notional guard
  - account-binding guard (`intent.accountId` must match approved DNSE link)
- Compliance gate:
  - any branch that can reach real submit must return `approval_required` unless:
    - `DNSE_COMPLIANCE_APPROVED_FLOW=true`
    - and explicit production override is enabled
- Canonical debug/read model:
  - `GET /api/admin/system/dnse-execution`
  - `/admin/dnse-execution`
  - includes runtime blockers, rollout state, topic hydration, and parse->validate->preview->submit decision chain.

## 10) DNSE Allowlist Pilot Runtime Verification (Phase 5.4)
- Canonical verification commands:
  - `npm run verify:phase5:runtime`
  - `npm run verify:phase5:pilot-runtime`
- Canonical operator checklist:
  - `docs/ops/PHASE5_4_ALLOWLIST_PILOT.md`
- Runtime verification expectations:
  - inside allowlist: parse/validate/preview pass, submit remains deterministically blocked by safe/compliance gate
  - outside allowlist: submit blocked with explicit `pilot_allowlist_required`
  - kill switch ON: execution entry points are blocked immediately
  - admin debug route shows filters + decision chain + expected submit status
- Real submit policy remains unchanged:
  - no public execution rollout
  - no compliance bypass
  - no AI override over deterministic gate

## 11) Workflow Runtime (Phase 6)
- Runtime mode:
  - JSON-first, registry-driven workflow engine in `web`
  - event-driven only (no new scheduler loop)
- Canonical runtime modules:
  - `src/lib/workflows/definitions.ts`
  - `src/lib/workflows/triggers.ts`
  - `src/lib/workflows/actions.ts`
  - `src/lib/workflows/engine.ts`
- Canonical trigger ingress:
  - `POST /api/internal/workflows/trigger` (internal auth required)
- Canonical admin/debug:
  - `GET /api/admin/system/workflows`
  - `GET /api/admin/system/workflows/runs`
  - `/admin/workflows`
- Canonical verification commands:
  - `npm run verify:phase6:runtime`
  - `npm run verify:phase6:smoke`
  - `npm run verify:phase6:staging`
- Execution log contract:
  - persisted in `CronLog` with `cronName=workflow:{workflowKey}`
  - `resultData` stores trigger snapshot, action statuses, retries, warnings/errors
- Required supported triggers:
  - `cron`
  - `signal_status_changed`
  - `market_threshold`
  - `portfolio_risk_threshold`
  - `brief_ready`
- Required supported actions:
  - `invalidate_topic`
  - `refresh_topic`
  - `run_scanner`
  - `create_notification`
  - `send_telegram`
  - `persist_report`
  - `write_log`
- Deterministic and compliance boundaries:
  - workflow runtime cannot become scheduler owner
  - workflow runtime cannot bypass DNSE compliance/allowlist/kill-switch guards
  - workflow runtime cannot enable real submit by itself

## 12) Hardening & Observability (Phase 7)
- Canonical observability helper:
  - `src/lib/observability.ts`
- Canonical cron health API:
  - `GET /api/admin/system/cron-status`
- Canonical topic freshness API:
  - `GET /api/admin/system/topic-health`
- Canonical admin view:
  - `/admin/cron-health`
- Canonical verification:
  - `npm run verify:phase7:observability`

Logging baseline (minimum):
- DataHub:
  - cache hit/miss/dedupe/refresh/error/invalidate
- Cron:
  - dispatch + persisted run summary + notification/report/webpush outcomes
- Workflow runtime:
  - trigger intake + persisted run status + error path
- Provider runtime:
  - manifest/run fallback paths
- Broker execution:
  - parse/validate/preview/submit decisions in safe/pilot mode

Cron stale baseline:
- evaluated against canonical slot schedule and grace window
- trading-window-only staleness for type1/type2 jobs
- alias rows are compatibility-only and surfaced as legacy usage, not source-of-truth

# ADN Master Architecture Baseline

Status: Canonical  
Version: v1 (docs baseline lock)  
Last updated: 2026-04-20

## 1) Scope Lock
- This baseline documents current ADN runtime architecture and operating policy.
- Real broker submit is **disabled by default** and not part of this baseline rollout.
- No stack rewrite: Next.js + TypeScript + Prisma + PostgreSQL/PgBouncer + Python bridge + Docker Compose remains unchanged.

## 2) Canonical Documents
- Runtime and policy contract: [docs/ops/SOURCE_OF_TRUTH.md](../ops/SOURCE_OF_TRUTH.md)
- Deploy safe runbook: [DEPLOY_SAFE_RUNBOOK.md](../../DEPLOY_SAFE_RUNBOOK.md)
- Production deploy checklist: [docs/ops/PRODUCTION_DEPLOY_CHECKLIST.md](../ops/PRODUCTION_DEPLOY_CHECKLIST.md)
- Decision records index: [docs/architecture/ADR_INDEX.md](./ADR_INDEX.md)

## 3) Architecture Overview
- `web` (Next.js):
  - Owns DataHub topic APIs and cache orchestration.
  - Owns cron execution, Telegram publish, and message-level dispatch dedupe.
  - Owns UI, auth/session, admin/debug views, broker execution gate APIs.
- `fiinquant` (Python bridge):
  - Owns raw provider data and deterministic compute endpoints for web consumption.
  - Must not self-publish Telegram, self-webhook signals, or run publish schedulers in production.
- `db` + `pgbouncer`:
  - `db` is persistent state.
  - `pgbouncer` is pooled connection entry point for app runtime.

## 4) Phase Map (Current Baseline)
- Phase 0: Source-of-truth and runtime/deploy contracts freeze.
- Phase 1: DataHub foundation (`/api/hub/*`, topic core, hooks).
- Phase 2: Topic-based migration for key UI surfaces.
- Phase 3: Ticker workbench model (`research:workbench:{ticker}`).
- Phase 4: Provider manifests contract-first fallback mode.
- Phase 5.1: DNSE execution adapter in safe mode.
- Phase 5.2: Staging-safe verification.
- Phase 5.3: Compliance-gated controlled pilot readiness.
- Phase 5.4: Allowlist pilot runtime verification.
- Phase 6: Workflow automation runtime (JSON-first, event-driven).
- Phase 7: Hardening + observability + canonical cron/topic health operations.

## 5) Runtime Ownership Matrix
| Domain | Owner | Notes |
|---|---|---|
| Topic cache lifecycle | web | TTL, freshness, invalidate, batch reads |
| Hub API | web | `/api/hub/topic/*`, `/api/hub/topics`, `/api/hub/invalidate` |
| Scheduler slots | web | Slot-gated deterministic jobs |
| Market/scan deterministic outputs | fiinquant | AI cannot override |
| Telegram publish | web | Uses `TelegramDispatchLog` idempotency |
| User/session/admin control plane | web | NextAuth/session-based |
| Persistent domain state | db | user/report/signal/broker/audit |

## 6) Scheduler Canonical Contract
Canonical names:
- `signal_scan_type1` (`10:00, 10:30, 14:00, 14:25`)
- `market_stats_type2` (`10:00, 11:30, 14:00, 14:45`)
- `morning_brief` (`08:00`)
- `close_brief_15h` (`15:00`)
- `eod_full_19h` (`19:00`)

Legacy aliases are compatibility-only and not source-of-truth.

## 7) Topic Catalog (Canonical Families)
Public market/research topics:
- `vn:index:overview`
- `vn:index:snapshot`
- `vn:index:breadth:VNINDEX`
- `news:morning:latest`
- `news:eod:latest`
- `signal:radar`
- `signal:active`
- `research:workbench:{ticker}`
- `vn:ta:{ticker}`
- `vn:fa:{ticker}`
- `vn:seasonality:{ticker}`
- `vn:investor:{ticker}`

Private user/broker topics:
- `portfolio:holding:current-user:{ticker}`
- `broker:dnse:{userId}:{accountId}:positions`
- `broker:dnse:{userId}:{accountId}:orders`
- `broker:dnse:{userId}:{accountId}:balance`
- `broker:dnse:{userId}:{accountId}:holdings`

Topic envelope contract:
- `topic`
- `value`
- `updatedAt`
- `expiresAt`
- `freshness`
- `source`
- `version`
- `error` (optional)

## 8) Provider Contracts (Phase 4)
Mode: `CONTRACT_FIRST_FALLBACK_MODE`

Canonical endpoints:
- `GET /api/v1/providers/backtest/manifest`
- `POST /api/v1/providers/backtest/run`
- `GET /api/v1/providers/scanner/manifest`
- `POST /api/v1/providers/scanner/run`

Deterministic policy:
- Deterministic engine output is source-of-truth.
- AI only enriches explanation after deterministic result exists.
- On source failure, return degraded/error contract with explicit warning; no synthetic trading signal.

## 9) Broker Execution Policy (Phase 5)
Mode baseline: `SAFE_EXECUTION_ADAPTER_MODE`

Canonical endpoints:
- `POST /api/v1/brokers/dnse/order-intents/parse`
- `POST /api/v1/brokers/dnse/order-intents/validate`
- `POST /api/v1/brokers/dnse/orders/preview`
- `POST /api/v1/brokers/dnse/orders/submit`

Non-negotiables:
- AI may draft intent only.
- Deterministic gates own decision path.
- Human confirmation required for submit path.
- Real submit disabled by default.

## 10) Rollout, Kill Switch, Allowlist, Compliance
Mandatory controls:
- Allowlist gate (`DNSE_EXECUTION_ALLOWLIST_*`)
- Global kill switch (`DNSE_EXECUTION_KILL_SWITCH`, reason field)
- Compliance gate (`DNSE_COMPLIANCE_APPROVED_FLOW`)
- Safety guards:
  - idempotency
  - replay cooldown
  - duplicate submit protection
  - market session guard
  - max notional guard
  - account binding guard

Pilot posture:
- Controlled pilot only.
- No public execution rollout.
- No real submit default enablement.

## 11) Deploy and Rollback Policy
Normal deploy:
1. `bash deploy/predeploy-check.sh`
2. `bash deploy/safe-web-deploy.sh`
3. `bash deploy/postdeploy-smoke.sh`

Hard rules:
- No `docker-compose down` in normal deploy.
- Web-only blast radius.
- Rollback ref captured before pull/build.
- Rollback command:
  - `bash deploy/rollback-web.sh`
  - or explicit `bash deploy/rollback-web.sh <git-ref>`

## 12) Admin/Debug/Read-Model Guide
Admin DNSE debug:
- API: `GET /api/admin/system/dnse-execution`
- UI: `/admin/dnse-execution`

Minimum operator visibility:
- runtime blockers/readiness
- rollout state (allowlist/kill-switch/compliance)
- parse -> validate -> preview -> submit decision chain
- audit events timeline
- broker topic hydration (`positions/orders/balance/holdings`)
- workflow runtime control plane:
  - `GET /api/admin/system/workflows`
  - `GET /api/admin/system/workflows/runs`
  - `/admin/workflows`
- cron/topic health control plane:
  - `GET /api/admin/system/cron-status`
  - `GET /api/admin/system/topic-health`
  - `/admin/cron-health`

## 13) Superseded and Supporting Documents
Superseded as primary architecture source:
- [ADN_FINCEPT_ARCHITECTURE.md](../../ADN_FINCEPT_ARCHITECTURE.md)
- [ADN_CAPITAL_REBUILD_PLAN_v3.2.md](../../ADN_CAPITAL_REBUILD_PLAN_v3.2.md)

Supporting phase records (not canonical alone):
- [docs/ops/PHASE4_PROVIDER_MANIFESTS.md](../ops/PHASE4_PROVIDER_MANIFESTS.md)
- [docs/ops/PHASE5_DNSE_EXECUTION.md](../ops/PHASE5_DNSE_EXECUTION.md)
- [docs/ops/PHASE5_2_STAGING_VERIFICATION.md](../ops/PHASE5_2_STAGING_VERIFICATION.md)
- [docs/ops/PHASE5_3_CONTROLLED_PILOT.md](../ops/PHASE5_3_CONTROLLED_PILOT.md)
- [docs/ops/PHASE5_4_ALLOWLIST_PILOT.md](../ops/PHASE5_4_ALLOWLIST_PILOT.md)
- [docs/ops/PHASE6_WORKFLOW_RUNTIME.md](../ops/PHASE6_WORKFLOW_RUNTIME.md)
- [docs/ops/WORKFLOW_RUNTIME_OPERATIONS.md](../ops/WORKFLOW_RUNTIME_OPERATIONS.md)
- [docs/ops/PHASE7_HARDENING_OBSERVABILITY.md](../ops/PHASE7_HARDENING_OBSERVABILITY.md)
- [docs/ops/CRON_HEALTH_OPERATIONS.md](../ops/CRON_HEALTH_OPERATIONS.md)

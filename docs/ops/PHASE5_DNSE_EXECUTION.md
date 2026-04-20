# Phase 5 - DNSE Execution Adapter

Status: Supporting phase record  
Canonical references:
- [docs/architecture/ADN_MASTER_ARCHITECTURE.md](../architecture/ADN_MASTER_ARCHITECTURE.md)
- [docs/ops/SOURCE_OF_TRUTH.md](./SOURCE_OF_TRUTH.md)

## 1) Current execution baseline
- Mode: `SAFE_EXECUTION_ADAPTER_MODE`
- Real submit default: `OFF`
- Manual token mode default: `OFF`
- Compliance gate default: `DNSE_COMPLIANCE_APPROVED_FLOW=false`

## 2) Canonical APIs
- `POST /api/v1/brokers/dnse/order-intents/parse`
- `POST /api/v1/brokers/dnse/order-intents/validate`
- `POST /api/v1/brokers/dnse/orders/preview`
- `POST /api/v1/brokers/dnse/orders/submit`

## 3) Deterministic boundary
- AI may propose intent drafts only.
- Deterministic gate owns validation, preview, submit decision.
- Human confirmation is mandatory for submit (`confirm=true`, `confirmationText=CONFIRM`).
- If submit is not enabled, API must return deterministic blocked status (`blocked_not_enabled` or `approval_required`).

## 4) Runtime flags (safe defaults)
- `DNSE_EXECUTION_MODE=SAFE_EXECUTION_ADAPTER_MODE`
- `DNSE_ORDER_INTENT_ENABLED=true`
- `DNSE_ORDER_PREVIEW_ENABLED=true`
- `DNSE_REAL_ORDER_SUBMIT_ENABLED=false`
- `DNSE_MANUAL_TEST_TOKEN_MODE=false`
- `DNSE_COMPLIANCE_APPROVED_FLOW=false`
- `DNSE_ALLOW_REAL_SUBMIT_IN_PROD=false`
- `DNSE_ALLOW_MANUAL_TEST_IN_PROD=false`
- `DNSE_MAX_ORDER_NOTIONAL=...`
- `DNSE_ORDER_REPLAY_COOLDOWN_MS=...`
- `DNSE_DUPLICATE_SUBMIT_WINDOW_MS=...`
- `DNSE_ENFORCE_MARKET_SESSION_GUARD=true`

## 5) Audit and debug
- Audit source: `Changelog(component=DNSE_EXECUTION)`
- Admin debug API:
  - `GET /api/admin/system/dnse-execution`
- Admin debug UI:
  - `/admin/dnse-execution`
- Read model includes:
  - latest parse/validate/preview/submit
  - full events list
  - decision chains grouped by intent/preview
  - topic hydration state (`positions/orders/balance/holdings`)

## 6) Phase 5.2 recap
- Staging-safe flow verified in SAFE mode.
- Submit remains blocked by design unless compliance + explicit runtime gates are enabled.

## 7) Phase 5.3 - compliance gated controlled pilot
- Pilot scope:
  - not public
  - real submit still OFF by default
  - allowlisted accounts/users only can move beyond baseline guard path
- Allowlist contract (env + DB-safe setting source):
  - `DNSE_EXECUTION_ALLOWLIST_ENFORCED`
  - `DNSE_EXECUTION_ALLOWLIST_USER_IDS`
  - `DNSE_EXECUTION_ALLOWLIST_ACCOUNT_IDS`
  - `DNSE_EXECUTION_ALLOWLIST_EMAILS`
- Kill switch:
  - `DNSE_EXECUTION_KILL_SWITCH`
  - `DNSE_EXECUTION_KILL_SWITCH_REASON`
  - when ON, parse/validate/preview/submit are blocked immediately
- Compliance gate:
  - if compliance flow is not approved, any branch that can reach real submit returns `approval_required`
- Safety checklist:
  - idempotency
  - replay cooldown
  - duplicate submit protection
  - market session guard
  - max notional guard
  - account binding guard

## 8) Pilot-ready but not enabled criteria
- Build passes.
- Runtime validator passes (or reports explicit missing runtime dependency).
- Admin debug API/UI expose rollout + blockers clearly.
- Safe submit response shape is deterministic and auditable.
- Real submit remains OFF until compliance sign-off and explicit rollout decision.

## 9) Phase 5.4 - allowlist pilot runtime verification
- Runtime verification is executed with real sessions in pilot/staging runtime.
- Canonical script:
  - `npm run verify:phase5:pilot-runtime`
- Mandatory cases:
  - allowlist positive case
  - allowlist negative case
  - kill switch ON/OFF case
  - preview success case
  - submit blocked case with explicit reason
  - admin/debug + decision chain + topic hydration case
- If compliance flow is still not approved:
  - submit remains blocked
  - this is expected and must be reported as non-public pilot state

## 10) Observability alignment (Phase 7)
- DNSE execution APIs emit structured observability logs (`domain=broker`) for:
  - parse intent
  - validate intent
  - preview order
  - submit blocked/result
- Deterministic audit trail remains canonical in `Changelog(component=DNSE_EXECUTION)`.
- Ops correlation path:
  - `/api/admin/system/dnse-execution`
  - `/api/admin/system/cron-status`
  - `/api/admin/system/topic-health`

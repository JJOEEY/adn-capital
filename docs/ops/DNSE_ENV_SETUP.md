# DNSE Environment Setup (Pilot)

Status: Canonical env contract for pilot-safe DNSE runtime.

## Required Runtime
- Postgres-backed `DATABASE_URL`
- direct DB connection via `DIRECT_DATABASE_URL`
- auth/session runtime configured
- admin access enabled for debug routes
- DNSE API key runtime:
  - `DNSE_API_KEY`
  - `DNSE_TRADING_BASE_URL`
  - `DNSE_TOKEN_ENCRYPTION_KEY`

## DNSE Execution Flags (safe defaults)
```env
DNSE_EXECUTION_MODE=SAFE_EXECUTION_ADAPTER_MODE
DNSE_ORDER_INTENT_ENABLED=true
DNSE_ORDER_PREVIEW_ENABLED=true
DNSE_REAL_ORDER_SUBMIT_ENABLED=false
DNSE_COMPLIANCE_APPROVED_FLOW=false
DNSE_EXECUTION_ALLOWLIST_ENFORCED=true
DNSE_EXECUTION_KILL_SWITCH=false
DNSE_ALLOW_REAL_SUBMIT_IN_PROD=false
DNSE_ALLOW_MANUAL_TEST_IN_PROD=false
```

## Real-time Broker Data Endpoints (API key + linked account)
- `DNSE_BROKER_ACCOUNT_PROFILE_URL`
- `DNSE_BROKER_BALANCE_URL`
- `DNSE_BROKER_HOLDINGS_URL`
- `DNSE_BROKER_POSITIONS_URL`
- `DNSE_BROKER_ORDERS_URL`
- `DNSE_ORDER_SUBMIT_URL` (for pilot real submit path, still guarded by compliance + allowlist + kill switch)

## Allowlist Config
Use one or more:
- `DNSE_EXECUTION_ALLOWLIST_USER_IDS`
- `DNSE_EXECUTION_ALLOWLIST_ACCOUNT_IDS`
- `DNSE_EXECUTION_ALLOWLIST_EMAILS`

## Safety Notes
- Never set `DNSE_REAL_ORDER_SUBMIT_ENABLED=true` without signed approval.
- Never store broker secrets in docs, code, or prompts.
- Any manual test mode must be non-production and explicitly logged.

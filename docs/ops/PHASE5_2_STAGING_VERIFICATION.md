# Phase 5.2 — Staging Verification Checklist

## A) Runtime dependencies (must pass)
- PostgreSQL env:
  - `DATABASE_URL` starts with `postgresql://` or `postgres://`
  - `DIRECT_DATABASE_URL` starts with `postgresql://` or `postgres://`
- Auth/session env:
  - `NEXTAUTH_URL` is set
  - `AUTH_TRUST_HOST=true` (recommended behind proxy/local)
- DNSE env:
  - `DNSE_API_KEY` set
  - `DNSE_EXECUTION_MODE=SAFE_EXECUTION_ADAPTER_MODE`
  - `DNSE_REAL_ORDER_SUBMIT_ENABLED=false` (default)
  - `DNSE_MANUAL_TEST_TOKEN_MODE=false` (default)
  - `DNSE_COMPLIANCE_APPROVED_FLOW=false` (default unless approved)
- Data prerequisite:
  - at least 1 user has `dnseVerified=true` and non-empty `dnseId`

Quick check command:
```bash
npm run verify:phase5:runtime
```

## B) Safe-mode smoke flow
Automated command (requires real session credentials):
```bash
PHASE5_USER_EMAIL=... \
PHASE5_USER_PASSWORD=... \
PHASE5_ADMIN_EMAIL=admin@adncapital.com.vn \
PHASE5_ADMIN_PASSWORD=admin123 \
BASE_URL=http://127.0.0.1:3000 \
node scripts/phase5-staging-safe-smoke.mjs
```

1. Login bằng session thật (admin hoặc user có DNSE connect).
2. Parse:
   - `POST /api/v1/brokers/dnse/order-intents/parse`
   - expect `200` with deterministic `validation`.
3. Validate:
   - `POST /api/v1/brokers/dnse/order-intents/validate`
   - expect `200` and deterministic `validation.status`.
4. Preview:
   - `POST /api/v1/brokers/dnse/orders/preview`
   - expect `200`, `ticket.preview.previewId`.
5. Submit (safe mode):
   - `POST /api/v1/brokers/dnse/orders/submit`
   - with `previewId`, `confirm=true`, `confirmationText=CONFIRM`
   - expected safe result:
     - `status=blocked_not_enabled` OR
     - `status=approval_required`
   - must NOT return fake `accepted` while flags are safe default.

## C) Read model + audit checks
- Open `/admin/dnse-execution` (admin only).
- Verify sections:
  - runtime dependency audit
  - topic hydration table
  - latest parse/validate/preview/submit snapshot
  - audit event stream
- API equivalent:
  - `GET /api/admin/system/dnse-execution`

## D) Broker topic hydration contract
For connected user/account, verify topics resolve with envelope:
- `broker:dnse:{userId}:{accountId}:positions`
- `broker:dnse:{userId}:{accountId}:orders`
- `broker:dnse:{userId}:{accountId}:balance`
- `broker:dnse:{userId}:{accountId}:holdings`

Expected envelope fields:
- `topic`
- `source`
- `freshness`
- `hasValue`
- `error`
- `updatedAt`
- `expiresAt`

## E) Manual token mode (optional, staging only)
- Allowed only when explicitly set in staging:
  - `DNSE_MANUAL_TEST_TOKEN_MODE=true`
  - `DNSE_ALLOW_MANUAL_TEST_IN_PROD=false` (keep default)
- Must never be default ON.
- Runtime logs must clearly indicate manual test mode is active.

## F) Compliance guard
- If OTP/trading-token flow has not been compliance approved:
  - keep `DNSE_COMPLIANCE_APPROVED_FLOW=false`
  - keep execution in safe-gated mode
  - do not enable public real submit.

## G) Current local run blockers (this workspace)
- `/api/health` => `503` because DB env is not PostgreSQL in current local `.env`.
- `DATABASE_URL` currently points to non-PostgreSQL protocol.
- `DIRECT_DATABASE_URL` is missing.
- Session-required routes return `401` without authenticated session.
- Admin debug route returns `403` without admin session cookie.

## H) Staging-safe verdict rule
- `PHASE5_2_STAGING_VERIFIED`:
  - runtime validator ready
  - parse/validate/preview/submit safe-mode smoke passed with real session
  - audit trail visible
  - admin debug route/page verified
- `PHASE5_2_BLOCKED_BY_RUNTIME`:
  - any missing env/session/DB/user-link requirement
- `PHASE5_2_BLOCKED_BY_COMPLIANCE`:
  - runtime OK, but compliance-approved flow required to proceed beyond safe gate and is unavailable

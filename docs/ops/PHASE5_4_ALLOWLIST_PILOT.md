# Phase 5.4 - ALLOWLIST_PILOT_RUNTIME_VERIFICATION

## 1) Pilot scope
- Objective: verify controlled pilot on real runtime/session, not public launch.
- Public execution: OFF.
- Real submit mass-enable: OFF.
- Deterministic gate remains source-of-truth.

## 2) Required runtime checklist (operator)
Use this before running pilot verification:

### Environment
- `DATABASE_URL` points to postgres/pgbouncer.
- `DIRECT_DATABASE_URL` points to direct postgres db.
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET`/`AUTH_SECRET`, `AUTH_TRUST_HOST=true`.
- `DNSE_EXECUTION_MODE=SAFE_EXECUTION_ADAPTER_MODE`.
- `DNSE_REAL_ORDER_SUBMIT_ENABLED=false`.
- `DNSE_COMPLIANCE_APPROVED_FLOW=false` (unless compliance explicitly approved for pilot branch).
- `DNSE_ALLOW_REAL_SUBMIT_IN_PROD=false`.
- `DNSE_ALLOW_MANUAL_TEST_IN_PROD=false`.
- `DNSE_ENFORCE_MARKET_SESSION_GUARD=true`.
- `DNSE_DUPLICATE_SUBMIT_WINDOW_MS>0`.

### Credentials & accounts
- Pilot allowlist user credentials:
  - `PHASE5_ALLOWLIST_USER_EMAIL`
  - `PHASE5_ALLOWLIST_USER_PASSWORD`
- Admin credentials:
  - `PHASE5_ADMIN_EMAIL`
  - `PHASE5_ADMIN_PASSWORD`
- Optional outsider credentials (recommended):
  - `PHASE5_OUTSIDER_EMAIL`
  - `PHASE5_OUTSIDER_PASSWORD`
- Pilot user must have `dnseId` and `dnseVerified=true`.

### Rollout controls
- `DNSE_EXECUTION_ALLOWLIST_ENFORCED=true`
- allowlist has at least 1 identity (userId/accountId/email)
- `DNSE_EXECUTION_KILL_SWITCH=false` for baseline verification

## 3) Operator commands
1. Build:
```bash
npm run build
```

2. Runtime readiness:
```bash
npm run verify:phase5:runtime
```

3. Pilot runtime verification:
```bash
PHASE5_ALLOWLIST_USER_EMAIL=...
PHASE5_ALLOWLIST_USER_PASSWORD=...
PHASE5_ADMIN_EMAIL=...
PHASE5_ADMIN_PASSWORD=...
PHASE5_OUTSIDER_EMAIL=...            # optional
PHASE5_OUTSIDER_PASSWORD=...         # optional
npm run verify:phase5:pilot-runtime
```

## 4) Cases verified by pilot runtime script
- Inside allowlist:
  - parse/validate/preview succeed.
  - submit is still blocked by safe/compliance gate with deterministic reason.
- Outside allowlist:
  - submit blocked with `pilot_allowlist_required`.
  - if outsider creds absent, script uses temporary allowlist-mismatch path on same user.
- Kill switch ON:
  - parse blocked immediately with `execution_kill_switch_enabled` and HTTP 503.
- Kill switch OFF:
  - flow resumes to normal pilot guard path.
- Admin debug:
  - decision chain available.
  - runtime rollout state visible.
  - topic hydration has positions/orders/balance/holdings.

## 5) How to operate allowlist / kill switch
Use admin settings API/UI:
- keys:
  - `DNSE_EXECUTION_ALLOWLIST_ENFORCED`
  - `DNSE_EXECUTION_ALLOWLIST_USER_IDS`
  - `DNSE_EXECUTION_ALLOWLIST_ACCOUNT_IDS`
  - `DNSE_EXECUTION_ALLOWLIST_EMAILS`
  - `DNSE_EXECUTION_KILL_SWITCH`
  - `DNSE_EXECUTION_KILL_SWITCH_REASON`

## 6) Remaining blockers before real submit
Real submit remains blocked until all are true:
- compliance-approved execution flow is signed-off
- explicit production override is enabled intentionally
- broker/legal/ops approval for limited scope rollout

Until then expected final state is:
- pilot runtime verified
- real submit not enabled publicly

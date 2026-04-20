# Pilot Ops Dry-Run Report (2026-04-20)

Status: Fail (runtime blocked)  
Scope: Step 3 in post-roadmap execution order

## Test Sequence
Expected sequence:
1. onboard allowlist user
2. verify DNSE linked account
3. verify broker topic hydration
4. parse -> validate -> preview
5. submit blocked by policy
6. verify admin debug + audit trail
7. kill switch on -> all blocked
8. kill switch off
9. remove allowlist -> blocked outside allowlist

## Actual Execution
- `npm run verify:phase5:runtime` executed.
- `npm run verify:phase5:pilot-runtime` executed.

## Results
- `verify:phase5:runtime`: **NOT READY**
  - blockers:
    - `missing_or_invalid_DATABASE_URL`
    - `missing_or_invalid_DIRECT_DATABASE_URL`
    - `AUTH_TRUST_HOST_should_be_true_for_staging_proxy_runtime`
    - `pilot_allowlist_empty`
  - warnings:
    - `missing_DNSE_API_KEY`
- `verify:phase5:pilot-runtime`: **FAILED**
  - error:
    - `missing PHASE5_ALLOWLIST_USER_EMAIL or PHASE5_ALLOWLIST_USER_PASSWORD`

## Runtime Issue List
1. Postgres env contract not satisfied in current runtime.
2. `AUTH_TRUST_HOST` not set to expected runtime value.
3. Pilot allowlist is empty.
4. Pilot verification credentials are missing.
5. DNSE API key unavailable in current validation context.

## Action Required
1. Set valid postgres `DATABASE_URL` and `DIRECT_DATABASE_URL`.
2. Set `AUTH_TRUST_HOST=true` for staging/pilot runtime.
3. Populate allowlist (user/account/email).
4. Provide pilot test credentials for verifier.
5. Re-run:
   - `npm run verify:phase5:runtime`
   - `npm run verify:phase5:pilot-runtime`

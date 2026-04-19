# Phase 5.3 - Controlled Pilot (Compliance Gated)

## Purpose
Move execution from pure staging-safe into controlled pilot readiness, while keeping public rollout disabled and keeping real submit OFF by default.

## Runtime model
- Base mode stays `SAFE_EXECUTION_ADAPTER_MODE`.
- Controlled pilot adds rollout gates on top:
  - allowlist gate
  - global kill switch
  - compliance gate

## Rollout guards
### Allowlist
- Enforced by:
  - `DNSE_EXECUTION_ALLOWLIST_ENFORCED=true`
- Identity sources:
  - `DNSE_EXECUTION_ALLOWLIST_USER_IDS`
  - `DNSE_EXECUTION_ALLOWLIST_ACCOUNT_IDS`
  - `DNSE_EXECUTION_ALLOWLIST_EMAILS`
- Source merge:
  - env values
  - DB-backed system settings with same keys
- Matching:
  - `userId` OR `accountId` OR `email`

### Kill switch
- `DNSE_EXECUTION_KILL_SWITCH`
- `DNSE_EXECUTION_KILL_SWITCH_REASON`
- Behavior:
  - parse/validate/preview/submit return blocked immediately
  - status must be visible in admin debug API/UI

### Compliance gate
- Real submit must never pass unless compliance-approved flow is explicitly enabled.
- If branch reaches potential real submit without compliance approval:
  - return `approval_required`
  - include deterministic reason in response and audit

## Safety guards
- Idempotency cache for submit.
- Replay cooldown guard.
- Duplicate submit window guard.
- Market session guard.
- Max notional guard.
- Account binding guard against linked DNSE account.

## Admin read model and observability
- `GET /api/admin/system/dnse-execution`
  - runtime dependencies
  - rollout state (allowlist, kill switch, compliance)
  - topic hydration contract
  - events + decision chain
  - query filters: user/account/ticker/actions/time
- `/admin/dnse-execution`
  - visual status for readiness and rollout blockers

## Validation checklist
1. `npm run build`
2. `npm run verify:phase5:runtime`
3. `npm run verify:phase5:staging-smoke` (environment with valid session + DNSE linked account)
4. Verify:
   - allowlist guard
   - kill switch guard
   - submit blocked outside allowlist
   - admin/debug visibility
   - audit decision chain integrity

## Expected verdict logic
- `PHASE5_3_PILOT_READY_NOT_ENABLED`:
  - controlled pilot code path complete
  - safe-mode/allowlist/kill-switch/compliance guards active
  - real submit remains OFF
- `PHASE5_3_ENABLED_FOR_ALLOWLIST_ONLY`:
  - explicitly approved rollout with allowlist-only enablement
  - still not public
- `PHASE5_3_BLOCKED_BY_COMPLIANCE`:
  - compliance/legal execution flow not approved for real submit

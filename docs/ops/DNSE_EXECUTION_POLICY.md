# DNSE Execution Policy

Status: Canonical policy for DNSE execution runtime behavior.

## Allowed Runtime Modes
- `SAFE_EXECUTION_ADAPTER_MODE` (default and current canonical mode)
- controlled pilot mode with allowlist + compliance gate

Public real submit is not allowed by default.

## Deterministic Boundary
- AI may draft intent text only.
- Deterministic services own parse/validate/preview/submit decision.
- No AI override over lifecycle/risk/compliance gates.

## Mandatory Guards
- allowlist enforcement
- global kill switch
- compliance gate
- market-session guard
- max-notional guard
- account-binding guard
- idempotency + replay cooldown + duplicate submit protection

## Submit Decision Contract
- If runtime is safe mode: submit returns `blocked_not_enabled`.
- If compliance not approved: submit returns `approval_required`.
- If allowlist fails: submit returns `pilot_allowlist_required`.
- If kill switch enabled: submit returns `execution_kill_switch_active`.

No fake success responses are permitted.

## Audit Requirements
Every parse/validate/preview/submit path must produce:
- actor (user/admin/system)
- account binding context
- deterministic decision
- policy reason code
- timestamp and trace id

## Production Enablement Constraint
`DNSE_REAL_ORDER_SUBMIT_ENABLED=true` is forbidden unless:
- all approvals in `REAL_SUBMIT_APPROVAL_MATRIX.md` are complete
- `REAL_SUBMIT_ENABLEMENT_CHECKLIST.md` is fully passed

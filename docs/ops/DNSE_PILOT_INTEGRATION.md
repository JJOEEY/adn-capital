# DNSE Pilot Integration

Status: Canonical integration guide for pilot-safe DNSE runtime only.

## Scope
Allowed:
- staging/pilot environment setup
- linked-account verification
- broker topic hydration verification
- safe-mode parse/validate/preview/submit-blocked verification

Not allowed:
- public rollout of execution
- default enablement of real submit
- bypass of allowlist/kill-switch/compliance gates

## Pilot Env Contract
- `DNSE_EXECUTION_MODE=SAFE_EXECUTION_ADAPTER_MODE`
- `DNSE_ORDER_INTENT_ENABLED=true`
- `DNSE_ORDER_PREVIEW_ENABLED=true`
- `DNSE_REAL_ORDER_SUBMIT_ENABLED=false`
- `DNSE_COMPLIANCE_APPROVED_FLOW=false` (until formal approval)
- `DNSE_EXECUTION_ALLOWLIST_ENFORCED=true`
- `DNSE_EXECUTION_KILL_SWITCH=false` (operational default)

Optional integration keys depend on runtime provider policy and must follow secret handling policy.

## Runtime Checks
1. Linked account is valid and visible in broker context.
2. Positions/orders/balance/holdings topics hydrate with freshness metadata.
3. parse/validate/preview return deterministic success where applicable.
4. submit remains blocked with explicit reason.
5. admin/debug pages show full decision chain and blockers.

## Deterministic Guarantee
No real order submission path is allowed in this guide.

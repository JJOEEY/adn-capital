# Compliance Pack

Status: Post-roadmap operations track A (canonical for execution policy readiness)

## Scope
This pack defines mandatory compliance and governance controls before any real broker execution can be enabled.

## Required Artifacts
- [REAL_SUBMIT_APPROVAL_MATRIX.md](./REAL_SUBMIT_APPROVAL_MATRIX.md)
- [DNSE_EXECUTION_POLICY.md](./DNSE_EXECUTION_POLICY.md)
- [BROKER_SECRET_HANDLING_POLICY.md](./BROKER_SECRET_HANDLING_POLICY.md)
- [KILL_SWITCH_DRILL.md](./KILL_SWITCH_DRILL.md)
- [REAL_SUBMIT_ENABLEMENT_CHECKLIST.md](./REAL_SUBMIT_ENABLEMENT_CHECKLIST.md)

## Non-Negotiable Gates
Real submit stays OFF unless all conditions below are true:
1. Compliance-approved OTP/trading-token flow is documented and tested.
2. Legal sign-off is approved and timestamped.
3. Operations sign-off is approved and timestamped.
4. Allowlist-only rollout plan is approved.
5. Kill-switch drill is passed in runtime.
6. Audit trail verification is passed.
7. `DNSE_REAL_ORDER_SUBMIT_ENABLED=true` is explicitly approved.

## Runtime Defaults (must remain)
- `DNSE_EXECUTION_MODE=SAFE_EXECUTION_ADAPTER_MODE`
- `DNSE_REAL_ORDER_SUBMIT_ENABLED=false`
- `DNSE_COMPLIANCE_APPROVED_FLOW=false` (unless signed off)
- `DNSE_EXECUTION_ALLOWLIST_ENFORCED=true`
- `DNSE_EXECUTION_KILL_SWITCH=false` (operational default)

## Definition Of Done
Track A is complete only when:
- approval matrix exists and has named owners
- secret handling policy is approved
- execution policy is approved
- kill-switch drill procedure is documented and tested
- real-submit enablement checklist is approved

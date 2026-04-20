# Real Submit Enablement Checklist

Status: Required checklist before setting `DNSE_REAL_ORDER_SUBMIT_ENABLED=true`.

## Approval Gates
- [ ] compliance approval complete
- [ ] legal approval complete
- [ ] operations approval complete
- [ ] engineering approval complete

## Policy/Process Gates
- [ ] OTP/trading-token flow approved and documented
- [ ] allowlist-only rollout scope approved
- [ ] kill-switch drill passed
- [ ] incident rollback path verified
- [ ] audit trail chain verified end-to-end

## Runtime Gates
- [ ] `DNSE_COMPLIANCE_APPROVED_FLOW=true` approved
- [ ] `DNSE_ALLOW_REAL_SUBMIT_IN_PROD=true` approved
- [ ] real-submit toggle change ticket created
- [ ] realtime monitoring/alerting active

## Final Action
Only after all boxes are checked:
- set `DNSE_REAL_ORDER_SUBMIT_ENABLED=true` in approved scope
- publish enablement notice with approver references

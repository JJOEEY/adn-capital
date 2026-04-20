# Pilot Support Runbook

Status: Canonical troubleshooting path for pilot-safe DNSE execution.

## Common Support Cases
- parse failed
- validate failed
- preview mismatch
- submit blocked
- topic stale/hydration drift
- linked account mismatch

## Triage Sequence
1. Confirm user/account is still in allowlist.
2. Confirm kill switch state.
3. Confirm compliance gate and real-submit flags.
4. Check `/admin/dnse-execution` decision chain for latest request.
5. Check `/api/admin/system/topic-health` and broker topic freshness.
6. Check audit events for policy reason code.

## Expected Submit Outcomes In Pilot
- `blocked_not_enabled`
- `approval_required`
- `pilot_allowlist_required`
- `execution_kill_switch_active`

Any unexpected success result is SEV1.

## Required Evidence In Ticket
- user/account id
- endpoint + trace id
- policy reason code
- timestamp
- screenshot/export from admin debug view

# Kill Switch Drill

Status: Canonical operational drill for execution shutdown readiness.

## Objective
Verify the team can stop execution paths immediately and confirm deterministic blocking end-to-end.

## Preconditions
- admin access available
- runtime health green
- allowlist enforcement ON
- real submit remains OFF in pilot-safe mode

## Drill Steps
1. Set:
   - `DNSE_EXECUTION_KILL_SWITCH=true`
   - `DNSE_EXECUTION_KILL_SWITCH_REASON=<incident-or-drill-id>`
2. Trigger parse/validate/preview/submit test requests.
3. Verify all execution entry points return kill-switch blocked status.
4. Verify admin/debug views show kill-switch active state and reason.
5. Verify audit trail contains kill-switch policy reason.
6. Reset:
   - `DNSE_EXECUTION_KILL_SWITCH=false`
   - clear/rotate reason field for next run.

## Pass Criteria
- all entry points blocked consistently
- policy reason surfaced in API + audit/debug view
- no bypass path observed

## Failure Actions
- stop pilot access immediately
- open incident and block execution changes until fix is verified

## Cadence
- run monthly for pilot period
- run immediately before any real-submit enablement decision

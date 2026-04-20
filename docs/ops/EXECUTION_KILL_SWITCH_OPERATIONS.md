# Execution Kill Switch Operations

Status: Canonical operational steps to stop execution safely.

## Trigger Conditions
- unexpected submit behavior
- policy bypass suspicion
- credential compromise suspicion
- unresolved severe runtime drift

## Activation Procedure
1. Set kill switch ON.
2. Set reason and incident id.
3. Verify parse/validate/preview/submit all blocked.
4. Notify ops/compliance/engineering.

## Verification
- API responses return kill-switch reason code.
- admin debug page reflects switch state.
- audit events include activation and blocked actions.

## Recovery Procedure
1. resolve root cause
2. verify fix in safe mode
3. obtain re-enable approval
4. switch OFF in approved window
5. run smoke and publish status

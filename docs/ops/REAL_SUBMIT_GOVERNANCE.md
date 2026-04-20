# Real Submit Governance

Status: Canonical governance baseline before any real broker execution enablement.

## Purpose
Define how real submit can be enabled in a controlled, auditable, allowlist-only manner after explicit sign-off.

## Hard Rule
Completing this governance track does not automatically enable real submit.

## Mandatory References
- [REAL_SUBMIT_ENABLEMENT_CHECKLIST.md](./REAL_SUBMIT_ENABLEMENT_CHECKLIST.md)
- [EXECUTION_KILL_SWITCH_OPERATIONS.md](./EXECUTION_KILL_SWITCH_OPERATIONS.md)
- [POST_EXECUTION_AUDIT_PLAYBOOK.md](./POST_EXECUTION_AUDIT_PLAYBOOK.md)
- [REAL_SUBMIT_APPROVAL_MATRIX.md](./REAL_SUBMIT_APPROVAL_MATRIX.md)

## Rollout Model
1. allowlist-only cohort
2. explicit approved enablement window
3. strict runtime monitors and audit review
4. immediate stop condition via kill switch

## Runtime Guards Required Even After Enablement
- idempotency
- replay cooldown
- duplicate submit protection
- market session guard
- max notional guard
- account binding guard

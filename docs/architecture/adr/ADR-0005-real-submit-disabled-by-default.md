# ADR-0005: Real Submit Disabled By Default

Status: Accepted  
Date: 2026-04-20

## Decision
Real DNSE order submission is disabled by default across environments.

## Rationale
Prevents accidental broker-side execution before legal/compliance/ops approval.

## Consequences
- Default runtime flags keep real submit OFF.
- Any enablement requires explicit, auditable opt-in and guarded rollout.

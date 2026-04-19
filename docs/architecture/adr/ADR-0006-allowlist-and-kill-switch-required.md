# ADR-0006: Allowlist And Kill Switch Required

Status: Accepted  
Date: 2026-04-20

## Decision
Allowlist enforcement and global kill switch are mandatory controls for pilot execution.

## Rationale
Controlled pilot requires immediate blast-radius control and deterministic block behavior.

## Consequences
- Only allowlisted identities can pass pilot gates.
- Kill switch can stop all execution entry points immediately.
- Admin/debug surfaces must expose guard states and decision reasons.

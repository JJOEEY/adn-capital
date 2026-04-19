# ADR-0004: Safe Execution Adapter Mode

Status: Accepted  
Date: 2026-04-20

## Decision
DNSE execution baseline remains `SAFE_EXECUTION_ADAPTER_MODE`.

## Rationale
Real submit requires compliance-approved flow and controlled rollout gates.

## Consequences
- Parse/validate/preview are available for deterministic operator workflows.
- Submit path remains blocked with explicit deterministic status unless approvals exist.

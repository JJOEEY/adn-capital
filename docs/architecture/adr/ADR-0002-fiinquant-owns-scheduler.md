# ADR-0002: Fiinquant Owns Scheduler

Status: Accepted  
Date: 2026-04-20

## Decision
`fiinquant` is the canonical owner of slot-gated scheduler jobs.

## Rationale
Deterministic scanner/brief execution belongs to compute runtime, not UI runtime.

## Consequences
- `web` does not run parallel cron copies for same job family.
- Canonical job names and slot contracts are enforced centrally.

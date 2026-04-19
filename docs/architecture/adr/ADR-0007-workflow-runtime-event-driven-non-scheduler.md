# ADR-0007: Workflow Runtime Is Event-Driven And Non-Scheduler

Status: Accepted  
Date: 2026-04-20

## Decision
Phase 6 workflow runtime is implemented in `web` as an event-driven JSON-first runner and does not own scheduler loops.

## Rationale
Avoid creating a second scheduler that competes with `fiinquant`, while still enabling operational automation via trigger/action registry.

## Consequences
- Canonical cron schedule remains owned by `fiinquant`.
- Workflow runtime consumes events (`cron`, `brief_ready`, `signal_status_changed`, etc.) and executes actions.
- Retry and execution logging are local to workflow runs, not a separate queue infrastructure.

# ADN Roadmap Status

## Release Milestone
- Tag: `roadmap-0-7-complete`
- Phase 0-7: complete
- DNSE real submit: not enabled
- Controlled pilot: verified
- Next track: compliance + ops governance

## Current Runtime State
- Execution mode: `SAFE_EXECUTION_ADAPTER_MODE`
- Workflow runtime: staging verified
- Observability / cron health: complete
- DataHub owner: `web`
- Scheduler owner: `fiinquant`

## Canonical Docs (Frozen)
- `docs/architecture/ADN_MASTER_ARCHITECTURE.md`
- `docs/ops/SOURCE_OF_TRUTH.md`
- `DEPLOY_SAFE_RUNBOOK.md`
- `docs/ops/PRODUCTION_DEPLOY_CHECKLIST.md`

## Historical / Superseded
- `ADN_FINCEPT_ARCHITECTURE.md`
- `ADN_CAPITAL_REBUILD_PLAN_v3.2.md`

## Before Real Submit
Required before enabling any real broker execution:
- compliance-approved OTP / trading-token flow
- legal / ops sign-off
- allowlist-only rollout decision
- kill switch drill verified
- explicit enablement of `DNSE_REAL_ORDER_SUBMIT_ENABLED=true`

## Scope Guard From This Point
Do not open new architecture branches.

Allowed task types:
- compliance pack
- pilot operations handbook
- release notes
- bugfix/runtime tuning
- real-submit governance (only with explicit sign-off)

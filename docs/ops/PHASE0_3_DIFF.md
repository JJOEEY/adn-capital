# Phase 0–3 Diff Review

Status: Historical evidence record (supporting only)  
Canonical references:
- [docs/architecture/ADN_MASTER_ARCHITECTURE.md](../architecture/ADN_MASTER_ARCHITECTURE.md)
- [docs/ops/SOURCE_OF_TRUTH.md](./SOURCE_OF_TRUTH.md)

## Commit range
- Start baseline: `4a715cb`
- End phase 0–3 deploy: `90d58b1`

## Commits included
1. `88d7651` — fix(dashboard): correct composite liquidity and improve morning/eod brief rendering
2. `56df7dc` — fix(data): stabilize dashboard brief sources and prevent stale liquidity mismatches
3. `22dcdd0` — fix(dashboard): harden morning/eod payload parsing and liquidity consistency
4. `90d58b1` — feat: deploy phase0-3 datahub workbench migration

## Diff stats
- `63 files changed, 11068 insertions(+), 935 deletions(-)`

## Core proof by phase

### Phase 0 — Source-of-truth + contracts
- `docs/ops/SOURCE_OF_TRUTH.md`
- `DEPLOY_SAFE_RUNBOOK.md`
- `src/lib/cron-contracts.ts`

### Phase 1 — DataHub core + APIs + hooks
- `src/lib/datahub/core.ts`
- `src/lib/datahub/producer-context.ts`
- `src/lib/datahub/registry.ts`
- `src/lib/datahub/types.ts`
- `src/app/api/hub/topic/[...topic]/route.ts`
- `src/app/api/hub/topics/route.ts`
- `src/app/api/hub/invalidate/route.ts`
- `src/hooks/useTopic.ts`
- `src/hooks/useTopics.ts`

### Phase 2 — Migrate key screens to topic-based
- `src/app/dashboard/page.tsx`
- `src/app/terminal/page.tsx`
- `src/app/rs-rating/page.tsx`
- `src/app/dashboard/rs-rating/page.tsx`
- `src/components/signals/SignalMapClient.tsx`
- `src/app/portfolio/page.tsx`

### Phase 3 — Ticker workbench 8 tabs
- `src/app/stock/[ticker]/page.tsx`
  - Tabs: `overview`, `ta`, `fa`, `sentiment`, `news`, `seasonality`, `signal`, `portfolio`
  - Main aggregate topic: `research:workbench:{ticker}`
  - User overlay topic: `portfolio:holding:current-user:{ticker}`

## Full name-status diff
```bash
git diff --name-status 4a715cb..90d58b1
```

## Quick verification commands
```bash
git log --oneline 4a715cb..90d58b1
git diff --shortstat 4a715cb..90d58b1
```

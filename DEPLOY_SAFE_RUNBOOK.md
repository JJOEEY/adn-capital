# ADN Capital Safe Deploy Runbook
Reference contract: [docs/ops/SOURCE_OF_TRUTH.md](docs/ops/SOURCE_OF_TRUTH.md)

## Hard Rules
1. Never run `docker-compose down` in normal deploy flow.
2. Normal deploy only rebuilds/restarts `web`.
3. Canonical bridge env is `PYTHON_BRIDGE_URL` (`FIINQUANT_URL` is compatibility fallback only).
4. `DATABASE_URL` must point to `@pgbouncer:5432`.
5. `DIRECT_DATABASE_URL` must point to `@db:5432`.
6. Canonical cron names:
   - `signal_scan_type1`
   - `market_stats_type2`
   - `morning_brief`
   - `close_brief_15h`
   - `eod_full_19h`
7. Legacy cron aliases are compatibility only. Do not use aliases as source-of-truth in new deploy scripts/config.

## Canonical Operator Flow
```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && bash deploy/predeploy-check.sh && bash deploy/safe-web-deploy.sh"
```

`deploy/safe-web-deploy.sh` already runs post-deploy smoke by default.
By default it skips migration execution (`RUN_MIGRATIONS=0`).  
Enable migrations only when precheck confirms pending production-safe migrations:
```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && RUN_MIGRATIONS=1 bash deploy/safe-web-deploy.sh"
```

## Manual Commands (when needed)
Precheck only:
```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && bash deploy/predeploy-check.sh"
```

Deploy only (skip precheck/smoke is possible but not recommended):
```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && RUN_PRECHECK=0 RUN_SMOKE=0 bash deploy/safe-web-deploy.sh"
```

Smoke only:
```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && bash deploy/postdeploy-smoke.sh"
```

Rollback web only:
```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && bash deploy/rollback-web.sh"
```
If needed, explicit ref is still supported:
```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && bash deploy/rollback-web.sh <git-ref>"
```

## Required Runtime Contract
```env
PYTHON_BRIDGE_URL=http://fiinquant:8000
DATABASE_URL=postgresql://adnuser:***@pgbouncer:5432/adncapital?schema=public&pgbouncer=true
DIRECT_DATABASE_URL=postgresql://adnuser:***@db:5432/adncapital?schema=public
```

## Minimal Smoke Expectations
- `/api/health` returns HTTP 200 with `"status":"ok"`.
- `web` container env satisfies DB URL contract.
- `User` table count is greater than 0.
- `/api/hub/topics` GET and POST return 200.
- Public routes do not return 5xx.
- Canonical cron logs are present and not stale.
- Deploy script captures rollback metadata before pull/build:
  - `.deploy_prev_ref`
  - `.deploy_prev_image` (best-effort)

## Abort Conditions
- Predeploy reports missing env contract/service mismatch.
- Build fails.
- Postdeploy smoke fails.
- User count check is 0.
- Any endpoint required by smoke returns 5xx.

## Success Conditions
- Predeploy PASS.
- Safe deploy completed without `down`.
- Postdeploy smoke PASS.
- Operator can verify dashboard/terminal/notifications load without critical error.

# Production Deploy Checklist

Status: Canonical deploy checklist  
Reference:
- [DEPLOY_SAFE_RUNBOOK.md](../../DEPLOY_SAFE_RUNBOOK.md)
- [docs/architecture/ADN_MASTER_ARCHITECTURE.md](../architecture/ADN_MASTER_ARCHITECTURE.md)

## 1) Precheck (must pass)
- Run:
  - `bash deploy/predeploy-check.sh`
- Confirm:
  - branch/commit is expected
  - `.env` has `PYTHON_BRIDGE_URL`
  - `DATABASE_URL` uses `@pgbouncer:5432`
  - `DIRECT_DATABASE_URL` uses `@db:5432`
  - compose services include `web`, `db`, `pgbouncer`, `fiinquant`
  - disk space is above threshold
  - `app_data/guides` exists and writable
  - baseline `/api/health` is reachable
  - migration status is known (up-to-date or pending)

## 2) Deploy (web only)
- Run:
  - `bash deploy/safe-web-deploy.sh`
- Guarantees:
  - no `docker-compose down`
  - web-only build/restart
  - optional `prisma migrate deploy` only when `RUN_MIGRATIONS=1`

## 3) Smoke (must pass)
- Run:
  - `bash deploy/postdeploy-smoke.sh`
- Confirm:
  - `/api/health` status ok
  - runtime DB env contract is valid
  - user count > 0
  - `/api/hub/topics` GET/POST return 200
  - key public routes are not 5xx
  - canonical cron logs are not stale
  - canonical cron status API is readable for admin (`/api/admin/system/cron-status`)
  - DataHub topic health API is readable for admin (`/api/admin/system/topic-health`)

## 4) Rollback (if deploy/smoke fails)
- Run:
  - `bash deploy/rollback-web.sh`
- Rules:
  - rollback web only
  - never restart/stop full stack
  - never touch db service in normal rollback
  - rollback ref is captured before deploy in `.deploy_prev_ref`

## Abort Conditions
- Any precheck failure.
- Build failure.
- Smoke failure.
- Missing or stale canonical cron health.
- DB user safety check fails.

## Success Conditions
- All precheck and smoke checks pass.
- No forbidden command used (`docker-compose down`).
- App and hub APIs return healthy responses.
- Canonical cron contract remains consistent.

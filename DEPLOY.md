# Deprecated

This file is deprecated and kept only as a pointer.

Use these documents/scripts instead:
- `DEPLOY_RUNBOOK.md`
- `DEPLOY_SAFE_RUNBOOK.md`
- `deploy/safe-web-deploy.sh`

Current architecture is Docker Compose with:
- `db` (PostgreSQL)
- `pgbouncer`
- `web` (Next.js)
- `fiinquant`

Do not use legacy systemd/web-only flow from older documents.

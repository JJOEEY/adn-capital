# ADN Capital Safe Deploy Runbook
Reference baseline: [docs/ops/SOURCE_OF_TRUTH.md](docs/ops/SOURCE_OF_TRUTH.md)

## Golden command
```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && bash deploy/safe-web-deploy.sh"
```

## Hard rules
1. Never run `docker-compose down`.
2. Only rebuild/restart `web` service (no full stack restart).
3. Always prefer `docker-compose` for compose commands (fallback to `docker compose` only when needed).
4. Canonical bridge env key is `PYTHON_BRIDGE_URL` (`FIINQUANT_URL` is backward-compat only).
5. Keep persistent PostgreSQL storage in `docker-compose.yml`:
```yaml
services:
  db:
    volumes:
      - /var/lib/9router/data/postgres:/var/lib/postgresql/data
```
6. `DATABASE_URL` must point to `pgbouncer`, `DIRECT_DATABASE_URL` must point to `db`:
```env
DATABASE_URL=postgresql://adnuser:adn_pass_99@pgbouncer:5432/adncapital?pgbouncer=true
DIRECT_DATABASE_URL=postgresql://adnuser:adn_pass_99@db:5432/adncapital
```
7. Keep persistent storage for Guide images in `web`:
```yaml
services:
  web:
    environment:
      - GUIDE_UPLOAD_DIR=/app/storage/guides
    volumes:
      - ./app_data/guides:/app/storage/guides
```
8. Ensure host folder permissions before deploy:
```bash
mkdir -p ./app_data/guides
chmod 775 ./app_data ./app_data/guides
```
9. API keys must come from secrets/env only (no hardcode in source/logs):
```env
DNSE_API_KEY=*** (secret only)
DNSE_MARKET_SNAPSHOT_URL=https://... (optional)
```
10. Scheduler canonical names:
`signal_scan_type1`, `market_stats_type2`, `morning_brief`, `close_brief_15h`, `eod_full_19h`
Legacy aliases remain for compatibility only: `signal_scan_5m`, `market_stats`, `intraday`, `prop_trading`.

## Quota Optimization Plan (4 steps)
1. Free-first data routing:
Use public/index sources (VNDirect + optional VNStock bridge) for index/liquidity first, keep FiinQuant for investor flow and premium metrics.
2. Snapshot cache + in-flight dedupe:
Enable short TTL cache for market snapshot (90s) and reuse in-flight promise to avoid duplicated Fiin calls from dashboard + cron bursts.
3. Data quality gate before publish:
Reject mismatched liquidity aggregates (unit/range mismatch) and fallback to better source instead of publishing broken values.
4. Channel-specific source policy:
Dashboard/app feed reads unified report records; Morning/EOD fallback to bridge payload when DB report is weak to keep UX stable without extra Fiin spam.

## Mandatory post-deploy checks
```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && docker-compose exec -T web env | grep -E 'DATABASE_URL|DIRECT_DATABASE_URL'"
```
Expected: `DATABASE_URL` has `@pgbouncer:5432`, `DIRECT_DATABASE_URL` has `@db:5432`.

```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && docker-compose exec -T db psql -U adnuser -d adncapital -c 'SELECT COUNT(*) FROM \"User\"'"
```
Expected: user count > 0.

```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && ls -ld ./app_data ./app_data/guides && docker-compose exec -T web sh -lc 'test -w /app/storage/guides && echo GUIDE_UPLOAD_DIR writable'"
```
Expected: host folders exist and web container can write to `/app/storage/guides`.

```bash
ssh root@14.225.204.117 "curl -sf http://127.0.0.1:3000/api/health >/dev/null && echo HEALTH_OK"
```
Expected: `HEALTH_OK`.

```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && docker-compose exec -T db psql -U adnuser -d adncapital -c \"SELECT status, COUNT(*) FROM \\\"Signal\\\" WHERE status IN ('ACTIVE','HOLD_TO_DIE') GROUP BY status;\""
```
Expected: ACTIVE/HOLD_TO_DIE data exists.

```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && docker-compose exec -T db psql -U adnuser -d adncapital -c \"SELECT id,type,title,\\\"createdAt\\\" FROM \\\"Notification\\\" ORDER BY \\\"createdAt\\\" DESC LIMIT 5;\""
```
Expected: recent notification feed records exist.

```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && docker-compose exec -T db psql -U adnuser -d adncapital -c \"SELECT \\\"cronName\\\", status, \\\"createdAt\\\" FROM \\\"CronLog\\\" WHERE \\\"cronName\\\" IN ('signal_scan_type1','market_stats_type2','morning_brief','close_brief_15h','eod_full_19h','signal_scan_5m') ORDER BY \\\"createdAt\\\" DESC LIMIT 20;\""
```
Expected: periodic cron logs are present.

## Rollback guardrail
1. If any gate fails: rollback only `web` image/tag, never restart `db`, never `down` full stack.
2. Use emergency admin restore only after confirming DB URLs point to production DB.

## Emergency admin restore (if needed)
```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && docker-compose exec web node -e \"require('bcryptjs').hash('admin123',12).then(h=>require('child_process').execSync('docker-compose exec -T db psql -U adnuser -d adncapital -c \\\"INSERT INTO \\\\\\\"User\\\\\\\" (id,name,email,password,role,\\\\\\\"createdAt\\\\\\\",\\\\\\\"updatedAt\\\\\\\") VALUES (gen_random_uuid(),\\'Admin ADN\\',\\'admin@adncapital.com.vn\\',\\''+h+'\\',\\'ADMIN\\',NOW(),NOW()) ON CONFLICT DO NOTHING\\\"',{stdio:\\'inherit\\'}))\""
```

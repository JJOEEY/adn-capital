# ADN Capital Safe Deploy Runbook

## Golden command
```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && bash deploy/safe-web-deploy.sh"
```

## Hard rules
1. Never run `docker-compose down`.
2. Only rebuild/restart `web` service (no full stack restart).
3. Keep persistent PostgreSQL storage in `docker-compose.yml` (bind mount hoặc named volume đều hợp lệ):
```yaml
services:
  db:
    volumes:
      - /var/lib/9router/data/postgres:/var/lib/postgresql/data
```
4. `DATABASE_URL` must point to `pgbouncer`, and `DIRECT_DATABASE_URL` must point to `db`:
```env
DATABASE_URL=postgresql://adnuser:adn_pass_99@pgbouncer:5432/adncapital?pgbouncer=true
DIRECT_DATABASE_URL=postgresql://adnuser:adn_pass_99@db:5432/adncapital
```
5. Keep persistent storage for Guide Markdown images in `web`:
```yaml
services:
  web:
    environment:
      - GUIDE_UPLOAD_DIR=/app/storage/guides
    volumes:
      - ./app_data/guides:/app/storage/guides
```
6. Ensure host folder permissions before deploy:
```bash
mkdir -p ./app_data/guides
chmod 775 ./app_data ./app_data/guides
```
7. API keys phải đi qua secrets/env, không hardcode vào source hoặc logs:
```env
DNSE_API_KEY=*** (secret only)
DNSE_MARKET_SNAPSHOT_URL=https://... (optional, nếu bật fallback DNSE market snapshot)
```

## Mandatory post-deploy checks
```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && docker compose exec -T web env | grep -E 'DATABASE_URL|DIRECT_DATABASE_URL'"
```
Expected: `DATABASE_URL` has `@pgbouncer:5432`, `DIRECT_DATABASE_URL` has `@db:5432`.

> Nếu VPS không có plugin `docker compose`, dùng `docker-compose` thay thế.

```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && docker compose exec -T db psql -U adnuser -d adncapital -c 'SELECT COUNT(*) FROM \"User\"'"
```
Expected: user count > 0.

```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && ls -ld ./app_data ./app_data/guides && docker compose exec -T web sh -lc 'test -w /app/storage/guides && echo GUIDE_UPLOAD_DIR writable'"
```
Expected: host folders exist and web container can write to `/app/storage/guides`.

```bash
ssh root@14.225.204.117 "curl -sf https://adncapital.vn/api/health >/dev/null && echo HEALTH_OK"
```
Expected: trả về `HEALTH_OK` (HTTP 200).

```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && docker compose exec -T db psql -U adnuser -d adncapital -c \"SELECT status, COUNT(*) FROM \\\"Signal\\\" WHERE status IN ('ACTIVE','HOLD_TO_DIE') GROUP BY status;\""
```
Expected: có dữ liệu `ACTIVE`/`HOLD_TO_DIE` đúng snapshot runtime.

```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && docker compose exec -T db psql -U adnuser -d adncapital -c \"SELECT id,type,title,\\\"createdAt\\\" FROM \\\"Notification\\\" ORDER BY \\\"createdAt\\\" DESC LIMIT 5;\""
```
Expected: feed Notifications có bản ghi mới sau cron scan/intraday.

```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && docker compose exec -T db psql -U adnuser -d adncapital -c \"SELECT \\\"cronName\\\", status, \\\"createdAt\\\" FROM \\\"CronLog\\\" WHERE \\\"cronName\\\" IN ('signal_scan_5m','signal_scan','signal-lifecycle') ORDER BY \\\"createdAt\\\" DESC LIMIT 20;\""
```
Expected: có log chạy định kỳ cho `signal-lifecycle` và scanner.

## Rollback guardrail
1. Nếu fail bất kỳ gate nào: rollback `web` image/tag trước đó, không restart `db`, không `down` full stack.
2. Chỉ dùng emergency admin restore sau khi xác nhận `DATABASE_URL`/`DIRECT_DATABASE_URL` đang trỏ đúng DB production.

## Emergency admin restore (if needed)
```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && docker compose exec web node -e \"require('bcryptjs').hash('admin123',12).then(h=>require('child_process').execSync('docker compose exec -T db psql -U adnuser -d adncapital -c \\\"INSERT INTO \\\\\\\"User\\\\\\\" (id,name,email,password,role,\\\\\\\"createdAt\\\\\\\",\\\\\\\"updatedAt\\\\\\\") VALUES (gen_random_uuid(),\\'Admin ADN\\',\\'admin@adncapital.com.vn\\',\\''+h+'\\',\\'ADMIN\\',NOW(),NOW()) ON CONFLICT DO NOTHING\\\"',{stdio:\\'inherit\\'}))\""
```

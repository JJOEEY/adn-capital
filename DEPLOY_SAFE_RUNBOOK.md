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

## Emergency admin restore (if needed)
```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && docker compose exec web node -e \"require('bcryptjs').hash('admin123',12).then(h=>require('child_process').execSync('docker compose exec -T db psql -U adnuser -d adncapital -c \\\"INSERT INTO \\\\\\\"User\\\\\\\" (id,name,email,password,role,\\\\\\\"createdAt\\\\\\\",\\\\\\\"updatedAt\\\\\\\") VALUES (gen_random_uuid(),\\'Admin ADN\\',\\'admin@adncapital.com.vn\\',\\''+h+'\\',\\'ADMIN\\',NOW(),NOW()) ON CONFLICT DO NOTHING\\\"',{stdio:\\'inherit\\'}))\""
```

# ADN Capital Safe Deploy Runbook

## Golden command
```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && git pull origin master && docker compose build --no-cache web && docker compose up -d pgbouncer web"
```

## Hard rules
1. Never run `docker-compose down`.
2. Only rebuild/restart `web` service.
3. Keep PostgreSQL volume in `docker-compose.yml`:
```yaml
services:
  db:
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```
4. `DATABASE_URL` must point to `pgbouncer`, and `DIRECT_DATABASE_URL` must point to `db`:
```env
DATABASE_URL=postgresql://adnuser:adn_pass_99@pgbouncer:6432/adncapital?pgbouncer=true
DIRECT_DATABASE_URL=postgresql://adnuser:adn_pass_99@db:5432/adncapital
```

## Mandatory post-deploy checks
```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && docker compose exec -T web env | grep -E 'DATABASE_URL|DIRECT_DATABASE_URL'"
```
Expected: `DATABASE_URL` has `@pgbouncer:6432`, `DIRECT_DATABASE_URL` has `@db:5432`.

```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && docker compose exec -T db psql -U adnuser -d adncapital -c 'SELECT COUNT(*) FROM \"User\"'"
```
Expected: user count > 0.

## Emergency admin restore (if needed)
```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && docker compose exec web node -e \"require('bcryptjs').hash('admin123',12).then(h=>require('child_process').execSync('docker compose exec -T db psql -U adnuser -d adncapital -c \\\"INSERT INTO \\\\\\\"User\\\\\\\" (id,name,email,password,role,\\\\\\\"createdAt\\\\\\\",\\\\\\\"updatedAt\\\\\\\") VALUES (gen_random_uuid(),\\'Admin ADN\\',\\'admin@adncapital.com.vn\\',\\''+h+'\\',\\'ADMIN\\',NOW(),NOW()) ON CONFLICT DO NOTHING\\\"',{stdio:\\'inherit\\'}))\""
```

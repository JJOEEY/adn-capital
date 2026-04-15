# ADN Capital Deploy Runbook (Current)

## Golden Rule
1. Never run `docker compose down` or `docker-compose down`.
2. Web-only deploy: rebuild/restart `web` service only.
3. Keep DB persistence intact (`/var/lib/9router/data/postgres:/var/lib/postgresql/data`).

## Canonical Deploy Command
```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && bash deploy/safe-web-deploy.sh"
```

The script is guardrailed and performs:
1. `git pull origin master`
2. `docker-compose build --no-cache web` (or `docker compose` fallback)
3. `docker-compose up -d web`
4. Post-deploy checks:
   - `DATABASE_URL` contains `@pgbouncer:5432`
   - `DIRECT_DATABASE_URL` contains `@db:5432`
   - `SELECT COUNT(*) FROM "User"` returns `> 0`

## Required Runtime DB URLs
```env
DATABASE_URL=postgresql://adnuser:***@pgbouncer:5432/adncapital?schema=public&pgbouncer=true
DIRECT_DATABASE_URL=postgresql://adnuser:***@db:5432/adncapital?schema=public
```

## Manual Verification
```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && docker-compose exec -T web env | grep -E '^DATABASE_URL=|^DIRECT_DATABASE_URL='"
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && docker-compose exec -T db psql -U adnuser -d adncapital -c 'SELECT COUNT(*) FROM \"User\";'"
ssh root@14.225.204.117 "curl -I -sS http://localhost:3000 | head -n 1"
```

## If VPS Lacks `docker compose` Plugin
Use `docker-compose` (hyphen). `deploy/safe-web-deploy.sh` auto-detects this.

## Emergency Admin Restore
Only after verifying DB target is correct:
```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && docker-compose exec web node -e \"require('bcryptjs').hash('admin123',12).then(h=>require('child_process').execSync('docker-compose exec -T db psql -U adnuser -d adncapital -c \\\"INSERT INTO \\\\\\\"User\\\\\\\" (id,name,email,password,role,\\\\\\\"systemRole\\\\\\\",\\\\\\\"createdAt\\\\\\\",\\\\\\\"updatedAt\\\\\\\") VALUES (gen_random_uuid()::text,\\'Admin ADN\\',\\'admin@adncapital.com.vn\\',\\''+h+'\\',\\'VIP\\',\\'ADMIN\\',NOW(),NOW()) ON CONFLICT (email) DO NOTHING\\\"',{stdio:\\'inherit\\'}))\""
```

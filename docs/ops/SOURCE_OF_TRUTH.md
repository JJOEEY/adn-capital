# ADN Capital Source Of Truth (Phase 0 Freeze)

## 1) Runtime Ownership
- `web` owns DataHub cache/topic APIs (`/api/hub/*`).
- `fiinquant` owns scheduler execution (slot-gated jobs).
- `db` stores persistent state (user/signal/report/cron log/broker sync).

## 2) Environment Contracts
- Canonical bridge env: `PYTHON_BRIDGE_URL`
- Backward-compat alias only: `FIINQUANT_URL`
- Canonical pooled DB env: `DATABASE_URL` (must point to `pgbouncer`)
- Canonical direct DB env: `DIRECT_DATABASE_URL` (must point to `db`)

Expected:
```env
PYTHON_BRIDGE_URL=http://fiinquant:8000
DATABASE_URL=postgresql://adnuser:***@pgbouncer:5432/adncapital?schema=public&pgbouncer=true
DIRECT_DATABASE_URL=postgresql://adnuser:***@db:5432/adncapital?schema=public
```

## 3) Scheduler Canonical Types
- `signal_scan_type1` (10:00, 10:30, 14:00, 14:20)
- `market_stats_type2` (10:00, 11:30, 14:00, 14:45)
- `morning_brief` (08:00)
- `close_brief_15h` (15:00)
- `eod_full_19h` (19:00)

Legacy aliases (supported for compatibility only):
- `signal_scan_5m` -> `signal_scan_type1`
- `market_stats` / `intraday` -> `market_stats_type2`
- `prop_trading` -> `eod_full_19h`

## 4) Deploy Baseline
Safe deploy default:
```bash
docker-compose build --no-cache web
docker-compose up -d web
```

Forbidden in normal deploy:
```bash
docker-compose down
```

## 5) AI Policy Freeze
AI allowed:
- explain/summarize/personalize/compare

AI forbidden:
- generate raw trading signal
- override deterministic lifecycle/risk rules
- override broker truth state


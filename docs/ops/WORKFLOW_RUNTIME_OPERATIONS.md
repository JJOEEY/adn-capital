# Workflow Runtime Operations Guide

Status: Canonical operations guide

## 1) Read runtime state
- Definitions/runtime summary:
  - `GET /api/admin/system/workflows`
- Execution runs:
  - `GET /api/admin/system/workflows/runs?limit=100`
- Admin UI:
  - `/admin/workflows`

## 2) Trigger workflow manually (internal)
`POST /api/internal/workflows/trigger`

Headers:
- `x-internal-key: $INTERNAL_API_KEY` (or `x-cron-secret`)

Payload example:
```json
{
  "type": "portfolio_risk_threshold",
  "source": "ops:manual",
  "payload": {
    "userId": "user_123",
    "riskPercent": 75
  }
}
```

## 3) Enable/disable workflow
Use `SystemSetting` keys:
- `workflow:{workflowKey}:enabled = true|false`

Example:
- `workflow:signal-active-notify:enabled=false`

## 4) Common troubleshooting
- Trigger accepted but no run:
  - check `enabled` flag and trigger config match.
- Run failed:
  - inspect `resultData` in `CronLog` for action-level error.
- Telegram action skipped:
  - verify `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`.
- Scanner action skipped during cron workflow:
  - expected default recursion guard.

## 5) Safety notes
- Workflow runtime is event-driven only.
- Scheduler matrix remains owned by `fiinquant`.
- Do not use workflow runtime to bypass DNSE compliance gates or to enable real submit.

## 6) Verification runbook (Phase 6.1)
Local/CI:
- `npm run build`
- `npm run verify:phase6:runtime`
- `npm run verify:phase6:smoke`

Staging/VPS (real runtime):
- `npm run verify:phase6:staging`

The staging verifier checks:
- manual trigger verification for:
  - `morning-brief-ready-refresh`
  - `signal-active-notify`
  - `portfolio-risk-alert`
- admin/debug surfaces:
  - `/api/admin/system/workflows`
  - `/api/admin/system/workflows/runs`
  - `/admin/workflows`
- canonical integration paths:
  - cron route -> workflow trigger chain
  - webhook signal route -> workflow trigger chain
- `CronLog` persistence shape (`actions`, `retries`, `warnings`, `triggerSource`, timestamps)

## 7) Observability alignment (Phase 7)
- Workflow runtime logs follow canonical observability schema via `src/lib/observability.ts`.
- For operational correlation, read together:
  - `/api/admin/system/workflows/runs`
  - `/api/admin/system/cron-status`
  - `/api/admin/system/topic-health`
- Workflow runtime remains event-driven and cannot become scheduler owner.

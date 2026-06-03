# OpenClaw CEO VPS deploy kit

Scope: run OpenClaw for the current Telegram bot `@adnn8n_bot`, add the vendored `openclaw-setup` dashboard, and keep web ADN untouched.

## What this adds

- `adn-9router`: local model/router service.
- `adn-openclaw-setup`: setup dashboard from `vendor/openclaw-setup`.
- `adn-openclaw-ceo`: current OpenClaw CEO bot runner.
- Safe scripts for preflight, smoke, healthcheck and cleanup.

## Secrets

Secrets stay outside git:

```bash
/home/adncapital/secrets/openclaw-ceo.env
chmod 600 /home/adncapital/secrets/openclaw-ceo.env
```

Start from `env.example`, then fill real values on the VPS. Do not commit tokens.

The deploy script calls Telegram `getMe` before starting anything. If the token is not for `adnn8n_bot`, deploy stops.

## Deploy order

```bash
node deploy/openclaw-ceo/preflight-getme.mjs
bash deploy/openclaw-ceo/deploy-openclaw-ceo.sh
bash deploy/openclaw-ceo/smoke-openclaw-ceo.sh
```

The deploy script starts 9Router, then OpenClaw setup dashboard, then OpenClaw CEO. It does not run `docker-compose down` and does not touch web/DataHub/Radar/Brief/DNSE.

`OPENCLAW_CEO_COMMAND` must be the long-running gateway command for `@adnn8n_bot`, for example:

```bash
OPENCLAW_CEO_COMMAND='node /opt/openclaw-ceo/release/openclaw.mjs --profile adn-ceo gateway run --bind lan --port 18790 --verbose'
```

Do not use `doctor` as the service command; it exits after checking health and will not keep Telegram running.

## Channels

`vendor/openclaw-setup` includes Zalo Bot API, Zalo Personal QR login, Facebook crawler and Facebook poster plugins. Enable them through the dashboard or env-backed project config. Zalo Personal should use a secondary Zalo account because it is not an official OA flow.

## Resource guard

Install cron after the first successful smoke:

```bash
bash deploy/openclaw-ceo/install-openclaw-cron.sh
```

Healthcheck runs every 5 minutes. If OpenClaw exceeds memory threshold, it restarts once with cooldown. If it remains heavy, it stops OpenClaw to protect the web app.

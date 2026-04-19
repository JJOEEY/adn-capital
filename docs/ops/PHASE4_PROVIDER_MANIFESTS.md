# Phase 4 Provider Manifests (Contract-First)

Status: Supporting phase record  
Canonical references:
- [docs/architecture/ADN_MASTER_ARCHITECTURE.md](../architecture/ADN_MASTER_ARCHITECTURE.md)
- [docs/ops/SOURCE_OF_TRUTH.md](./SOURCE_OF_TRUTH.md)

## Active Mode
- `CONTRACT_FIRST_FALLBACK_MODE`

## Why this mode
- The repository currently does not contain executable Python provider-registry source code.
- `fiinquant-bridge/` only contains container build assets, not runtime provider modules.
- Web layer is therefore the contract gateway and fallback safety layer.

## Source of Truth
- Deterministic scanner/backtest engines remain source-of-truth.
- AI is only allowed for `summary/insight` after deterministic outputs are present.
- If deterministic outputs are unavailable, APIs return degraded/error with explicit warnings.

## Canonical Endpoints
- `GET /api/v1/providers/backtest/manifest`
- `POST /api/v1/providers/backtest/run`
- `GET /api/v1/providers/scanner/manifest`
- `POST /api/v1/providers/scanner/run`

## Manifest Contract
```json
{
  "providerKey": "adn_signal_scanner",
  "providerType": "scanner",
  "title": "ADN Signal Scanner",
  "description": "Rule-based scanner...",
  "version": "1.0.0",
  "capabilities": ["scan", "radar"],
  "fields": [],
  "defaults": {},
  "constraints": {},
  "executionMode": "web-adapter",
  "supportsInsight": true
}
```

Supported field types:
- `text`
- `number`
- `select`
- `multiselect`
- `boolean`
- `date`
- `dateRange`
- `ticker`
- `textarea`

## Run Contract
Request:
```json
{
  "providerKey": "adn_signal_scanner",
  "inputs": {},
  "context": {},
  "requestInsight": true
}
```

Response:
```json
{
  "status": "success",
  "providerKey": "adn_signal_scanner",
  "runId": "run-...",
  "startedAt": "ISO",
  "completedAt": "ISO",
  "result": {},
  "summary": "optional",
  "insight": "optional",
  "warnings": [],
  "errors": [],
  "source": "bridge",
  "deterministic": true
}
```

## Fallback Behavior
- Manifest endpoints:
  - Try bridge manifest first.
  - Fallback to local manifest with warnings if bridge unavailable.
- Run endpoints:
  - Try bridge run first.
  - Return explicit degraded/error fallback if bridge unavailable.
  - Dev-only stub execution is gated by:
    - `NODE_ENV !== production`
    - `PROVIDER_ALLOW_DEV_STUB=1`

## UI Integration
- `ProviderWorkbench` fetches manifests and renders dynamic forms from `fields`.
- The same screen supports both scanner and backtest contracts.
- Warnings/errors are surfaced directly to operator users.

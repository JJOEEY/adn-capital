# ADR-0003: Contract-First Fallback Mode

Status: Accepted  
Date: 2026-04-20

## Decision
Provider integration baseline is `CONTRACT_FIRST_FALLBACK_MODE`.

## Rationale
Runtime provider registry sources are not fully owned in this workspace; API contracts must stay stable and safe.

## Consequences
- Manifest/run APIs remain canonical for scanner/backtest.
- On upstream failure, return degraded/error contract with explicit warning.
- No synthetic raw trading signal output from fallback path.

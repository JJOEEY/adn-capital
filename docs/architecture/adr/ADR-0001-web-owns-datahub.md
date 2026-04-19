# ADR-0001: Web Owns DataHub

Status: Accepted  
Date: 2026-04-20

## Decision
`web` is the single owner of DataHub topic cache lifecycle and `/api/hub/*` APIs.

## Rationale
Avoid split-brain cache behavior and contract drift between services.

## Consequences
- Topic TTL/freshness/invalidation are enforced in one place.
- `fiinquant` produces deterministic data but does not own hub cache semantics.

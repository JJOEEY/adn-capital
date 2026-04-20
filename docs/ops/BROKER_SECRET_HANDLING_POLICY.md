# Broker Secret Handling Policy

Status: Canonical policy for DNSE/API secret storage and operational handling.

## Secret Storage
- Secrets must be stored in environment variables or secret manager only.
- Secrets are forbidden in source code, docs examples, prompts, and chat logs.
- `.env.example` must use placeholders only.

## Secret Classes
- system credentials (`DNSE_API_KEY`, internal auth keys)
- runtime execution flags
- user-linked broker tokens (encrypted at rest)

## Rotation Policy
- system secrets: rotate on schedule and immediately after incident suspicion
- broker integration secrets: rotate when ownership changes or leakage risk is detected
- rotate owner must record change window + verification result

## Access Policy
- least-privilege access only
- production secret access must be role-bound and auditable
- no shared personal credentials

## Logging & Redaction
- never log raw tokens/keys
- redact secret-like fields before emitting observability events
- reject any debug output that includes full credential value

## Incident Response
If secret exposure is suspected:
1. activate kill switch if execution path is impacted
2. rotate affected secret(s)
3. invalidate compromised sessions/tokens
4. run post-incident audit and publish remediation notes

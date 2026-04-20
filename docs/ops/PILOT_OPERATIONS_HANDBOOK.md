# Pilot Operations Handbook

Status: Canonical operations guide for DNSE allowlist pilot runtime.

## Daily Operator Flow
1. Check `/admin/dnse-execution` for blockers and decision-chain errors.
2. Check `/admin/workflows` for failed or stale runs.
3. Check `/admin/cron-health` for cron/topic staleness.
4. Check broker topic freshness for pilot accounts.
5. Record operational summary and open issues.

## Pilot Runtime Baseline
- `DNSE_EXECUTION_MODE=SAFE_EXECUTION_ADAPTER_MODE`
- `DNSE_EXECUTION_ALLOWLIST_ENFORCED=true`
- `DNSE_REAL_ORDER_SUBMIT_ENABLED=false`
- kill switch default OFF (ready to activate)

## Core Verification For Pilot Accounts
- parse -> validate -> preview pass deterministically
- submit returns blocked/approval-required by policy
- audit trail records all decisions
- topic hydration updates positions/orders/balance/holdings

## Incident Severity
- SEV1: policy bypass, unexpected success submit, kill-switch failure
- SEV2: stale broker topics, repeated preview/validation failure
- SEV3: non-blocking UX/debug read model drift

## Escalation
- SEV1: activate kill switch immediately and notify compliance + ops + engineering
- SEV2/SEV3: keep pilot running with account-level restrictions as needed

## Linked Playbooks
- [ALLOWLIST_ONBOARDING.md](./ALLOWLIST_ONBOARDING.md)
- [PILOT_SUPPORT_RUNBOOK.md](./PILOT_SUPPORT_RUNBOOK.md)
- [AUDIT_REVIEW_PLAYBOOK.md](./AUDIT_REVIEW_PLAYBOOK.md)

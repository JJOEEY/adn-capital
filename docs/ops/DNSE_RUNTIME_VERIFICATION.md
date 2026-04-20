# DNSE Runtime Verification (Pilot-Safe)

Status: Canonical verification cases for pilot runtime.

## Preconditions
- user session and admin session available
- at least one DNSE-linked account in pilot scope
- allowlist enforcement ON
- real submit OFF

## Test Matrix
1. Inside allowlist:
   - parse: pass
   - validate: pass
   - preview: pass
   - submit: blocked (`blocked_not_enabled` or `approval_required`)
2. Outside allowlist:
   - submit blocked with `pilot_allowlist_required`
3. Kill switch ON:
   - parse/validate/preview/submit blocked with kill-switch reason
4. Kill switch OFF:
   - behavior returns to allowlist/compliance rules

## Broker Topic Hydration Check
Verify all four for linked account:
- `positions`
- `orders`
- `balance`
- `holdings`

Each topic must show source/freshness/error envelope.

## Audit Chain Check
For every test, verify decision chain is visible:
- parse -> validate -> preview -> submit
- status + policy reason
- timestamp + actor

## Pass Criteria
Pilot runtime is verified only when all matrix rows pass with deterministic policy outcomes and no fake success.

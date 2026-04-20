# Audit Review Playbook

Status: Canonical review procedure for DNSE execution audit chains.

## Review Window
- daily quick review for pilot accounts
- weekly deep review for compliance and operations

## Mandatory Fields Per Event
- actor and account context
- intent/preview/submit identifiers
- decision status
- policy reason code
- timestamp
- source endpoint

## Review Steps
1. Pull latest events by user/account/ticker/time range.
2. Reconstruct parse -> validate -> preview -> submit sequence.
3. Confirm deterministic guard reasons are coherent.
4. Confirm no event indicates policy bypass.
5. Confirm topic hydration and workflow triggers align with runtime state.

## Escalation Rules
- missing decision links: SEV2
- unredacted secret-like payload: SEV1
- unexpected success in safe mode: SEV1 + immediate kill switch

## Output Artifact
Every review publishes:
- pass/fail summary
- anomaly list
- actions owner + due date

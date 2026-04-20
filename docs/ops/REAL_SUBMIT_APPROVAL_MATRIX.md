# Real Submit Approval Matrix

Status: Canonical control matrix for any real broker execution enablement.

## Roles
- Compliance Lead
- Legal Lead
- Operations Lead
- Engineering Lead
- Incident Commander

## Decision Matrix
| Action | Compliance | Legal | Ops | Engineering | Incident Commander |
|---|---|---|---|---|---|
| Approve pilot mode | Required | Optional | Required | Required | Optional |
| Approve allowlist changes | Optional | Optional | Required | Required | Optional |
| Enable real submit | Required | Required | Required | Required | Optional |
| Disable real submit | Optional | Optional | Required | Required | Optional |
| Activate kill switch | Optional | Optional | Required | Optional | Required |
| Remove account from allowlist | Optional | Optional | Required | Required | Optional |
| Close execution incident | Required | Optional | Required | Required | Required |

## Evidence Requirements
Every approval must include:
- approver identity
- timestamp
- scope (environment + account/user set)
- change ticket/incident reference
- rollback instruction reference

## Gate Rule
If any required approver is missing, the action is blocked.

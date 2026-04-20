# Real Submit Approval Matrix (Approval Record)

Status: Pending internal sign-off  
Reference policy: [REAL_SUBMIT_APPROVAL_MATRIX.md](./REAL_SUBMIT_APPROVAL_MATRIX.md)

## Approval Decision Record
| Area | Required Role(s) | Approver | Decision | Timestamp | Evidence |
|---|---|---|---|---|---|
| Pilot mode approval | Compliance + Ops + Engineering | _TBD_ | Pending | _TBD_ | _TBD_ |
| Allowlist scope approval | Ops + Engineering | _TBD_ | Pending | _TBD_ | _TBD_ |
| Real submit approval | Compliance + Legal + Ops + Engineering | _TBD_ | Pending | _TBD_ | _TBD_ |
| Kill switch ownership | Incident Commander + Ops | _TBD_ | Pending | _TBD_ | _TBD_ |
| Incident closure authority | Incident Commander + Compliance + Ops | _TBD_ | Pending | _TBD_ | _TBD_ |

## Required Answers Before Any Real Submit
1. Who has authority to enable real submit in production?
2. Which OTP/trading-token flow is compliance-approved?
3. Where are DNSE secrets stored and who has access?
4. Who can activate kill switch and what is SLA?
5. What audit fields are mandatory and retention duration?

## Gate Result
- `DNSE_REAL_ORDER_SUBMIT_ENABLED` must remain `false` until all records above are approved and timestamped.

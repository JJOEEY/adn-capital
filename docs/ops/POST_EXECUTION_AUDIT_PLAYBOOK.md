# Post-Execution Audit Playbook

Status: Canonical audit process for enabled execution windows.

## Audit Scope
- all submit attempts in the execution window
- policy decisions and reason codes
- account binding integrity
- idempotency and duplicate protection outcomes

## Review Steps
1. extract events by time window and allowlist cohort
2. group by account/ticker/order intent
3. validate parse -> validate -> preview -> submit chain integrity
4. flag anomalies:
   - missing chain links
   - unexpected success path
   - guard failures
5. assign remediation owners and deadlines

## Output
- audit summary report (pass/fail)
- anomaly register
- corrective action plan
- recommendation: continue rollout / pause rollout / rollback

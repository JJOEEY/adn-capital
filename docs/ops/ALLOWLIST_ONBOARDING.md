# Allowlist Onboarding

Status: Canonical onboarding/offboarding checklist for pilot accounts.

## Onboarding Checklist
1. Verify user/account identity and pilot eligibility.
2. Verify DNSE link is active for target account.
3. Add allowlist entry (userId/accountId/email per policy).
4. Confirm runtime flags:
   - allowlist enforcement ON
   - kill switch OFF
   - real submit OFF
5. Run pilot smoke:
   - parse pass
   - validate pass
   - preview pass
   - submit blocked with expected reason
6. Verify admin debug chain and audit events exist.
7. Record onboarding result and owner.

## Offboarding Checklist
1. Remove user/account/email from allowlist.
2. Verify submit immediately blocked by allowlist guard.
3. Confirm no pending execution tasks remain.
4. Record offboarding timestamp and reason.

## Emergency Revoke
- remove from allowlist first
- activate kill switch if broader risk exists
- open incident record and assign incident commander

# Sprint 6 Notes - QA And Polish

## Required Verification
- `npm run build`.
- Browser smoke for `/`, `/products`, `/products/nexpulse`, `/pricing`, `/auth`, `/art`, `/rs-rating`.
- Confirm public homepage does not call DNSE runtime.
- Confirm product dropdown opens on hover/focus.
- Confirm F5 no longer serves stale service-worker HTML after deploy.

## Deploy Rule
- Use safe web-only deploy.
- Do not run `docker-compose down`.

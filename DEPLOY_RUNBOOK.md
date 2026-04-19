# Deploy Runbook (Wrapper)

This file is a thin wrapper to avoid contract drift.

Use the canonical runbook:
- [DEPLOY_SAFE_RUNBOOK.md](DEPLOY_SAFE_RUNBOOK.md)

Use the canonical checklist:
- [docs/ops/PRODUCTION_DEPLOY_CHECKLIST.md](docs/ops/PRODUCTION_DEPLOY_CHECKLIST.md)

Canonical command:
```bash
ssh root@14.225.204.117 "cd /home/adncapital/app/adn-capital && bash deploy/predeploy-check.sh && bash deploy/safe-web-deploy.sh"
```

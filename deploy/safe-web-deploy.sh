#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/adncapital/app/adn-capital}"
BRANCH="${BRANCH:-master}"
ALLOW_NON_MASTER="${ALLOW_NON_MASTER:-0}"
ALLOW_DIRTY_TREE="${ALLOW_DIRTY_TREE:-0}"
ALLOW_NON_FORWARD="${ALLOW_NON_FORWARD:-0}"
RUN_PRECHECK="${RUN_PRECHECK:-1}"
RUN_SMOKE="${RUN_SMOKE:-1}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-0}"
ALLOW_UNHEALTHY_BASELINE="${ALLOW_UNHEALTHY_BASELINE:-0}"
ALLOW_STALE_CRON="${ALLOW_STALE_CRON:-0}"
PREV_REF_FILE="${PREV_REF_FILE:-.deploy_prev_ref}"
PREV_IMAGE_FILE="${PREV_IMAGE_FILE:-.deploy_prev_image}"

if command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_BIN="docker-compose"
else
  COMPOSE_BIN="docker compose"
fi

echo "[safe-deploy] app dir: ${APP_DIR}"
echo "[safe-deploy] compose: ${COMPOSE_BIN}"
echo "[safe-deploy] target branch: ${BRANCH}"
echo "[safe-deploy] migrations enabled: ${RUN_MIGRATIONS}"

# Guard 1: production deploys master only. Feature branches diverge from master and
# silently revert other fixes back to old code. Override only with explicit intent.
if [[ "${BRANCH}" != "master" && "${ALLOW_NON_MASTER}" != "1" ]]; then
  echo "[safe-deploy][ABORT] Refusing to deploy non-master branch '${BRANCH}'." >&2
  echo "[safe-deploy] Production must deploy 'master'. Merge your work into master first." >&2
  echo "[safe-deploy] Intentional override: ALLOW_NON_MASTER=1 BRANCH='${BRANCH}' bash deploy/safe-web-deploy.sh" >&2
  exit 1
fi

cd "${APP_DIR}"

# Guard 2: never deploy on top of MODIFIED TRACKED files (they break ff-only pull
# and produce "half-old, half-new" code). Untracked files (e.g. this script's own
# .deploy_* artifacts) do not block a pull, so they are intentionally ignored.
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  if [[ "${ALLOW_DIRTY_TREE}" == "1" ]]; then
    echo "[safe-deploy][WARN] Tracked files modified on server (ignored by ALLOW_DIRTY_TREE=1)."
  else
    echo "[safe-deploy][ABORT] Server has modified tracked files (manual edits):" >&2
    git status --short --untracked-files=no >&2
    echo "[safe-deploy] Commit/stash/discard on the server, or set ALLOW_DIRTY_TREE=1 to ignore." >&2
    exit 1
  fi
fi

PREV_REF="$(git rev-parse HEAD)"
echo "${PREV_REF}" > "${PREV_REF_FILE}"
echo "[safe-deploy] captured rollback ref: ${PREV_REF} -> ${PREV_REF_FILE}"
if ${COMPOSE_BIN} ps -q web >/dev/null 2>&1; then
  WEB_CID="$(${COMPOSE_BIN} ps -q web || true)"
  if [[ -n "${WEB_CID}" ]]; then
    PREV_IMAGE_ID="$(docker inspect -f '{{.Image}}' "${WEB_CID}" 2>/dev/null || true)"
    if [[ -n "${PREV_IMAGE_ID}" ]]; then
      echo "${PREV_IMAGE_ID}" > "${PREV_IMAGE_FILE}"
      echo "[safe-deploy] captured running web image id: ${PREV_IMAGE_ID} -> ${PREV_IMAGE_FILE}"
    fi
  fi
fi

git fetch origin "${BRANCH}"
REMOTE_REF="$(git rev-parse "origin/${BRANCH}")"
echo "[safe-deploy] currently running ref: ${PREV_REF}"
echo "[safe-deploy] target origin/${BRANCH} ref: ${REMOTE_REF}"

# Guard 3: forward-only. The target must already contain the commit that is currently
# running. Otherwise this deploy moves production BACKWARD or sideways onto code that
# is missing fixes already live -- exactly the "deployed the fix but other parts went
# back to old code" failure. Merge first so the target contains everything.
if [[ "${PREV_REF}" != "${REMOTE_REF}" ]]; then
  if git merge-base --is-ancestor "${PREV_REF}" "${REMOTE_REF}"; then
    echo "[safe-deploy] forward-only check OK (running ref is an ancestor of target)."
  elif [[ "${ALLOW_NON_FORWARD}" == "1" ]]; then
    echo "[safe-deploy][WARN] Target does not contain running ref; proceeding (ALLOW_NON_FORWARD=1)."
  else
    echo "[safe-deploy][ABORT] Non-forward deploy blocked." >&2
    echo "[safe-deploy] origin/${BRANCH} (${REMOTE_REF}) does not contain running commit (${PREV_REF})." >&2
    echo "[safe-deploy] Deploying it would drop fixes already live. Merge into ${BRANCH} first." >&2
    echo "[safe-deploy] Intentional override (e.g. controlled rollback-forward): ALLOW_NON_FORWARD=1" >&2
    exit 1
  fi
fi

git checkout "${BRANCH}"
git pull --ff-only origin "${BRANCH}"
[[ -f deploy/predeploy-check.sh ]] || { echo "[safe-deploy] missing deploy/predeploy-check.sh"; exit 1; }
[[ -f deploy/postdeploy-smoke.sh ]] || { echo "[safe-deploy] missing deploy/postdeploy-smoke.sh"; exit 1; }

# Ensure guide image storage exists and is writable before web container starts.
mkdir -p ./app_data/guides
chmod 775 ./app_data ./app_data/guides || true

if [[ "${RUN_PRECHECK}" == "1" ]]; then
  ALLOW_UNHEALTHY_BASELINE="${ALLOW_UNHEALTHY_BASELINE}" bash deploy/predeploy-check.sh
fi

# Guardrail: web-only deploy, never down the full stack.
${COMPOSE_BIN} build --no-cache web

if [[ "${RUN_MIGRATIONS}" == "1" ]]; then
  echo "[safe-deploy] running prisma migrate deploy (web-only)"
  ${COMPOSE_BIN} run --rm web npx prisma migrate deploy
fi

${COMPOSE_BIN} up -d web

if [[ "${RUN_SMOKE}" == "1" ]]; then
  ALLOW_STALE_CRON="${ALLOW_STALE_CRON}" bash deploy/postdeploy-smoke.sh
fi

DEPLOYED_REF="$(git rev-parse HEAD)"
echo "[safe-deploy] ============================================================"
echo "[safe-deploy] DEPLOYED branch: $(git rev-parse --abbrev-ref HEAD)"
echo "[safe-deploy] DEPLOYED commit: ${DEPLOYED_REF}"
git --no-pager log -1 --oneline
echo "[safe-deploy] rollback ref saved in: ${PREV_REF_FILE} (${PREV_REF})"
echo "[safe-deploy] ============================================================"
echo "[safe-deploy] done"

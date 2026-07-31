#!/usr/bin/env bash
# Daemon fleet ops for xiom-api
#
# Architecture (preferred / production-ready):
#   All daemons run in-process via DaemonRunner inside the Cloud Run service
#   `xiom-api` with --min-instances=1. No separate Cloud Run Jobs required.
#
# Optional: Cloud Scheduler can hit a protected admin endpoint if added later:
#   POST /internal/daemons/:name/run  (Authorization: Bearer $INTERNAL_DAEMON_TOKEN)
#
# Alias note: use xiom-api / xiom-backups (not axiom-*).
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:?GCP_PROJECT_ID required}"
REGION="${GCP_REGION:-europe-west1}"
SERVICE="${CLOUD_RUN_SERVICE:-xiom-api}"
API_URL="${API_URL:-}"

cat <<'EOF'
XIOM daemon fleet — in-process on xiom-api
──────────────────────────────────────────
Registered daemons (see apps/api/src/daemons/runner.ts):
  world-model-sync        30s
  token-telemetry         60s
  bidwall-monitor         30s
  holder-snapshot         6h
  revenue-accounting      5m
  health-check            10s
  freshness-decay         1h
  session-janitor         24h
  intake-metrics          5m
  quota-reset             24h
  loop-scheduler          60s
  policy-evolution        7d
  context-freshness       2h
  pattern-detector        24h
  audit-verifier          6h
  acp                     5m
  notification-dispatcher 1m
  graph-backup            24h (~03:00 UTC)
  activation-queue        5m
  price-oracle            30s

GCS backups bucket: gs://xiom-backups/{humanId}/{date}.json
EOF

echo
echo "Ensuring Cloud Run min instances = 1 for in-process daemons…"
gcloud run services update "${SERVICE}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --min-instances 1 \
  --quiet || echo "(service may not exist yet — run scripts/deploy/api.sh first)"

if [[ -n "${API_URL}" && -n "${INTERNAL_DAEMON_TOKEN:-}" ]]; then
  echo "Optional: create Cloud Scheduler jobs hitting ${API_URL}/internal/daemons/*/run"
  echo "(endpoint not required when using in-process DaemonRunner)"
fi

echo "Daemon scaffolding complete."

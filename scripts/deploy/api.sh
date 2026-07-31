#!/usr/bin/env bash
# Deploy xiom-api to Cloud Run (europe-west1).
# Alias: historically referred to as axiom-api — prefer xiom-api to match @xiom/* monorepo.
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:?GCP_PROJECT_ID required}"
REGION="${GCP_REGION:-europe-west1}"
SERVICE="${CLOUD_RUN_SERVICE:-xiom-api}"
IMAGE="${IMAGE_URI:-gcr.io/${PROJECT_ID}/${SERVICE}:latest}"

if [[ -z "${IMAGE_URI:-}" ]]; then
  echo "Building ${IMAGE} via Cloud Build…"
  gcloud builds submit --project "${PROJECT_ID}" --tag "${IMAGE}" \
    -f apps/api/Dockerfile .
else
  echo "Using pre-built image ${IMAGE}"
fi

echo "Deploying Cloud Run service ${SERVICE} in ${REGION}…"
gcloud run deploy "${SERVICE}" \
  --project "${PROJECT_ID}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --min-instances 1 \
  --max-instances 10 \
  --cpu 1 \
  --memory 1Gi \
  --port 3001 \
  --set-env-vars "NODE_ENV=production,OTEL_SERVICE_NAME=xiom-api" \
  --set-secrets "\
DATABASE_URL=DATABASE_URL:latest,\
JWT_SECRET=JWT_SECRET:latest,\
NEO4J_URI=NEO4J_URI:latest,\
NEO4J_USER=NEO4J_USER:latest,\
NEO4J_PASSWORD=NEO4J_PASSWORD:latest,\
RH_RPC_URL=RH_RPC_URL:latest,\
XIOM_SIGNER_PRIVATE_KEY=XIOM_SIGNER_PRIVATE_KEY:latest,\
XIOM_TOKEN_ADDRESS=XIOM_TOKEN_ADDRESS:latest,\
BIDWALL_CONTRACT_ADDRESS=BIDWALL_CONTRACT_ADDRESS:latest,\
CHAINLINK_ETH_USD_RH=CHAINLINK_ETH_USD_RH:latest,\
TELEGRAM_BOT_TOKEN=TELEGRAM_BOT_TOKEN:latest,\
TELEGRAM_CHAT_ID=TELEGRAM_CHAT_ID:latest,\
OTEL_EXPORTER_OTLP_ENDPOINT=OTEL_EXPORTER_OTLP_ENDPOINT:latest"

echo "Done. Service URL:"
gcloud run services describe "${SERVICE}" --project "${PROJECT_ID}" --region "${REGION}" --format='value(status.url)'

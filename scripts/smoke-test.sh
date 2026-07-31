#!/usr/bin/env bash
# XIOM production smoke checks (Robinhood Chain / USDG / xiom-ai.com)
# Usage: BASE_URL=https://api.xiom-ai.com ./scripts/smoke-test.sh
#        DRY_RUN=1 ./scripts/smoke-test.sh   # print checks only

set -euo pipefail

BASE_URL="${BASE_URL:-https://api.xiom-ai.com}"
DRY_RUN="${DRY_RUN:-0}"
PASS=0
FAIL=0
SOFT=0

check() {
  local method="$1"
  local path="$2"
  local expect="${3:-200}"
  local soft="${4:-0}"
  local url="${BASE_URL}${path}"

  if [[ "$DRY_RUN" == "1" ]]; then
    echo "[dry-run] $method $url (expect $expect)"
    return 0
  fi

  local code
  code=$(curl -sS -o /tmp/xiom-smoke-body.json -w "%{http_code}" -X "$method" "$url" \
    -H "Accept: application/json" \
    --connect-timeout 10 \
    --max-time 30 || echo "000")

  if [[ "$code" == "$expect" ]]; then
    echo "PASS  $method $path → $code"
    PASS=$((PASS + 1))
  elif [[ "$soft" == "1" ]]; then
    echo "SOFT  $method $path → $code (expected $expect; optional)"
    SOFT=$((SOFT + 1))
  else
    echo "FAIL  $method $path → $code (expected $expect)"
    FAIL=$((FAIL + 1))
  fi
}

echo "XIOM smoke — BASE_URL=$BASE_URL"
echo "────────────────────────────────────────"

# Health
check GET /health 200

# OpenAPI (not currently mounted — soft)
check GET /openapi.json 200 1
check GET /docs 200 1

# Well-known contracts
check GET /.well-known/xiom-public-contract.json 200
check GET /.well-known/x402.json 200
check GET /.well-known/agent.json 200
check GET /.well-known/mcp.json 200
# Legacy alias soft-check
check GET /.well-known/axiom-public-contract.json 200 1

# Public API surfaces
check GET /api/worldmodel/live 200
check GET /api/site-metrics 307
check GET /api/context/site-metrics 200
check GET /api/token/price 200
check GET /api/bidwall/snapshot 200
check GET /api/agent-access/plans 200
check GET /api/intake/stats 200

# v2 requires auth — expect UNAUTHORIZED envelope
if [[ "$DRY_RUN" == "1" ]]; then
  echo "[dry-run] GET /api/v2/guardrail/rules (expect 401)"
else
  code=$(curl -sS -o /tmp/xiom-smoke-v2.json -w "%{http_code}" \
    "${BASE_URL}/api/v2/guardrail/rules" --connect-timeout 10 --max-time 30 || echo "000")
  body=$(cat /tmp/xiom-smoke-v2.json 2>/dev/null || true)
  if [[ "$code" == "401" ]] && echo "$body" | grep -q 'UNAUTHORIZED'; then
    echo "PASS  GET /api/v2/guardrail/rules → 401 UNAUTHORIZED"
    PASS=$((PASS + 1))
  else
    echo "FAIL  GET /api/v2/guardrail/rules → $code body=$body"
    FAIL=$((FAIL + 1))
  fi
fi

echo "────────────────────────────────────────"
echo "Results: PASS=$PASS FAIL=$FAIL SOFT=$SOFT"
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
exit 0

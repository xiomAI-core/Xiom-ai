# XIOM Production Launch Checklist

Adapted for **Robinhood Chain** (chainId `4663` / testnet `46630`), **USDG**, **Blockscout**, and **xiom-ai.com** domains.

Legend: ✅ local/CI · ☁️ requires GCP/prod · 🔗 requires live chain/RPC · ⏭ marketing (out of scope)

---

## 1. Branding & domains

| Item | Status | Notes |
|------|--------|-------|
| Brand is XIOM / `@xiom/*` | ✅ | Packages use `@xiom/*` |
| API host `https://api.xiom-ai.com` | ☁️ | Smoke script default |
| App/web `https://xiom-ai.com` / `https://app.xiom-ai.com` | ☁️ | CORS allowlist in `apps/api` |
| Well-known `xiom-public-contract.json` | ✅/☁️ | Mounted locally; verify via smoke |

## 2. Chain & payments

| Item | Status | Notes |
|------|--------|-------|
| Chain = Robinhood (`4663`), not Base | ✅ | `@xiom/blockchain` CHAIN_IDS |
| Currency = USDG, not USDC | ✅ | x402 + agent-access |
| Explorer = Blockscout URLs | ✅ | `getTxUrl` / chain explorers |
| `verifyUsdgPayment` unit tests | ✅ | Mocked receipts |
| Claim replay → 409 `DUPLICATE_TX` | ✅ | API integration test |
| Quote hash mismatch → 400 | ✅ | API integration test |
| Live USDG transfer on RH | 🔗 | Needs funded wallet + treasury |

## 3. Contracts

| Item | Status | Notes |
|------|--------|-------|
| Foundry tests (`forge test`) | ✅/⏭ | Run if `forge` installed |
| Verified on Blockscout | ☁️/🔗 | Not Basescan |
| Env addresses (`USDG_ADDRESS`, treasury, bidwall) | ☁️ | Zero-address placeholders until deploy |

## 4. Guardian & world model

| Item | Status | Notes |
|------|--------|-------|
| Guardian layers 1–9 unit tests | ✅ | Extended L6/L7/L9 |
| World-model 13 node types + ALLOWED_EDGES | ✅ | |
| Neo4j live schema init | ☁️ | Needs Neo4j |

## 5. API routes

| Item | Status | Notes |
|------|--------|-------|
| Intake human lane / consent / rate limit | ✅ | Integration tests |
| Agent-access plans / quote / claim | ✅ | Integration tests |
| v2 401 UNAUTHORIZED envelope | ✅ | |
| v2 JWT + quota 429 | ✅ | |
| Health / worldmodel/live / token/price / bidwall | ☁️ | Smoke against prod |
| OpenAPI `/docs` | — | Not mounted (soft-fail in smoke) |

## 6. Local verification commands

```bash
pnpm --filter @xiom/guardian test
pnpm --filter @xiom/blockchain test
pnpm --filter @xiom/x402 test
pnpm --filter @xiom/world-model test
pnpm --filter @xiom/api test
pnpm --filter @xiom/guardian type-check
pnpm --filter @xiom/blockchain type-check
pnpm --filter @xiom/x402 type-check
pnpm --filter @xiom/world-model type-check
pnpm --filter @xiom/api type-check
pnpm turbo run build test lint type-check   # may be heavy on Windows
```

Smoke:

```bash
DRY_RUN=1 ./scripts/smoke-test.sh
# or Windows:
.\scripts\smoke-test.ps1 -DryRun
.\scripts\smoke-test.ps1 -BaseUrl https://api.xiom-ai.com
```

## 7. Security

| Item | Status | Notes |
|------|--------|-------|
| Grep for accidental private keys in apps/packages | ✅ | Run before launch |
| No private keys in commits / CI logs | ☁️ | Review secrets manager on GCP |

## 8. Out of scope for this checklist run

- Tweets / marketing launches ⏭
- GCP deploy / Cloud Run cutover ☁️
- Live RH Chain funding & Blockscout verification 🔗

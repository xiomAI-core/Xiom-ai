# Cloudflare rules for XIOM API

Cache TTLs and WAF/rate-limit notes live in [`rules.json`](./rules.json).

## Apply

Wrangler does not cover all Cache Rules / WAF custom rules. Prefer:

1. **Dashboard** — Rules → Cache Rules / Rate limiting / WAF → import expressions from `rules.json`
2. **Terraform** — `cloudflare_ruleset` resources (example sketch below)
3. **API** — Cloudflare Rulesets API with the expressions in `rules.json`

### Terraform sketch

```hcl
resource "cloudflare_ruleset" "xiom_api_cache" {
  zone_id = var.zone_id
  name    = "xiom-api-cache"
  kind    = "zone"
  phase   = "http_request_cache_settings"
  # map each rules.json cache_rules entry to a rule block
}
```

## Cache summary

| Path | Edge TTL | Browser TTL |
|------|----------|-------------|
| `/api/worldmodel/live` | 30s | 10s |
| `/api/token*` | 60s | 30s |
| `/api/site-metrics` | 60s | 30s |
| `/api/bidwall*` | 30s | 15s |
| `/health` | 5s | 0 |

Bypass cache for writes: `/api/intake`, `/api/agent-access`, `/mcp`, `/api/v2`.

## Origin

Cloudflare → Cloud Run `xiom-api` (europe-west1). Keep origin TLS and `CF-Connecting-IP` trusted only at the edge.

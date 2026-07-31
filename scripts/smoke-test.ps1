# XIOM production smoke checks (Robinhood Chain / USDG / xiom-ai.com)
# Usage:
#   .\scripts\smoke-test.ps1
#   .\scripts\smoke-test.ps1 -BaseUrl https://api.xiom-ai.com
#   .\scripts\smoke-test.ps1 -DryRun

param(
  [string]$BaseUrl = $(if ($env:BASE_URL) { $env:BASE_URL } else { "https://api.xiom-ai.com" }),
  [switch]$DryRun
)

$Pass = 0
$Fail = 0
$Soft = 0

function Invoke-Check {
  param(
    [string]$Method,
    [string]$Path,
    [int]$Expect = 200,
    [switch]$Optional
  )

  $url = "$BaseUrl$Path"
  if ($DryRun) {
    Write-Host "[dry-run] $Method $url (expect $Expect)"
    return
  }

  try {
    $resp = Invoke-WebRequest -Uri $url -Method $Method -Headers @{ Accept = "application/json" } `
      -MaximumRedirection 0 -SkipHttpErrorCheck -TimeoutSec 30
    $code = [int]$resp.StatusCode
  } catch {
    if ($_.Exception.Response) {
      $code = [int]$_.Exception.Response.StatusCode
    } else {
      $code = 0
    }
  }

  if ($code -eq $Expect) {
    Write-Host "PASS  $Method $Path -> $code"
    $script:Pass++
  } elseif ($Optional) {
    Write-Host "SOFT  $Method $Path -> $code (expected $Expect; optional)"
    $script:Soft++
  } else {
    Write-Host "FAIL  $Method $Path -> $code (expected $Expect)"
    $script:Fail++
  }
}

Write-Host "XIOM smoke - BASE_URL=$BaseUrl"
Write-Host "----------------------------------------"

Invoke-Check GET /health 200
Invoke-Check GET /openapi.json 200 -Optional
Invoke-Check GET /docs 200 -Optional

Invoke-Check GET /.well-known/xiom-public-contract.json 200
Invoke-Check GET /.well-known/x402.json 200
Invoke-Check GET /.well-known/agent.json 200
Invoke-Check GET /.well-known/mcp.json 200
Invoke-Check GET /.well-known/axiom-public-contract.json 200 -Optional

Invoke-Check GET /api/worldmodel/live 200
Invoke-Check GET /api/site-metrics 307
Invoke-Check GET /api/context/site-metrics 200
Invoke-Check GET /api/token/price 200
Invoke-Check GET /api/bidwall/snapshot 200
Invoke-Check GET /api/agent-access/plans 200
Invoke-Check GET /api/intake/stats 200

if ($DryRun) {
  Write-Host "[dry-run] GET /api/v2/guardrail/rules (expect 401)"
} else {
  try {
    $resp = Invoke-WebRequest -Uri "$BaseUrl/api/v2/guardrail/rules" -Method GET `
      -SkipHttpErrorCheck -TimeoutSec 30
    $code = [int]$resp.StatusCode
    $body = $resp.Content
  } catch {
    $code = 0
    $body = ""
    if ($_.Exception.Response) {
      $code = [int]$_.Exception.Response.StatusCode
    }
  }
  if ($code -eq 401 -and $body -match "UNAUTHORIZED") {
    Write-Host "PASS  GET /api/v2/guardrail/rules -> 401 UNAUTHORIZED"
    $Pass++
  } else {
    Write-Host "FAIL  GET /api/v2/guardrail/rules -> $code"
    $Fail++
  }
}

Write-Host "----------------------------------------"
Write-Host "Results: PASS=$Pass FAIL=$Fail SOFT=$Soft"
if ($Fail -gt 0) { exit 1 }
exit 0

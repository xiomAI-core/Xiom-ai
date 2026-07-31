# Run XIOM Desktop (Windows)
# Tries native Tauri first; falls back to browser UI if cargo is blocked.

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DesktopRoot = Resolve-Path (Join-Path $ScriptDir '..')
$CargoBin = Join-Path $env:USERPROFILE '.cargo\bin'
$ScoopShims = Join-Path $env:USERPROFILE 'scoop\shims'

if (Test-Path $CargoBin) {
  $env:Path = "$CargoBin;$ScoopShims;" + $env:Path
}

Set-Location $DesktopRoot

function Test-CargoAvailable {
  try {
    $null = & cargo --version 2>&1
    return $LASTEXITCODE -eq 0
  } catch {
    return $false
  }
}

if (Test-CargoAvailable) {
  Write-Host 'Starting native Tauri desktop...' -ForegroundColor Green
  pnpm tauri:dev
  exit $LASTEXITCODE
}

Write-Host ''
Write-Host 'cargo is blocked or missing (Windows App Control / PATH).' -ForegroundColor Yellow
Write-Host 'Starting browser dev UI with demo data at http://localhost:1420' -ForegroundColor Cyan
Write-Host ''
Write-Host 'To fix native Tauri:' -ForegroundColor Yellow
Write-Host '  1. Open Windows Security > App & browser control > Smart App Control'
Write-Host '  2. Or allow C:\Users\<you>\.cargo\bin\cargo.exe in your IT policy'
Write-Host '  3. Restart terminal and run: pnpm --filter @xiom/desktop tauri:dev'
Write-Host ''

pnpm dev:web

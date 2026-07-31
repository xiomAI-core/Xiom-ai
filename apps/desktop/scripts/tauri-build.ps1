# Build Tauri release bundles with Rust/cargo on PATH (Windows)
$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DesktopRoot = Resolve-Path (Join-Path $ScriptDir '..')
$CargoBin = Join-Path $env:USERPROFILE '.cargo\bin'
$ScoopShims = Join-Path $env:USERPROFILE 'scoop\shims'
$ScoopCargo = Join-Path $env:USERPROFILE 'scoop\apps\rust\current\cargo\bin'

$extraPaths = @($CargoBin, $ScoopShims, $ScoopCargo) | Where-Object { Test-Path $_ }
if ($extraPaths.Count -gt 0) {
  $env:Path = ($extraPaths -join ';') + ';' + $env:Path
}

Set-Location $DesktopRoot

$cargoCmd = Get-Command cargo -ErrorAction SilentlyContinue
if (-not $cargoCmd) {
  Write-Host 'ERROR: cargo not found on PATH.' -ForegroundColor Red
  Write-Host 'Install Rust: winget install Rustlang.Rustup' -ForegroundColor Yellow
  exit 1
}

Write-Host "Using cargo: $($cargoCmd.Source)" -ForegroundColor Green
pnpm exec tauri build

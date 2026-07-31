# Start Tauri dev with Rust/cargo on PATH (Windows)
$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DesktopRoot = Resolve-Path (Join-Path $ScriptDir '..')
$CargoBin = Join-Path $env:USERPROFILE '.cargo\bin'
$ScoopShims = Join-Path $env:USERPROFILE 'scoop\shims'
$ScoopCargo = Join-Path $env:USERPROFILE 'scoop\apps\rust\current\cargo\bin'
$DevPort = 1420

function Stop-PortListener {
  param([int]$Port)

  $killed = @()
  try {
    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($conn in $connections) {
      $processId = $conn.OwningProcess
      if ($processId -and $processId -notin $killed) {
        $proc = Get-Process -Id $processId -ErrorAction SilentlyContinue
        if ($proc) {
          Write-Host "Freeing port $Port - stopping $($proc.ProcessName) (PID $processId)" -ForegroundColor Yellow
          Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
          $killed += $processId
        }
      }
    }
  } catch {
    # Get-NetTCPConnection may require admin on some systems; ignore and continue
  }

  if ($killed.Count -gt 0) {
    Start-Sleep -Seconds 1
  }
}

$extraPaths = @($CargoBin, $ScoopShims, $ScoopCargo) | Where-Object { Test-Path $_ }
if ($extraPaths.Count -gt 0) {
  $env:Path = ($extraPaths -join ';') + ';' + $env:Path
}

Set-Location $DesktopRoot

$cargoCmd = Get-Command cargo -ErrorAction SilentlyContinue
if (-not $cargoCmd) {
  Write-Host ''
  Write-Host 'ERROR: cargo not found on PATH.' -ForegroundColor Red
  Write-Host 'Install Rust: winget install Rustlang.Rustup' -ForegroundColor Yellow
  Write-Host 'Then close and reopen this terminal, or run:' -ForegroundColor Yellow
  Write-Host "  `$env:Path = `"$CargoBin;`" + `$env:Path" -ForegroundColor Cyan
  Write-Host ''
  Write-Host 'Falling back to browser UI: pnpm dev:web  ->  http://localhost:1420' -ForegroundColor Green
  Stop-PortListener -Port $DevPort
  pnpm dev:web
  exit $LASTEXITCODE
}

Stop-PortListener -Port $DevPort

Write-Host "Using cargo: $($cargoCmd.Source)" -ForegroundColor Green
pnpm exec tauri dev

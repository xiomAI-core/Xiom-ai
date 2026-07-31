# Add Rust cargo to your user PATH permanently (run once)
$CargoBin = Join-Path $env:USERPROFILE '.cargo\bin'
$ScoopShims = Join-Path $env:USERPROFILE 'scoop\shims'

if (-not (Test-Path $CargoBin)) {
  Write-Host 'Rust not found. Install with: winget install Rustlang.Rustup' -ForegroundColor Red
  exit 1
}

$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$toAdd = @($CargoBin, $ScoopShims) | Where-Object { Test-Path $_ -and $userPath -notlike "*$_*" }

if ($toAdd.Count -eq 0) {
  Write-Host 'cargo is already on your user PATH.' -ForegroundColor Green
} else {
  $newPath = ($toAdd -join ';') + ';' + $userPath
  [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
  $env:Path = ($toAdd -join ';') + ';' + $env:Path
  Write-Host 'Added to user PATH:' -ForegroundColor Green
  $toAdd | ForEach-Object { Write-Host "  $_" }
  Write-Host 'Close and reopen your terminal, then run: pnpm --filter @xiom/desktop tauri:dev' -ForegroundColor Cyan
}

& "$CargoBin\cargo.exe" --version

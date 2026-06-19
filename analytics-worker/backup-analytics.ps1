$ErrorActionPreference = "Stop"

$workerRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backupRoot = Join-Path $workerRoot "backups"
$npx = "C:\Program Files\nodejs\npx.cmd"
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$target = Join-Path $backupRoot "lansei-blog-analytics_$timestamp.sql"

New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null

Push-Location $workerRoot
try {
  & $npx --yes wrangler d1 export lansei-blog-analytics --remote --output $target
  if ($LASTEXITCODE -ne 0) {
    throw "Wrangler export failed with exit code $LASTEXITCODE."
  }
} finally {
  Pop-Location
}

Write-Output "Analytics backup saved to $target"

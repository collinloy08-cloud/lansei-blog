$ErrorActionPreference = "Stop"
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = [Console]::OutputEncoding

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$npx = "C:\Program Files\nodejs\npx.cmd"

function Invoke-AnalyticsQuery([string]$QueryFile) {
  $sql = (Get-Content -Raw -Encoding UTF8 (Join-Path $root $QueryFile) -ErrorAction Stop) -replace "\s+", " "
  $sql = $sql.Trim()
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $output = & $npx --yes wrangler d1 execute lansei-blog-analytics --remote --command "$sql" --json 2>$null
  $ErrorActionPreference = $previousPreference
  if ($LASTEXITCODE -ne 0) {
    throw "Wrangler query failed for $QueryFile with exit code $LASTEXITCODE."
  }
  $payload = ($output -join "`n") | ConvertFrom-Json
  return @($payload[0].results)
}

$dashboard = @(Invoke-AnalyticsQuery "queries\dashboard.sql")
$row = if ($dashboard.Count) { $dashboard[0] } else { $null }

[ordered]@{
  totals_json = if ($row) { $row.totals_json } else { '{}' }
  pages_json = if ($row) { $row.pages_json } else { '[]' }
  recent_json = if ($row) { $row.recent_json } else { '[]' }
} | ConvertTo-Json -Depth 8 -Compress

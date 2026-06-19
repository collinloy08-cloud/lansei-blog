$ErrorActionPreference = "Stop"

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

$totals = @(Invoke-AnalyticsQuery "queries\totals.sql")
$pages = @(Invoke-AnalyticsQuery "queries\pages.sql")
$recent = @(Invoke-AnalyticsQuery "queries\recent.sql")

[ordered]@{
  totals = if ($totals.Count) { $totals[0] } else { @{} }
  pages = $pages
  recent = $recent
} | ConvertTo-Json -Depth 8 -Compress

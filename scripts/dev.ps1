# Start AEM Edge Delivery local dev server (Windows)
Set-Location $PSScriptRoot\..

if (-not (Test-Path "node_modules\@adobe\aem-cli")) {
  Write-Host "Installing dependencies..."
  npm install
}

Write-Host "Starting dev server at http://localhost:3000"
Write-Host "Draft pages: http://localhost:3000/drafts/en-us"
npx @adobe/aem-cli up --no-open --forward-browser-logs --stop-other

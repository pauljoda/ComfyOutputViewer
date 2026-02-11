param(
  [switch]$Production
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

function Test-Command($Name) {
  return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

if (-not (Test-Command "node")) {
  Write-Error "Node.js is required but was not found in PATH."
}

if (-not (Test-Command "npm")) {
  Write-Error "npm is required but was not found in PATH."
}

$nodeVersion = node -v
$nodeMajor = [int](node -p "process.versions.node.split('.')[0]")
if ($nodeMajor -lt 20) {
  Write-Error "Node.js 20+ is required (found $nodeVersion)."
}

Write-Host "Installing dependencies..."
if ($Production) {
  npm install --omit=dev
} else {
  npm install
}

Write-Host "Building web client..."
npm run build

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created .env from .env.example"
}

Write-Host ""
Write-Host "Install complete."
Write-Host ""
Write-Host "Start the app:"
Write-Host "  npm run start"
Write-Host ""
Write-Host "Default URL:"
Write-Host "  http://localhost:8008"

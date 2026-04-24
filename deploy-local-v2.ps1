# Deploy Local - Finance-Agent-Analyzer

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "Finance-Agent-Analyzer - Deploy Local" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# Set directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Load .env.local
Write-Host "Loading configuration from .env.local..." -ForegroundColor Green

$envContent = Get-Content ".env.local" -ErrorAction Stop
$IMAGE_TAG = "local"
$WEB_PORT = "8190"
$REGISTRY = "local"

foreach ($line in $envContent) {
    if ($line -match '^\s*#' -or [string]::IsNullOrWhiteSpace($line)) {
        continue
    }
    $parts = $line.Split("=", 2)
    if ($parts.Count -ne 2) {
        continue
    }
    $key = $parts[0].Trim()
    $value = $parts[1].Trim()
    [System.Environment]::SetEnvironmentVariable($key, $value, "Process")

    if ($line -like "IMAGE_TAG=*") {
        $IMAGE_TAG = $line.Split("=")[1]
    }
    if ($line -like "WEB_PUBLIC_PORT=*") {
        $WEB_PORT = $line.Split("=")[1]
    }
    if ($line -like "REGISTRY=*") {
        $REGISTRY = $line.Split("=")[1]
    }
}

[System.Environment]::SetEnvironmentVariable("IMAGE_TAG", $IMAGE_TAG, "Process")
[System.Environment]::SetEnvironmentVariable("REGISTRY", $REGISTRY, "Process")

Write-Host "Configuration loaded:"
Write-Host "  IMAGE_TAG: $IMAGE_TAG"
Write-Host "  REGISTRY: $REGISTRY"
Write-Host "  WEB_PORT: $WEB_PORT"
Write-Host ""

# Build frontend first
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "Step 1: Building Frontend (Vite)" -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Installing dependencies with pnpm..." -ForegroundColor Yellow

$projectRoot = $scriptDir
$artifactsDir = Join-Path $projectRoot "artifacts"
$finagentDir = Join-Path $artifactsDir "finagent"

# Clean and install in finagent directory
Push-Location $finagentDir
try {
    if (Test-Path -Path "node_modules") { Remove-Item -Path "node_modules" -Recurse -Force }
    if (Test-Path -Path "pnpm-lock.yaml") { Remove-Item -Path "pnpm-lock.yaml" -Force }
    
    corepack enable
    corepack prepare pnpm@latest --activate
    pnpm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
} finally {
    Pop-Location
}
Write-Host "OK" -ForegroundColor Green
Write-Host ""

Write-Host "Building finagent frontend..." -ForegroundColor Yellow
Push-Location $finagentDir
try {
    pnpm exec vite build --config vite.config.ts
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to build frontend" -ForegroundColor Red
        exit 1
    }
} finally {
    Pop-Location
}
Write-Host "OK" -ForegroundColor Green
Write-Host ""

# Build Docker images
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "Step 2: Building Docker Images" -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/3] Building api-server..." -ForegroundColor Yellow
docker build -f deploy/Dockerfile.api-server -t cofinance-api-server:$IMAGE_TAG .
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to build api-server" -ForegroundColor Red
    exit 1
}
Write-Host "OK" -ForegroundColor Green
Write-Host ""

Write-Host "[2/3] Building web (finagent)..." -ForegroundColor Yellow
docker build -f deploy/Dockerfile.web `
    -t cofinance-web:$IMAGE_TAG .
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to build web" -ForegroundColor Red
    exit 1
}
Write-Host "OK" -ForegroundColor Green
Write-Host ""

Write-Host "[3/3] Building migrator..." -ForegroundColor Yellow
docker build -f deploy/Dockerfile.migrator -t cofinance-migrator:$IMAGE_TAG .
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to build migrator" -ForegroundColor Red
    exit 1
}
Write-Host "OK" -ForegroundColor Green
Write-Host ""

# Tag as latest
Write-Host "Tagging images as :latest..." -ForegroundColor Yellow
docker tag cofinance-api-server:$IMAGE_TAG cofinance-api-server:latest
docker tag cofinance-web:$IMAGE_TAG cofinance-web:latest
docker tag cofinance-migrator:$IMAGE_TAG cofinance-migrator:latest
docker tag cofinance-api-server:$IMAGE_TAG $REGISTRY/cofinance-api-server:$IMAGE_TAG
docker tag cofinance-web:$IMAGE_TAG $REGISTRY/cofinance-web:$IMAGE_TAG
docker tag cofinance-migrator:$IMAGE_TAG $REGISTRY/cofinance-migrator:$IMAGE_TAG
Write-Host "OK" -ForegroundColor Green
Write-Host ""

# Deploy
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "Step 2: Starting Docker Compose Stack" -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host ""

docker-compose -f docker-compose.yml up -d --force-recreate
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to start docker-compose" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Waiting for services to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

# Check status
Write-Host ""
Write-Host "=========================================================" -ForegroundColor Green
Write-Host "DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "=========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Web Application:   http://localhost:$WEB_PORT"
Write-Host "API Server:        http://localhost:8080"
Write-Host "PostgreSQL:        localhost:5432"
Write-Host ""
Write-Host "Useful Commands:" -ForegroundColor Green
Write-Host "  > docker-compose logs -f api-server     (view API logs)"
Write-Host "  > docker-compose logs -f web             (view web logs)"
Write-Host "  > docker-compose ps                      (view status)"
Write-Host "  > docker-compose down                    (stop stack)"
Write-Host "  > docker-compose down -v                 (stop and remove volumes)"
Write-Host ""

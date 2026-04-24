# Script de Deploy Local - Finance-Agent-Analyzer
# Requer: Docker, Docker Compose, pnpm

param(
    [switch]$SkipBuild = $false,
    [switch]$Down = $false
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptPath = Split-Path -Parent (Resolve-Path $MyInvocation.MyCommand.Path)
Set-Location $scriptPath

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "🚀 Finance-Agent-Analyzer - Deploy Local" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Se foi solicitado só derrubar, faz só isso
if ($Down) {
    Write-Host ""
    Write-Host "Derrubando containers..." -ForegroundColor Yellow
    docker-compose -f docker-compose.yml down
    Write-Host "✅ Containers derrubados" -ForegroundColor Green
    exit 0
}

# Verify Docker
Write-Host ""
Write-Host "✓ Verificando Docker..." -ForegroundColor Green
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Docker não está instalado ou não está no PATH" -ForegroundColor Red
    exit 1
}

# Load environment variables from .env.local
Write-Host "✓ Carregando variáveis de ambiente..." -ForegroundColor Green
$envFile = ".env.local"
if (-not (Test-Path $envFile)) {
    Write-Host "❌ Arquivo $envFile não encontrado!" -ForegroundColor Red
    exit 1
}

$envVars = @{}
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') {
        $envVars[$matches[1]] = $matches[2]
    }
}

$envVars.GetEnumerator() | ForEach-Object {
    [Environment]::SetEnvironmentVariable($_.Key, $_.Value, [System.EnvironmentVariableTarget]::Process)
}

$IMAGE_TAG = $envVars["IMAGE_TAG"]
$WEB_PORT = if ($envVars["WEB_PUBLIC_PORT"]) { $envVars["WEB_PUBLIC_PORT"] } else { "8190" }

Write-Host "  - IMAGE_TAG: $IMAGE_TAG"
Write-Host "  - WEB_PORT:  $WEB_PORT"
Write-Host ""

# Build images if not skipped
if (-not $SkipBuild) {
    Write-Host "📦 Step 1: Build das imagens Docker..." -ForegroundColor Cyan
    Write-Host "==================================================" -ForegroundColor Cyan

    Write-Host "Building api-server..." -Yellow
    docker build `
        -f deploy/Dockerfile.api-server `
        -t cofinance-api-server:$IMAGE_TAG `
        .
    
    Write-Host ""
    Write-Host "Building web (finagent)..." -Yellow
    docker build `
        -f deploy/Dockerfile.web `
        --build-arg VITE_CLERK_PUBLISHABLE_KEY=$($envVars["VITE_CLERK_PUBLISHABLE_KEY"]) `
        --build-arg VITE_CLERK_PROXY_URL=$($envVars["VITE_CLERK_PROXY_URL"]) `
        -t cofinance-web:$IMAGE_TAG `
        .
    
    Write-Host ""
    Write-Host "Building migrator..." -Yellow
    docker build `
        -f deploy/Dockerfile.migrator `
        -t cofinance-migrator:$IMAGE_TAG `
        .

    Write-Host ""
    Write-Host "🐳 Step 2: Tag das imagens..." -Yellow
    Write-Host "==================================================" -Yellow
    docker tag cofinance-api-server:$IMAGE_TAG cofinance-api-server:latest
    docker tag cofinance-web:$IMAGE_TAG cofinance-web:latest
    docker tag cofinance-migrator:$IMAGE_TAG cofinance-migrator:latest
} else {
    Write-Host "⏭️  Pulando build (usando -SkipBuild)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🚀 Step 3: Deploy com Docker Compose..." -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

docker-compose -f docker-compose.yml up -d

Write-Host ""
Write-Host "⏳ Aguardando postgres estar pronto..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Health check
Write-Host ""
Write-Host "🏥 Verificando saúde dos containers..." -ForegroundColor Yellow
$maxRetries = 30
$retry = 0
while ($retry -lt $maxRetries) {
    $status = docker-compose ps --format "table {{.Service}}\t{{.Status}}" 2>$null
    if ($status -match "healthy|running") {
        Write-Host "✅ Containers estão saudáveis" -ForegroundColor Green
        break
    }
    $retry++
    Start-Sleep -Seconds 1
}

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "✅ Deploy concluído com sucesso!" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "📋 URLs disponíveis:" -ForegroundColor Green
Write-Host "   - Aplicação Web: http://localhost:$WEB_PORT" -ForegroundColor Cyan
Write-Host "   - API Server:    http://localhost:8080" -ForegroundColor Cyan
Write-Host "   - PostgreSQL:    localhost:5432" -ForegroundColor Cyan
Write-Host ""
Write-Host "💡 Comandos úteis:" -ForegroundColor Green
Write-Host "   - Ver logs:        docker-compose logs -f api-server" -ForegroundColor Gray
Write-Host "   - Ver status:      docker-compose ps" -ForegroundColor Gray
Write-Host "   - Parar stack:     docker-compose down" -ForegroundColor Gray
Write-Host "   - Parar e remover: docker-compose down -v" -ForegroundColor Gray
Write-Host ""

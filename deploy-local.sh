#!/bin/bash

# Script de Deploy Local - Finance-Agent-Analyzer
# Requer: Docker, Docker Compose, pnpm

set -e

echo "=================================================="
echo "🚀 Finance-Agent-Analyzer - Deploy Local"
echo "=================================================="

cd "$(dirname "$0")"

# Carregar variáveis de ambiente
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
    echo "✓ Variáveis de ambiente carregadas de .env.local"
else
    echo "❌ Arquivo .env.local não encontrado!"
    exit 1
fi

# Verificar Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker não está instalado ou não está no PATH"
    exit 1
fi

echo ""
echo "📦 Step 1: Build das imagens Docker..."
echo "=================================================="

# Build da imagem api-server
echo "Building api-server..."
docker build \
  -f deploy/Dockerfile.api-server \
  -t cofinance-api-server:${IMAGE_TAG} \
  .

# Build da imagem web
echo "Building web (finagent)..."
docker build \
  -f deploy/Dockerfile.web \
  --build-arg VITE_CLERK_PUBLISHABLE_KEY="${VITE_CLERK_PUBLISHABLE_KEY}" \
  --build-arg VITE_CLERK_PROXY_URL="${VITE_CLERK_PROXY_URL}" \
  -t cofinance-web:${IMAGE_TAG} \
  .

# Build da imagem migrator (Dockerfile.migrator)
echo "Building migrator..."
docker build \
  -f deploy/Dockerfile.migrator \
  -t cofinance-migrator:${IMAGE_TAG} \
  .

echo ""
echo "🐳 Step 2: Tag das imagens..."
echo "=================================================="
docker tag cofinance-api-server:${IMAGE_TAG} cofinance-api-server:latest
docker tag cofinance-web:${IMAGE_TAG} cofinance-web:latest
docker tag cofinance-migrator:${IMAGE_TAG} cofinance-migrator:latest

echo ""
echo "🚀 Step 3: Deploy com Docker Compose..."
echo "=================================================="

docker-compose -f docker-compose.yml up -d

echo ""
echo "⏳ Aguardando postgres estar pronto..."
sleep 10

echo ""
echo "✅ Deploy concluído!"
echo ""
echo "📋 URLs disponíveis:"
echo "   - Aplicação Web: http://localhost:${WEB_PUBLIC_PORT:-8190}"
echo "   - API Server:    http://localhost:8080"
echo "   - PostgreSQL:    localhost:5432"
echo ""
echo "💡 Comandos úteis:"
echo "   - Ver logs:        docker-compose logs -f api-server"
echo "   - Ver status:      docker-compose ps"
echo "   - Parar stack:     docker-compose down"
echo "   - Parar e remover: docker-compose down -v"
echo ""
echo "🔧 Variáveis de ambiente usadas:"
echo "   - NODE_ENV:   ${NODE_ENV}"
echo "   - LOG_LEVEL:  ${LOG_LEVEL}"
echo "   - IMAGE_TAG:  ${IMAGE_TAG}"
echo ""

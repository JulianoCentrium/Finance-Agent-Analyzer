#!/usr/bin/env bash
# Build & push as três imagens (api-server, web, migrator) para o registry.
# Uso:  ./deploy/build-and-push.sh           # lê deploy/.env
#       ./deploy/build-and-push.sh v1.2.3    # sobrescreve IMAGE_TAG
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERRO: $ENV_FILE não existe. Copie deploy/.env.example e preencha." >&2
  exit 1
fi
# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

if [[ -n "${1:-}" ]]; then
  IMAGE_TAG="$1"
fi

: "${REGISTRY:?REGISTRY não definido}"
: "${IMAGE_TAG:?IMAGE_TAG não definido}"
: "${VITE_CLERK_PUBLISHABLE_KEY:?VITE_CLERK_PUBLISHABLE_KEY obrigatória (vai pro bundle)}"
: "${VITE_CLERK_PROXY_URL:=/api/__clerk}"

echo ">> Construindo imagens com tag '$IMAGE_TAG' para registry '$REGISTRY'"
cd "$ROOT_DIR"

docker build \
  -f deploy/Dockerfile.api-server \
  -t "${REGISTRY}/cofinance-api-server:${IMAGE_TAG}" \
  -t "${REGISTRY}/cofinance-api-server:latest" \
  .

docker build \
  -f deploy/Dockerfile.web \
  --build-arg VITE_CLERK_PUBLISHABLE_KEY="${VITE_CLERK_PUBLISHABLE_KEY}" \
  --build-arg VITE_CLERK_PROXY_URL="${VITE_CLERK_PROXY_URL}" \
  -t "${REGISTRY}/cofinance-web:${IMAGE_TAG}" \
  -t "${REGISTRY}/cofinance-web:latest" \
  .

docker build \
  -f deploy/Dockerfile.migrator \
  -t "${REGISTRY}/cofinance-migrator:${IMAGE_TAG}" \
  -t "${REGISTRY}/cofinance-migrator:latest" \
  .

echo ">> Push para o registry"
docker push "${REGISTRY}/cofinance-api-server:${IMAGE_TAG}"
docker push "${REGISTRY}/cofinance-api-server:latest"
docker push "${REGISTRY}/cofinance-web:${IMAGE_TAG}"
docker push "${REGISTRY}/cofinance-web:latest"
docker push "${REGISTRY}/cofinance-migrator:${IMAGE_TAG}"
docker push "${REGISTRY}/cofinance-migrator:latest"

echo ">> Pronto. Para fazer deploy:"
echo "   cd deploy && IMAGE_TAG=${IMAGE_TAG} docker stack deploy -c docker-compose.yml --with-registry-auth cofinance"

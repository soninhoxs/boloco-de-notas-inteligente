#!/usr/bin/env bash
# Deploy Mega Brain em VPS Linux (Ubuntu/Debian)
# Uso: ./scripts/deploy-megabrain.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_DIR="$ROOT/backend/docker"
DOMAIN="megabrain.app"

echo "==> Mega Brain deploy ($DOMAIN)"

if ! command -v docker >/dev/null; then
  echo "Instale Docker: https://docs.docker.com/engine/install/"
  exit 1
fi

cd "$COMPOSE_DIR"

if [[ ! -f .env ]]; then
  cp .env.production.example .env
  echo ""
  echo "Arquivo .env criado. EDITE as senhas e OAuth antes de continuar:"
  echo "  nano $COMPOSE_DIR/.env"
  echo ""
  exit 1
fi

if grep -q "ALTERE_ESTA_SENHA" .env 2>/dev/null; then
  echo "ERRO: Troque as senhas padrão em backend/docker/.env antes do deploy."
  exit 1
fi

echo "==> Build e subida dos containers..."
docker compose -f docker-compose.prod.yml up -d --build

echo ""
echo "Deploy iniciado. Verifique:"
echo "  docker compose -f docker-compose.prod.yml ps"
echo "  docker compose -f docker-compose.prod.yml logs -f web"
echo ""
echo "DNS: registro A de $DOMAIN -> IP deste servidor"
echo "Site: https://$DOMAIN"
echo "OAuth GitHub: https://$DOMAIN/api/v1/auth/github/callback"

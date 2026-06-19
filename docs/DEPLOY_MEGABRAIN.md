# Publicar Mega Brain na internet (megabrain.app)

Este guia publica o app em **https://megabrain.app** com HTTPS automático (Caddy).

## 1. Domínio

1. Registre **megabrain.app** (ou `.com.br` se preferir — ajuste `SITE_DOMAIN` no `.env`).
2. No painel DNS do registrador, crie um registro **A**:
   - Nome: `@` (ou `megabrain.app`)
   - Valor: IP público da sua VPS

## 2. Servidor (VPS)

Recomendado: Ubuntu 22.04+, 2 vCPU, 4 GB RAM, 40 GB disco.

```bash
# Na VPS, instale Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# faça logout/login
```

## 3. Código no servidor

```bash
git clone <seu-repositorio> megabrain
cd megabrain
chmod +x scripts/deploy-megabrain.sh
```

## 4. Configurar ambiente

```bash
cp backend/docker/.env.production.example backend/docker/.env
nano backend/docker/.env
```

Altere obrigatoriamente:

| Variável | Exemplo |
|----------|---------|
| `POSTGRES_PASSWORD` | senha forte |
| `MINIO_ROOT_PASSWORD` | senha forte |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `GITHUB_CLIENT_ID` / `SECRET` | app OAuth no GitHub |
| `GOOGLE_CLIENT_ID` / `SECRET` | (opcional) |

## 5. OAuth (GitHub)

Em [GitHub → Developer settings → OAuth Apps](https://github.com/settings/developers):

- **Homepage URL:** `https://megabrain.app`
- **Authorization callback URL:** `https://megabrain.app/api/v1/auth/github/callback`

## 6. Deploy

```bash
./scripts/deploy-megabrain.sh
```

Ou manualmente:

```bash
cd backend/docker
docker compose -f docker-compose.prod.yml up -d --build
```

## 7. Verificar

```bash
cd backend/docker
docker compose -f docker-compose.prod.yml ps
curl -s https://megabrain.app/health
```

Abra **https://megabrain.app** no navegador.

## Desenvolvimento local

O deploy de produção não altera o ambiente local:

- Frontend: `cd app && npm run dev` → http://localhost:5173
- Backend: `cd backend && go run ./cmd/api` → http://localhost:8080
- OAuth local: callback `http://localhost:8080/api/v1/auth/github/callback`

## Suporte

- E-mail de privacidade: `privacidade@megabrain.app` (configure no seu provedor de e-mail quando o domínio estiver ativo).

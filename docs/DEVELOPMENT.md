# Guia de desenvolvimento

Instruções operacionais para quem for clonar o repositório e contribuir ou rodar localmente.

## O que pode ir no Git?

| Pode commitar | Não commitar |
|---------------|--------------|
| Código em `app/` e `backend/` | `backend/.env` |
| Scripts `scripts/*.ps1` e `*.sh` | `backend/.env.notebook.local` |
| Arquivos `*.env.example` | `app/.env` com segredos |
| Docker, migrations, documentação | `node_modules/`, `app/dist/` |
| Dados públicos (cidades, traduções) | `.notebook-tunnel.*` |

Os scripts PowerShell automatizam Docker e túnel Cloudflare no Windows. Não contêm credenciais.

## Scripts

| Script | Plataforma | Descrição |
|--------|------------|-----------|
| `start-megabrain-notebook.ps1` | Windows | Stack local na porta 3080 |
| `expose-megabrain-notebook.ps1` | Windows | Notebook + URL pública HTTPS |
| `stop-megabrain-notebook.ps1` | Windows | Para containers e túnel |
| `run-migrations.ps1` | Windows | Migrations Postgres (notebook) |
| `deploy-megabrain.sh` | Linux | Deploy de produção |

## Ambiente local (frontend)

```bash
cd app
npm install
npm run dev
```

API opcional em `localhost:8080` ou via proxy do Vite (`/api/v1`).

## Configuração

1. Copie `app/.env.example` → `app/.env` (se necessário)
2. Copie `backend/.env.example` → `backend/.env` para OAuth e JWT
3. Para notebook: o script `start-megabrain-notebook.ps1` gera `backend/.env.notebook.local`

## Migrations

Automáticas no Docker Compose. Manual no notebook:

```powershell
.\scripts\run-migrations.ps1
```

## Expor testes sem domínio

```powershell
winget install Cloudflare.cloudflared
.\scripts\expose-megabrain-notebook.ps1
```

Atualize `NOTEBOOK_URL` e `ALLOWED_ORIGINS` em `backend/.env.notebook.local` se reiniciar o túnel manualmente.

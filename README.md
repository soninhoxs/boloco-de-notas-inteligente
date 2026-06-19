# Mega Brain

App de anotações pessoais com mapas, anexos, calendário e assistente de IA.  
Repositório monorepo: **frontend** (`app/`), **backend** (`backend/`) e **scripts** de deploy/teste.

## O que pode estar no Git?

Sim — o que foi enviado ao GitHub **pode e deve** ficar versionado:

| Pode commitar | Não commitar (ficam só na sua máquina) |
|---------------|----------------------------------------|
| Código fonte (`app/`, `backend/`) | `backend/.env` (senhas, OAuth, JWT) |
| Scripts PowerShell (`.ps1`) e Bash (`.sh`) | `backend/.env.notebook.local` |
| `*.env.example` (modelos sem segredos) | `app/.env` com chaves reais |
| Docker, migrations, docs | `node_modules/`, `app/dist/` |
| Dados públicos (cidades BR, traduções) | `.notebook-tunnel.*` (túnel temporário) |

Os scripts em `scripts/*.ps1` são **propositalmente** no repositório: automatizam testes no Windows (Docker + link público via Cloudflare). Não contêm senhas — só orquestram o ambiente.

Arquivos de exemplo (`.env.example`) mostram **quais variáveis** configurar, sem valores secretos.

## Estrutura do repositório

```
projeto/
├── app/                 # Frontend React + Vite + TypeScript
├── backend/             # API Go, workers, migrations, Docker
├── scripts/             # Deploy e servidor no notebook (Windows/Linux)
├── docs/                # Deploy em produção, segurança
└── README.md            # Este arquivo
```

Documentação extra:

- [app/README.md](app/README.md) — frontend, convenções, dados locais
- [backend/README.md](backend/README.md) — API, arquitetura, endpoints
- [docs/DEPLOY_MEGABRAIN.md](docs/DEPLOY_MEGABRAIN.md) — publicar na internet com domínio
- [docs/SECURITY.md](docs/SECURITY.md) — CSRF, cookies, LGPD

## Requisitos

- **Desenvolvimento local:** Node.js 20+, npm
- **Backend / notebook / produção:** Docker Desktop (Windows) ou Docker (Linux)
- **Expor testes sem domínio:** [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) (`winget install Cloudflare.cloudflared`)

## Desenvolvimento local (só frontend)

```bash
cd app
npm install
npm run dev
```

Abre em http://localhost:5173 (modo convidado usa `localStorage`; API em http://localhost:8080 se o backend estiver rodando).

## Servidor completo no notebook (Windows)

Sobe frontend buildado + API + Postgres + Redis + MinIO em **uma porta**:

```powershell
# Na raiz do repositório
.\scripts\start-megabrain-notebook.ps1
```

Acesse: http://localhost:3080

### Compartilhar link público para testes (sem domínio)

Gera um URL HTTPS temporário (`*.trycloudflare.com`) para qualquer pessoa testar no celular:

```powershell
winget install Cloudflare.cloudflared   # uma vez
.\scripts\expose-megabrain-notebook.ps1
```

O script copia o link para a área de transferência. A URL **muda** cada vez que você roda de novo.

Parar tudo:

```powershell
.\scripts\stop-megabrain-notebook.ps1
```

## Produção (VPS + domínio)

Para uso real na internet (HTTPS fixo, OAuth estável):

1. VPS Linux com Docker
2. Domínio apontando para o servidor
3. Configurar `backend/docker/.env` a partir de `.env.production.example`
4. `./scripts/deploy-megabrain.sh`

Detalhes: [docs/DEPLOY_MEGABRAIN.md](docs/DEPLOY_MEGABRAIN.md)

## Configuração de ambiente

| Arquivo | Uso |
|---------|-----|
| `app/.env.example` | Variáveis do Vite (API, mapas) |
| `backend/.env.example` | OAuth, JWT, SMTP, chaves de IA no servidor |
| `backend/docker/.env.production.example` | Deploy Docker em produção |

Copie o `.example` para `.env` e preencha **apenas na sua máquina**. O `.env` real nunca vai para o Git.

## Funcionalidades principais

- Anotações com tags (ideia, tarefa, gratidão, lembrete)
- Anexos (imagem, PDF) e localização no mapa
- Calendário e grid masonry nas notas
- Modo convidado (dados no navegador) ou conta com sync na nuvem
- Login e-mail, Google, GitHub; MFA; LGPD (política, cookies, exportação)
- Assistente de IA com RAG nas suas notas (chaves de API só no cliente)

## Scripts disponíveis

| Script | Plataforma | Descrição |
|--------|------------|-----------|
| `scripts/start-megabrain-notebook.ps1` | Windows | Sobe stack local na porta 3080 |
| `scripts/expose-megabrain-notebook.ps1` | Windows | Notebook + túnel público HTTPS |
| `scripts/stop-megabrain-notebook.ps1` | Windows | Para containers e túnel |
| `scripts/run-migrations.ps1` | Windows | Migrations do Postgres (notebook) |
| `scripts/deploy-megabrain.sh` | Linux (VPS) | Deploy de produção |

## Licença e repositório

Código no GitHub: [boloco-de-notas-inteligente](https://github.com/soninhoxs/boloco-de-notas-inteligente)

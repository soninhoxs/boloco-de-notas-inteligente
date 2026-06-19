# Mega Brain — Backend

Backend escalável em Go para o **Mega Brain**, projetado para suportar 50k+ usuários.

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway (Nginx)                     │
│              Load Balancing, Rate Limiting, TLS              │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌─────────┐     ┌─────────┐     ┌─────────┐
        │   API   │     │   API   │     │   API   │
        │ Server  │     │ Server  │     │ Server  │
        └────┬────┘     └────┬────┘     └────┬────┘
              └───────────────┼───────────────┘
                              │
    ┌─────────────────────────┼─────────────────────────┐
    ▼                         ▼                         ▼
┌─────────┐             ┌─────────┐             ┌─────────┐
│PgBouncer│             │  Redis  │             │  MinIO  │
│  Pool   │             │ Cache & │             │ Storage │
└────┬────┘             │  Queue  │             └─────────┘
     │                  └────┬────┘
     ▼                       │
┌─────────┐                  │
│PostgreSQL│                 ▼
│(Partitioned)│        ┌─────────┐
└─────────┘            │ Workers │
                       │ (AI)    │
                       └─────────┘
```

## Stack Tecnológica

- **Go 1.22** - Backend API e Workers
- **PostgreSQL 16** - Banco de dados principal (com particionamento)
- **PgBouncer** - Connection pooling
- **Redis 7** - Cache, filas e pub/sub
- **MinIO** - Object storage para anexos
- **Docker/Kubernetes** - Containerização e orquestração

## Estrutura do Projeto

```
backend/
├── cmd/
│   ├── api/main.go          # Entry point da API
│   └── worker/main.go       # Entry point dos workers de IA
├── internal/
│   ├── auth/                # Autenticação JWT
│   ├── notes/               # CRUD de notas
│   ├── ai/                  # Serviço de IA assíncrono
│   ├── user/                # Gestão de usuários
│   ├── storage/             # Integração MinIO
│   └── common/              # Configs, DB, cache, middlewares
├── migrations/              # SQL migrations
├── docker/                  # Dockerfiles e compose
└── k8s/                     # Kubernetes manifests
```

## Começando

### Pré-requisitos

- Go 1.22+
- Docker e Docker Compose
- (Opcional) kubectl para Kubernetes

### Desenvolvimento Local

1. Clone o repositório e navegue para a pasta backend:
```bash
cd backend
```

2. Copie o arquivo de configuração:
```bash
cp .env.example .env
```

3. Edite `.env` com suas configurações (especialmente as API keys de IA).

4. Inicie os serviços com Docker Compose:
```bash
cd docker
docker-compose up -d
```

5. Execute as migrations (primeira vez):
```bash
docker-compose exec postgres psql -U diario -d diario -f /docker-entrypoint-initdb.d/001_initial_schema.up.sql
```

6. A API estará disponível em `http://localhost:8080`

### Build Manual

```bash
# Build da API
go build -o bin/api ./cmd/api

# Build do Worker
go build -o bin/worker ./cmd/worker

# Executar
./bin/api
./bin/worker
```

## API Endpoints

### Autenticação
- `POST /api/v1/auth/register` - Registro de usuário
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/refresh` - Refresh token
- `POST /api/v1/auth/logout` - Logout

### Usuários
- `GET /api/v1/users/me` - Perfil do usuário
- `PUT /api/v1/users/me` - Atualizar perfil
- `PUT /api/v1/users/me/settings` - Atualizar configurações
- `DELETE /api/v1/users/me` - Deletar conta

### Notas
- `GET /api/v1/notes` - Listar notas (paginação cursor-based)
- `POST /api/v1/notes` - Criar nota
- `GET /api/v1/notes/:id` - Obter nota
- `PUT /api/v1/notes/:id` - Atualizar nota
- `DELETE /api/v1/notes/:id` - Deletar nota
- `GET /api/v1/notes/search` - Buscar notas (full-text)
- `GET /api/v1/notes/stats` - Estatísticas

### IA (Assíncrono)
- `POST /api/v1/ai/suggestions` - Solicitar sugestões de IA
- `GET /api/v1/ai/jobs/:jobId` - Status do job
- `GET /api/v1/ai/jobs/:jobId/result` - Resultado do job

### Storage
- `POST /api/v1/storage/upload` - Upload de arquivo
- `POST /api/v1/storage/upload-url` - URL pré-assinada para upload
- `GET /api/v1/storage/download-url` - URL pré-assinada para download
- `DELETE /api/v1/storage/` - Deletar arquivo

## Deploy em Produção (Kubernetes)

1. Aplique os manifests na ordem:
```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmaps/
kubectl apply -f k8s/secrets/  # Edite os secrets primeiro!
kubectl apply -f k8s/services/
kubectl apply -f k8s/deployments/
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/pdb.yaml
```

2. Verifique os pods:
```bash
kubectl get pods -n diario
```

## Estratégias de Escalabilidade

### Evitando Gargalos

1. **Connection Pooling (PgBouncer)**
   - Máximo de 1000 conexões cliente
   - Pool de 50 conexões ao PostgreSQL
   - Modo transação para eficiência

2. **IA Assíncrona**
   - Jobs enfileirados no Redis
   - Workers processam em paralelo
   - Circuit breaker para resiliência

3. **Particionamento de Tabelas**
   - Notas particionadas por mês
   - Queries antigas não afetam performance

4. **Cache Multi-camada**
   - In-memory (por processo)
   - Redis (distribuído)
   - Invalidação automática

5. **Auto-scaling**
   - HPA baseado em CPU/memória
   - API: 3-20 réplicas
   - Workers: 3-15 réplicas

## Configuração de Ambiente

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| PORT | Porta da API | 8080 |
| DATABASE_URL | URL do PostgreSQL | - |
| REDIS_URL | URL do Redis | - |
| MINIO_ENDPOINT | Endpoint do MinIO | - |
| JWT_SECRET | Segredo para tokens JWT | - |
| GROQ_API_KEY | API key do Groq | - |

## Monitoramento

- Health check: `GET /health`
- Métricas Prometheus: `GET /metrics` (quando habilitado)

## Licença

Proprietário - Todos os direitos reservados

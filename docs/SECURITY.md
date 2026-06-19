# Mega Brain — Security & Operations

## Migrações de banco

As migrations `*.up.sql` são aplicadas automaticamente pelo serviço `migrate` no Docker Compose.

Para bancos já existentes (criados antes do `schema_migrations`), o script detecta a tabela `users` e marca `001` e `002` como aplicadas antes de rodar `003_security`.

Manual (notebook):

```powershell
.\scripts\run-migrations.ps1
```

## Controles implementados

| Controle | Descrição |
|----------|-----------|
| Cookies httpOnly | Sessão sem exposição a JavaScript |
| CSRF | Token duplo (`megabrain_csrf` + header `X-CSRF-Token`) |
| MFA TOTP | Autenticação em dois fatores opcional |
| Verificação de e-mail | Obrigatória para contas locais |
| Troca de e-mail | Fluxo com token de confirmação |
| Refresh token family | Reuso revoga todas as sessões |
| Exclusão LGPD | Remove Postgres + MinIO + jobs Redis |
| Exportação LGPD | `GET /api/v1/users/me/export` |
| Consentimento IA | Registro explícito antes de usar provedores externos |
| Audit log | JSON estruturado em stdout |
| Rate limit | App + nginx em produção |

## Subprocessadores de IA (DPA)

Ao ativar a IA, o texto da nota é enviado ao provedor configurado:

- **Groq** — https://groq.com/privacy-policy/
- **OpenAI** — https://openai.com/policies/privacy-policy
- **DeepSeek** — https://www.deepseek.com/privacy

O usuário deve aceitar o consentimento específico de IA nas configurações. Não enviamos dados para treinamento de modelos via esta integração.

## Secrets em produção

- Use variáveis de ambiente ou secret manager (não commite `.env`)
- Rotacione `JWT_SECRET`, chaves OAuth e credenciais MinIO periodicamente
- Regenere `GITHUB_CLIENT_SECRET` se exposto

## Backup

- Postgres: snapshot diário com retenção de 7 dias (configure no provedor)
- MinIO: versionamento ou replicação para bucket de backup
- Teste restore mensalmente

## Partições de notas

Execute mensalmente (ou via cron):

```bash
psql "$DATABASE_URL" -f backend/scripts/ensure-note-partitions.sql
```

## Resposta a incidentes (resumo)

1. **Detectar** — alertas em picos de 401/429, audit logs, `sessions_revoked`
2. **Conter** — revogar sessões (`RevokeAllUserSessions`), rotacionar secrets
3. **Erradicar** — patch, bloquear IP, invalidar tokens OAuth
4. **Recuperar** — restore de backup se necessário
5. **Lições** — documentar timeline e atualizar este playbook

Contato DPO: privacidade@megabrain.app

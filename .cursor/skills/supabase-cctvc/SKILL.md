---
name: supabase-cctvc
description: Conecta e opera o Supabase do projeto CCTVC (quadras, reservas, storage de fotos, migrations SQL). Use ao trabalhar com banco, Storage, env vars, upload de fotos, horários de quadra ou ao executar SQL no projeto.
---

# Supabase — CCTVC

Skill operacional do backend Supabase deste repositório. **Leia este arquivo antes** de alterar schema, Storage, API (`src/services/api.ts`) ou rodar SQL.

## Projeto

| Campo | Valor |
| --- | --- |
| Project ref | `tkqydblejqzwihdjuztb` |
| API URL | `https://tkqydblejqzwihdjuztb.supabase.co` |
| Dashboard | https://supabase.com/dashboard/project/tkqydblejqzwihdjuztb |
| SQL Editor | https://supabase.com/dashboard/project/tkqydblejqzwihdjuztb/sql/new |
| Região do pooler | `aws-1-us-west-2` |
| Host direto (IPv6) | `db.tkqydblejqzwihdjuztb.supabase.co:5432` |
| Pooler (IPv4, preferir) | `aws-1-us-west-2.pooler.supabase.com:6543` |
| Database | `postgres` |
| DB user (pooler) | `postgres.tkqydblejqzwihdjuztb` |

## Credenciais (nunca commitar)

Carregar nesta ordem:

1. Variáveis de ambiente / secrets do Cloud Agent
2. Arquivo local `.env` (já no `.gitignore`)

| Variável | Uso |
| --- | --- |
| `VITE_SUPABASE_URL` | Client do app (Vite) |
| `VITE_SUPABASE_ANON_KEY` | Chave publishable ou anon JWT (client) |
| `SUPABASE_SECRET_KEY` | `sb_secret_...` — API privilegiada (REST/Storage admin) |
| `SUPABASE_DB_URL` | Connection string completa do Postgres |
| `SUPABASE_DB_PASSWORD` | Senha do role `postgres` (se montar a URL manualmente) |

O client do app está em `src/lib/supabase.ts` e usa apenas `VITE_SUPABASE_*`.

**Não** grave senha, secret key ou connection string neste skill nem em arquivos versionados.

### Montar conexão psql (pooler IPv4)

Neste ambiente o host `db.*.supabase.co` costuma resolver só IPv6 e falha. Preferir:

```bash
psql "host=aws-1-us-west-2.pooler.supabase.com port=6543 dbname=postgres user=postgres.tkqydblejqzwihdjuztb sslmode=require" \
  -v ON_ERROR_STOP=1 -f supabase/migrations/NOME.sql
```

Com `PGPASSWORD` ou `SUPABASE_DB_URL` já definidos.

## Schema e migrations

- Schema completo: `supabase/schema.sql`
- Migrations incrementais: `supabase/migrations/`
  - `001_horarios_quadra.sql` — tabela `horarios_quadra` + seed padrão
  - `002_storage_fotos_quadra.sql` — bucket + policies de Storage

Tabelas principais:

- `usuarios`, `quadras`, `fotos_quadras`, `horarios_quadra`, `reservas`

API thin wrappers: `src/services/api.ts`.

## Storage de fotos

| Item | Valor correto |
| --- | --- |
| Bucket | `fotos-quadra` (**singular** — não `fotos-quadras`) |
| Público | sim |
| Constante no código | `COURT_PHOTOS_BUCKET` em `src/services/api.ts` |

Policies necessárias em `storage.objects` (SELECT/INSERT/UPDATE/DELETE com `bucket_id = 'fotos-quadra'`). Sem isso o upload com chave anon/publishable falha com RLS/`Unauthorized`.

Upload do admin:

1. Formulário criar/editar em `AdminPage` (`prepareCourtPhoto` → JPEG)
2. `uploadCourtPhoto(quadraId, file, true)`

## Horários por quadra

- Tabela `horarios_quadra`: `dia_semana` 0=domingo … 6=sábado, `hora_inicio`, `hora_fim`, `intervalo_min`
- Admin: botão **Dias e horários** → `CourtScheduleEditor`
- Reservas: slots vêm da configuração do dia; dias sem horário aparecem como fechados
- Fallback no app se não houver linhas: 07:00–22:00 / 60 min

## Como o agente deve operar

1. **Ler/escrever dados via REST** — `VITE_SUPABASE_ANON_KEY` ou `SUPABASE_SECRET_KEY` nos headers `apikey` e `Authorization: Bearer`.
2. **DDL / migrations SQL** — só com `psql` + pooler (ou SQL Editor). Secret key **não** executa SQL arbitrário.
3. **Antes de culpar o app por upload** — confirmar nome do bucket `fotos-quadra` e policies de Storage.
4. **Após criar migration** — aplicar no projeto remoto e atualizar `schema.sql` quando fizer sentido.
5. **Mensagens de erro** — preferir `getErrorMessage` e separar falha de cadastro vs foto.

## Checagens rápidas

```bash
# Tabelas via REST
curl -sS "$VITE_SUPABASE_URL/rest/v1/quadras?select=id,nome&limit=3" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY"

# Bucket
curl -sS "$VITE_SUPABASE_URL/storage/v1/bucket/fotos-quadra" \
  -H "apikey: $SUPABASE_SECRET_KEY" \
  -H "Authorization: Bearer $SUPABASE_SECRET_KEY"

# Horários
curl -sS "$VITE_SUPABASE_URL/rest/v1/horarios_quadra?select=*&limit=5" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY"
```

## Site / deploy

- Produção: `https://cctvelhacentral.netlify.app`
- Vars de build no Netlify: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (embutidas no bundle Vite)

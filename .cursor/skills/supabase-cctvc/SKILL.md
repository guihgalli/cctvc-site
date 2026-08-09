---
name: supabase-cctvc
description: Conecta e opera o Supabase do projeto CCTVC (quadras, reservas, storage de fotos, migrations SQL). Use ao trabalhar com banco, Storage, env vars, upload de fotos, horários de quadra ou ao executar SQL no projeto. Sempre peça confirmação antes de rodar migrations ou comandos na base.
---

# Supabase — CCTVC

Skill operacional do backend Supabase deste repositório. **Leia este arquivo antes** de alterar schema, Storage, API (`src/services/api.ts`) ou rodar SQL.

## Confirmação obrigatória antes de tocar na base

Sempre que o trabalho envolver **Supabase**, **migration SQL**, **DDL/DML**, **psql**, **RPC no banco remoto** ou qualquer comando que altere/leia dados sensíveis na base de produção:

1. **Explique** o que será feito (arquivo, efeito, risco).
2. **Pergunte explicitamente** se deve rodar automaticamente, por exemplo:
   - «Quer que eu rode a migration `004_….sql` automaticamente no Supabase agora?»
   - «Posso executar esse SQL/psql na base de produção?»
3. **Só execute** após resposta afirmativa do usuário (`sim`, `pode rodar`, `aplica`, etc.).
4. Se a resposta for negativa ou ambígua:
   - deixe o SQL pronto no repositório / mostre o comando;
   - indique o SQL Editor: https://supabase.com/dashboard/project/tkqydblejqzwihdjuztb/sql/new
   - **não** rode `psql` nem aplique a migration.
5. Exceções (pode rodar sem perguntar de novo na mesma tarefa):
   - o usuário já pediu claramente («aplica no Supabase», «roda a migration», «executa na base»);
   - checagens **somente leitura** via REST com chave anon (ex.: listar quadras) para diagnosticar o app — ainda assim, avise o que está consultando.
6. **Nunca** rode migrations/SQL de escrita “por precaução” só porque o código foi commitado ou o PR foi aberto.

Ao **mencionar** no chat que existe migration pendente ou que o backend precisa do SQL, **sempre termine oferecendo** a execução automática (pergunta sim/não), em vez de só documentar o passo.

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
3. Se faltar senha do banco: **pedir ao usuário** (ou `request-environment-setup-actions` com `SUPABASE_DB_PASSWORD`). A skill **não** guarda a senha.

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

> **Só rode o comando acima depois da confirmação do usuário** (seção “Confirmação obrigatória”).

### pgcrypto / `crypt`

No Supabase deste projeto, `crypt` / `gen_salt` ficam no schema **`extensions`**.  
Funções `SECURITY DEFINER` que usam bcrypt devem declarar:

```sql
SET search_path = public, extensions
```

`SET search_path = public` sozinho faz `crypt(...)` falhar em runtime.

## Schema e migrations

- Schema completo: `supabase/schema.sql`
- Migrations incrementais: `supabase/migrations/`
  - `001_horarios_quadra.sql` — tabela `horarios_quadra` + seed padrão
  - `002_storage_fotos_quadra.sql` — bucket + policies de Storage
  - `003_security_hardening.sql` — sessões, RLS, RPCs de auth/reservas/admin
  - `004_alterar_senha.sql` — coluna `senha_hash`, login com hash, RPC `alterar_senha`

Tabelas principais:

- `usuarios` (inclui `senha_hash` após a 004), `quadras`, `fotos_quadras`, `horarios_quadra`, `reservas`, `sessoes`

API thin wrappers: `src/services/api.ts`.

### Fluxo ao criar/alterar migration

1. Escreva/atualize o arquivo em `supabase/migrations/`.
2. Atualize `schema.sql` / README se fizer sentido.
3. **Pergunte**: «Quer que eu aplique essa migration automaticamente no Supabase agora?»
4. Se sim → `psql` no pooler; valide com uma consulta/RPC de sanidade; relate o resultado.
5. Se não → deixe o caminho do arquivo e o link do SQL Editor.
6. **Não faça merge/publish de frontend que dependa da migration** sem ela estar aplicada (ou sem o usuário aceitar o risco).

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

1. **Antes de qualquer escrita/DDL na base** — pedir confirmação (ver seção no topo).
2. **Ler/escrever dados via REST** — `VITE_SUPABASE_ANON_KEY` ou `SUPABASE_SECRET_KEY` nos headers `apikey` e `Authorization: Bearer`. Escrita via REST em dados sensíveis também pede confirmação.
3. **DDL / migrations SQL** — só com `psql` + pooler (ou SQL Editor). Secret key **não** executa SQL arbitrário.
4. **Antes de culpar o app por upload** — confirmar nome do bucket `fotos-quadra` e policies de Storage.
5. **Após criar migration** — oferecer aplicação automática; só aplicar se o usuário aceitar; atualizar `schema.sql` quando fizer sentido.
6. **Mensagens de erro** — preferir `getErrorMessage` e separar falha de cadastro vs foto.
7. **Ao falar de Supabase no PR/README/chat** — incluir a pergunta de execução automática quando houver passo pendente na base.

## Checagens rápidas

```bash
# Tabelas via REST (leitura — ok para diagnóstico; avise o usuário)
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

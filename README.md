# CCTVC - Clube de Caça e Tiro Velha Central

Site institucional com sistema de reserva de quadras esportivas.

## Funcionalidades

- **Home simples** com link para reservas e Instagram
- **Login sócio**: matrícula + senha **ou Google** (e-mail deve ser o mesmo cadastrado no clube, vinculado ao CPF) — reserva confirmada na hora
- **Login visitante**: Google com e-mail não cadastrado — reserva **pendente** até admin aprovar após pagamento
- **Conta**: sócio altera senha; visitante cadastra WhatsApp para confirmação
- **Reservas (usuário)**: visualizar quadras, escolher data/horário conforme disponibilidade da quadra, cancelar reservas
- **Painel Admin**: cadastrar quadras, configurar dias/horários, upload de fotos, **aprovar/recusar reservas pendentes** (WhatsApp automático na aprovação), gerenciar usuários (sócio / não-sócio)
- Validações: não permite reservar datas/horários passados, dias fechados nem horários já ocupados

## Stack

- React + TypeScript + Vite
- Tailwind CSS
- Supabase (banco PostgreSQL + storage de fotos)
- Deploy: Cloudflare Pages

## Configuração Local

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar Supabase

1. Crie uma conta gratuita em [supabase.com](https://supabase.com)
2. Crie um novo projeto
3. No **SQL Editor**, execute o arquivo `supabase/schema.sql`
4. Em seguida execute a migration de segurança: `supabase/migrations/003_security_hardening.sql` (obrigatória — sessões, RLS e RPCs)
5. Execute `supabase/migrations/004_alterar_senha.sql` (senha com hash + alteração pelo próprio usuário)
6. Execute `supabase/migrations/005_usuario_email_telefone.sql` (e-mail e telefone)
7. Execute `supabase/migrations/006_google_socio_aprovacao.sql` (**obrigatória** — Google, sócio/não-sócio, aprovação de reservas)
8. Execute `supabase/migrations/007_socio_google_vinculo.sql` (sócio entra com Google se e-mail/CPF cadastrados)
9. Execute `supabase/migrations/008_reserva_pendente_bloqueia_horario.sql` (pendente também bloqueia o horário)
10. Execute `supabase/migrations/009_google_cadastro_cpf_vinculo.sql` (primeiro Google pede CPF/telefone e vincula sócio)
11. Execute `supabase/migrations/010_admin_excluir_usuario.sql` (admin pode excluir usuário)
12. Se o banco já existia antes dos horários/storage, execute também `001` e `002` antes da `003`
13. Em **Settings > API**, copie a URL e a `anon key`
14. Em **Authentication → URL Configuration** (obrigatório para login Google em produção):
    - **Site URL:** `https://www.cctvc.com.br`
    - **Redirect URLs** (adicione todas):
      - `http://localhost:5173/**`
      - `https://www.cctvc.com.br/**`
      - `https://cctvc.com.br/**`
      - `https://cctvc-site.pages.dev/**` (opcional — preview)
    - Se a Site URL continuar como `cctvc-site.pages.dev`, o OAuth redireciona para o domínio antigo após o Google.
15. Em **Authentication → Providers → Google**, habilite o provider (redirect do Google aponta para `https://<projeto>.supabase.co/auth/v1/callback`).

> A chave `anon` continua no frontend, mas **CPF, usuários, reservas e escritas** só são acessíveis via RPCs com sessão válida. Upload de fotos exige ticket emitido para admin autenticado.

### 3. Variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui
VITE_SITE_URL=https://www.cctvc.com.br
```

`VITE_SITE_URL` define a URL canônica usada no redirect OAuth (login Google). Em produção no Cloudflare Pages, defina também essa variável.

### 4. Rodar localmente

```bash
npm run dev
```

Acesse `http://localhost:5173`

### Login de teste (após executar o schema)

| Campo    | Valor    |
|----------|----------|
| Usuário  | `000001` |
| Senha    | `123`    |

> Senha inicial = 3 primeiros dígitos do CPF cadastrado (12345678901 → 123). Depois o usuário pode alterar em **Conta**.

## Deploy no Cloudflare Pages

### Via Git (recomendado)

1. Repositório conectado no [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
2. Configuração de build:
   - **Framework preset:** None (ou Vite)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
3. Em **Settings → Environment variables**, adicione:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SITE_URL` = `https://www.cctvc.com.br` (redirect OAuth Google)
4. Deploy automático a cada push na branch principal

Headers de segurança (CSP) e redirect SPA estão em `public/_headers` e `public/_redirects`.

### Deploy manual (Wrangler CLI)

```bash
npm run build
npx wrangler pages deploy dist --project-name=cctvc-site
```

### Domínio customizado

1. Em **Pages → seu projeto → Custom domains**, adicione o domínio
2. Configure os DNS no Cloudflare (ou aponte nameservers)
3. HTTPS é provisionado automaticamente

## Estrutura do Projeto

```
src/
├── components/     # Header, Layout, ProtectedRoute
├── contexts/       # AuthContext (login/sessão)
├── lib/            # Supabase client, utilitários
├── pages/          # Home, Login, Reservas, Conta, Admin
├── services/       # Chamadas à API (Supabase)
└── types/          # Tipos TypeScript
supabase/
├── schema.sql                 # Schema completo do banco
└── migrations/                # Scripts incrementais (horários, storage, segurança, senha)
```

### Banco já existente

Execute na ordem, conforme o que ainda faltava:

1. `supabase/migrations/001_horarios_quadra.sql` (se não tiver horários por quadra)
2. `supabase/migrations/002_storage_fotos_quadra.sql` (opcional; a 003 recria as policies de storage)
3. `supabase/migrations/003_security_hardening.sql` (**obrigatória** para o app atual)
4. `supabase/migrations/004_alterar_senha.sql` (**obrigatória** para alterar senha / login com hash)

### Segurança (resumo)

- Login do sócio: **código (6 dígitos) + senha (3 dígitos)**
- Senha armazenada como **hash bcrypt** (`senha_hash`); senha inicial = 3 primeiros dígitos do CPF
- Usuário logado altera a própria senha via RPC `alterar_senha` (exige senha atual, rate limit e rotação de sessão)
- A senha é validada **no servidor** (RPC `fazer_login`); o CPF não é enviado ao browser no login
- Sessão com token opaco (`sessoes`), validada em todas as mutações
- RLS sem acesso direto a `usuarios` / `reservas`; painel admin só via RPCs com perfil admin
- Rate limit básico de tentativas de login por código

## Cadastro de Usuários

O administrador cadastra usuários no painel Admin informando:
- **Código de 6 dígitos** (matrícula do sócio)
- **CPF completo** (11 dígitos)
- **Nome**
- **Perfil** (usuário ou admin)

A senha inicial é gerada automaticamente: **3 primeiros dígitos do CPF**. O sócio pode alterá-la em **Conta** após o login.

## Logo

O arquivo `logo cctvc alta resolução.pdf` pode ser convertido para PNG/SVG e adicionado em `public/logo.png` para uso no site.

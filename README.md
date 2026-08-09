# CCTVC - Clube de Caça e Tiro Velha Central

Site institucional com sistema de reserva de quadras esportivas.

## Funcionalidades

- **Home simples** com link para reservas e Instagram
- **Login** com usuário (6 dígitos) e senha (3 dígitos; inicial = 3 primeiros do CPF)
- **Conta**: usuário logado pode alterar a própria senha
- **Reservas (usuário)**: visualizar quadras, escolher data/horário conforme disponibilidade da quadra, cancelar reservas
- **Painel Admin**: cadastrar quadras, configurar dias/horários disponíveis, upload de fotos, ver agenda, gerenciar usuários
- Validações: não permite reservar datas/horários passados, dias fechados nem horários já ocupados

## Stack

- React + TypeScript + Vite
- Tailwind CSS
- Supabase (banco PostgreSQL + storage de fotos)
- Deploy: Netlify

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
6. Se o banco já existia antes dos horários/storage, execute também `001_horarios_quadra.sql` e `002_storage_fotos_quadra.sql` antes da `003`
7. Em **Settings > API**, copie a URL e a `anon key`

> A chave `anon` continua no frontend, mas **CPF, usuários, reservas e escritas** só são acessíveis via RPCs com sessão válida. Upload de fotos exige ticket emitido para admin autenticado.

### 3. Variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui
```

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

## Deploy no Netlify (testes)

### Opção A: Via Git

1. Suba o projeto para um repositório GitHub
2. Acesse [netlify.com](https://netlify.com) e conecte o repositório
3. Configure as variáveis de ambiente em **Site settings > Environment variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy automático — o `netlify.toml` já está configurado

### Opção B: Deploy manual

```bash
npm run build
npx netlify deploy --prod --dir=dist
```

O Netlify fornecerá um domínio gratuito (`*.netlify.app`) para testes.

## Domínio pago (produção)

Após aprovação do cliente:

1. Compre o domínio (Registro.br, GoDaddy, etc.)
2. No Netlify: **Domain settings > Add custom domain**
3. Configure os DNS conforme instruções do Netlify
4. HTTPS é configurado automaticamente

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

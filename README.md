# CCTVC - Clube de Caça e Tiro Velha Central

Site institucional com sistema de reserva de quadras esportivas.

## Funcionalidades

- **Home simples** com link para reservas e Instagram
- **Login** com usuário (6 dígitos) e senha (3 primeiros dígitos do CPF)
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
4. Em **Storage**, crie um bucket público chamado `fotos-quadras`
5. Em **Settings > API**, copie a URL e a `anon key`

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

> Senha = 3 primeiros dígitos do CPF cadastrado (12345678901 → 123)

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
├── pages/          # Home, Login, Reservas, Admin
├── services/       # Chamadas à API (Supabase)
└── types/          # Tipos TypeScript
supabase/
├── schema.sql                 # Schema completo do banco
└── migrations/                # Scripts incrementais (ex.: horários por quadra)
```

### Banco já existente

Se o projeto Supabase já foi criado antes dos horários por quadra, execute também:

`supabase/migrations/001_horarios_quadra.sql`
```

## Cadastro de Usuários

O administrador cadastra usuários no painel Admin informando:
- **Código de 6 dígitos** (matrícula do sócio)
- **CPF completo** (11 dígitos)
- **Nome**
- **Perfil** (usuário ou admin)

A senha é gerada automaticamente: **3 primeiros dígitos do CPF**.

## Logo

O arquivo `logo cctvc alta resolução.pdf` pode ser convertido para PNG/SVG e adicionado em `public/logo.png` para uso no site.

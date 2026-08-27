# Guia de uso — Painel Administrativo CCTVC

Guia exclusivo para **administradores** do sistema de reservas do Clube de Caça e Tiro Velha Central (CCTVC).

> **Acesso:** apenas usuários com perfil `admin`. Outros perfis são redirecionados para Reservas.

---

## Visão geral

O painel admin concentra três áreas:

| Aba | Rota | Função |
|-----|------|--------|
| **Quadras** | `/admin` | Cadastro, horários, fotos e configuração das quadras |
| **Agenda** | `/admin/agenda` | Aprovar/recusar reservas, liberações e visão geral |
| **Usuários** | `/admin/usuarios` | Cadastro, edição, ativação e exportação de usuários |

O dashboard inicial exibe cards com totais: reservas pendentes, quadras ativas, quadras inativas e usuários cadastrados.

---

## 1. Acesso ao painel

1. Entre com matrícula/senha de admin ou Google vinculado a conta admin
2. Após o login, você será direcionado automaticamente para `/admin`
3. Use o menu superior ou as abas internas para navegar entre **Quadras**, **Agenda** e **Usuários**

---

## 2. Quadras

### Cadastrar nova quadra

1. Aba **Quadras** → formulário **Nova quadra**
2. Preencha:
   - **Nome** (ex.: Beach Tennis 1)
   - **Descrição** (opcional)
   - **Tipo de esporte** (beach tennis, vôlei, futebol society etc.)
   - **Tipo de quadra:**
     - **Geral** — sócios titulares e visitantes
     - **Sócios** — apenas sócios titulares
     - **Locação** — visitantes; sócios só com liberação na Agenda
   - **Expiração pendente (minutos)** — prazo para visitante pagar antes de cancelar automaticamente (padrão comum: 60 min)
   - **Valor visitante (R$)** — cobrado em reservas de não-sócios
   - **Foto** (opcional) — aparece na listagem e na reserva
3. Clique em **Cadastrar**

### Editar quadra existente

1. Na listagem, clique em **Editar** na quadra desejada
2. Altere os campos necessários
3. Para trocar a foto, selecione um novo arquivo (opcional)
4. **Salvar alterações**

### Horários da quadra

Cada quadra tem disponibilidade **por dia da semana**:

1. Na quadra, abra o **Editor de horários**
2. Para cada dia (domingo a sábado):
   - Defina **hora início** e **hora fim**
   - Defina **intervalo** entre slots (ex.: 60 min)
   - Marque se o dia está **ativo**
3. Salve os horários

> Dias sem horário configurado ou inativos não aparecem como disponíveis para reserva.

### Ativar / desativar quadra

- **Desativar:** a quadra deixa de aparecer para novos agendamentos (reservas existentes permanecem)
- **Ativar:** volta a ficar disponível

Use o botão de status na listagem da quadra.

### Excluir quadra

1. Clique em **Excluir**
2. Confirme a ação

> Prefira **desativar** em vez de excluir quando houver histórico de reservas.

---

## 3. Agenda

Central de operação do dia a dia: pendentes de visitantes, liberações e gestão de reservas.

### Filtros

- **Quadra** — filtrar por local
- **Data** — dia específico
- **Só pendentes** — reservas aguardando aprovação
- **Status** — pendente, confirmada, cancelada, recusada, expirada

### Aprovar reserva de visitante

Fluxo recomendado após receber comprovante PIX:

1. Filtre **Só pendentes** ou localize a reserva na data/quadra
2. Verifique: nome, WhatsApp, valor, horário
3. Clique em **Aprovar + WhatsApp**
4. Confirme no diálogo
5. O sistema confirma a reserva e abre o WhatsApp com mensagem pré-formatada para o usuário

> Se o visitante não tiver WhatsApp cadastrado, a aprovação funciona, mas o link do WhatsApp não abrirá — avise manualmente.

### Recusar reserva

1. Clique em **Recusar**
2. *(Opcional)* Informe o motivo
3. Confirme

A reserva é marcada como recusada e o horário é liberado.

### Liberação de quadra de locação para sócios

Quadras do tipo **Locação** normalmente são para visitantes pagantes. Para abrir excepcionalmente a sócios:

1. Na Agenda, seção **Liberações**
2. Escolha a **quadra** de locação
3. Escolha **data** e, se necessário, horário específico (ou dia inteiro)
4. **Liberar**

Para revogar: localize a liberação na lista e **Revogar**.

### Reservar em nome de outro usuário

Admins podem criar reservas para qualquer usuário (ignora limite semanal e período de datas):

1. Em **Reservas** (como admin) ou pela Agenda, clique em **Reservar horário**
2. Busque o usuário por nome, matrícula ou CPF
3. Escolha quadra, data e horário
4. *(Opcional)* Adicione participantes
5. Confirme

---

## 4. Usuários

### Dashboard e filtros

- Tabela paginada com busca e ordenação
- Filtros por perfil, tipo (sócio/visitante), categoria, status
- Badge **pendentes** = visitantes inativos (`não-sócio` + `ativo = false`) aguardando regularização

### Criar usuário

1. **Novo usuário**
2. Campos principais:
   - **Código / matrícula** (4 dígitos — `0` titular, `1–9` dependente)
   - **CPF**, **nome**, **e-mail**, **telefone/WhatsApp**
   - **Perfil:** `usuario` ou `admin`
   - **Tipo:** sócio ou visitante (não-sócio)
   - **Categoria sócio:** titular ou dependente
3. Campos da planilha do clube (quando aplicável):
   - Matrícula planilha, categoria clube (CONTRIBUINTE, SOCIO, REMIDO)
   - Data admissão, nascimento, sexo, parentesco, nº dependente
   - **Titular vinculado** (para dependentes)
4. Salvar

> **Senha inicial:** gerada automaticamente a partir dos 6 primeiros dígitos do CPF.

### Editar usuário

1. Clique em **Editar** na linha do usuário
2. Atualize dados cadastrais, e-mail, telefone, campos da planilha
3. **Redefinir senha:** informe nova senha de 6 dígitos (admin pode resetar sem senha atual)
4. Salvar

### Ativar / desativar usuário

- **Desativar sócio** = marcar como **inadimplente** — bloqueia novas reservas, mas mantém acesso ao sistema
- **Ativar** = regulariza situação

Use os botões de status na tabela ou no modal de edição.

### Excluir usuário

1. **Excluir** → confirme

> Use com cautela. Prefira desativar quando houver histórico de reservas.

### Exportar Excel

1. Aplique os filtros desejados na tabela
2. **Exportar Excel**
3. Baixa planilha com os usuários filtrados

---

## 5. Regras de negócio (referência rápida)

### Quem pode reservar

| Perfil | Reserva |
|--------|---------|
| Admin | Sim (para qualquer usuário) |
| Sócio titular ativo | Sim — confirmada na hora |
| Sócio titular inadimplente | Não |
| Sócio dependente | Não (só participante) |
| Visitante ativo com WhatsApp | Sim — pendente até aprovação |

### Limites automáticos (sócios titulares)

- Máximo **2 reservas por semana** (segunda a domingo)
- Período: **semana atual + próxima** (próxima abre aos **domingos**)
- Admin **não** sofre esses limites ao reservar em nome de terceiros

### Reservas pendentes

- **Bloqueiam** o horário até: aprovação, recusa, cancelamento ou **expiração**
- Expiração: configurável por quadra (`expiracao_pendente_minutos`)
- Após expirar, status muda e o slot volta a ficar livre

### Participantes

- Titular adiciona na criação da reserva
- Usuários **ativos** podem ser participantes
- Dependentes do titular aparecem primeiro na busca
- Participantes veem a reserva em **Minhas Reservas**, mas **não cancelam**

### Tipos de quadra

| Tipo | Sócio titular | Visitante |
|------|---------------|-----------|
| Geral | ✓ | ✓ |
| Sócios | ✓ | ✗ |
| Locação | Só com liberação | ✓ |

---

## 6. Fluxos operacionais recomendados

### Visitante solicita reserva (rotina diária)

```
Visitante reserva → PIX + comprovante WhatsApp → Admin verifica pagamento
→ Aprovar + WhatsApp → Reserva confirmada
```

Se pagamento não chegar a tempo → expiração automática (sem ação necessária).

### Sócio inadimplente quer reservar

1. Usuário tenta reservar → sistema bloqueia
2. Regularize financeiro offline
3. Em **Usuários** → **Ativar** o sócio
4. Sócio pode reservar normalmente

### Evento especial — sócios em quadra de locação

1. **Agenda** → **Liberações**
2. Quadra de locação + data (e horário, se parcial)
3. Comunicar sócios (WhatsApp, mural etc.)
4. Após o evento → **Revogar** liberação se ainda vigente

### Novo sócio na planilha

1. **Usuários** → **Novo usuário**
2. Código 4 dígitos (titular termina em 0)
3. CPF, nome, e-mail, telefone, campos planilha
4. Informar ao sócio: matrícula + senha inicial (6 dígitos do CPF)
5. Orientar alteração de senha em **Conta**

### Dependente precisa acompanhar reserva

1. Titular reserva normalmente
2. Na confirmação, adiciona dependente como **participante**
3. Dependente vê em **Minhas Reservas** com badge "Participante"

---

## 7. Upload de fotos das quadras

- Fotos ficam no **Supabase Storage** (bucket `fotos-quadra`)
- Apenas admin autenticado pode enviar (ticket de upload)
- Formatos de imagem comuns; no celular, o app converte para JPG
- A primeira/principal foto aparece na listagem de reservas

---

## 8. Segurança e boas práticas

- **Não compartilhe** credenciais de admin
- Contas admin devem ter senha forte (6 dígitos numéricos — oriente troca periódica)
- Ao sair de computador compartilhado, use **Sair**
- Verifique sempre o **WhatsApp** e o **valor** antes de aprovar visitantes
- Prefira **desativar** a **excluir** usuários e quadras com histórico
- Mantenha horários das quadras atualizados (feriados, manutenção → desativar dia ou quadra)

---

## 9. Solução de problemas

| Problema | Verificação / ação |
|----------|-------------------|
| Visitante não consegue reservar | WhatsApp cadastrado em Conta? Conta ativa? |
| Sócio não reserva | Ativo? Titular (não dependente)? Já tem 2 reservas na semana? |
| Horário não aparece | Quadra ativa? Dia com horário configurado? Já passou? |
| Pendente não expirou | Conferir `expiracao_pendente_minutos` da quadra |
| WhatsApp não abre na aprovação | Usuário sem telefone cadastrado — avisar manualmente |
| Sócio não entra com Google | E-mail/CPF batem com cadastro? Concluir vínculo em Conta |
| Foto não sobe | Tamanho/formato; tentar outra imagem; verificar sessão admin |

---

## 10. Contato técnico e operacional

| Item | Detalhe |
|------|---------|
| **Secretaria (operacional)** | WhatsApp (47) 98808-0903 |
| **Endereço** | Rua dos Caçadores, 3680 — Velha Central, Blumenau/SC |
| **PIX visitantes** | CNPJ `82.651.480/0001-15` |
| **Deploy** | Cloudflare Pages (`npm run build` → `dist/`) |
| **Banco** | Supabase (RPCs + RLS — dados sensíveis só via API autenticada) |

Para alterações de regras de negócio, migrations ou integrações, consulte a equipe técnica responsável pelo repositório.

---

## Checklist rápido — início do dia

- [ ] Abrir **Agenda** → filtrar **Só pendentes**
- [ ] Aprovar/recusar solicitações de visitantes com comprovante
- [ ] Verificar liberações de locação do dia
- [ ] Conferir quadras inativas ou horários desatualizados
- [ ] Revisar visitantes inativos (badge pendentes em Usuários), se houver

---

*Última atualização: agosto de 2026 — CCTVC Velha Central — Uso restrito a administradores*

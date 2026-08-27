import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  GuideCallout,
  GuideCard,
  GuideFaq,
  GuideMobileNav,
  GuideSection,
  GuideSteps,
  GuideTable,
  GuideToc,
  type GuideNavItem,
} from '../guide/GuidePrimitives'
import { buildWhatsAppUrl, CLUBE_PIX_CNPJ, formatCnpj } from '../../lib/utils'

const ADMIN_GUIDE_NAV: GuideNavItem[] = [
  { id: 'admin-comecar', label: 'Comece aqui' },
  { id: 'admin-quadras', label: 'Quadras' },
  { id: 'admin-agenda', label: 'Agenda' },
  { id: 'admin-usuarios', label: 'Usuários' },
  { id: 'admin-regras', label: 'Regras' },
  { id: 'admin-fluxos', label: 'Fluxos' },
  { id: 'admin-problemas', label: 'Problemas' },
  { id: 'admin-faq', label: 'FAQ' },
]

const ADMIN_FAQ = [
  {
    question: 'Visitante reservou mas não enviou comprovante. O que fazer?',
    answer:
      'Aguarde o prazo de expiração configurado na quadra. Se expirar, o horário libera automaticamente. Se quiser liberar antes, recuse a reserva na Agenda.',
  },
  {
    question: 'WhatsApp não abre ao aprovar reserva.',
    answer:
      'O visitante não tem telefone cadastrado. Aprove normalmente e avise manualmente pelo WhatsApp da secretaria.',
  },
  {
    question: 'Sócio inadimplente quer reservar de novo.',
    answer:
      'Regularize offline e ative o usuário em Usuários. Inadimplência = conta desativada para novas reservas.',
  },
  {
    question: 'Posso excluir uma quadra com histórico?',
    answer:
      'Prefira desativar. Exclusão é irreversível e pode afetar referências de reservas antigas.',
  },
]

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return reduced
}

interface AdminGuideSectionProps {
  pendentesCount?: number
  onIrParaAgenda?: () => void
  onIrParaQuadras?: () => void
  onIrParaUsuarios?: () => void
}

export function AdminGuideSection({
  pendentesCount = 0,
  onIrParaAgenda,
  onIrParaQuadras,
  onIrParaUsuarios,
}: AdminGuideSectionProps) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const [activeSection, setActiveSection] = useState(ADMIN_GUIDE_NAV[0].id)

  useEffect(() => {
    if (prefersReducedMotion) return
    const elements = ADMIN_GUIDE_NAV.map((item) => document.getElementById(item.id)).filter(
      (el): el is HTMLElement => el != null
    )
    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]?.target.id) setActiveSection(visible[0].target.id)
      },
      { rootMargin: '-15% 0px -55% 0px', threshold: [0, 0.25, 0.5] }
    )
    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [prefersReducedMotion])

  return (
    <div className="admin-guide lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <div className="sticky top-28">
          <GuideToc items={ADMIN_GUIDE_NAV} activeId={activeSection} />
        </div>
      </aside>

      <div className="min-w-0 space-y-10">
        <GuideMobileNav items={ADMIN_GUIDE_NAV} activeId={activeSection} />

        <GuideCallout variant="info" title="Guia do administrador">
          Este guia é exclusivo para operações do painel. Para orientações aos sócios e visitantes, veja{' '}
          <Link to="/guia" className="underline font-medium">
            Guia de uso (usuários)
          </Link>
          .
        </GuideCallout>

        <GuideSection
          id="admin-comecar"
          title="Comece aqui"
          description="Rotina recomendada no início do dia e atalhos para as abas do painel."
        >
          {pendentesCount > 0 && (
            <GuideCallout variant="warning" title={`${pendentesCount} reserva(s) pendente(s)`}>
              Verifique comprovantes PIX e aprove ou recuse na aba Agenda.
            </GuideCallout>
          )}

          <GuideCard title="Checklist — início do dia">
            <GuideSteps
              steps={[
                'Abrir Agenda e filtrar só pendentes.',
                'Aprovar visitantes com comprovante (Aprovar + WhatsApp).',
                'Conferir liberações de quadras de locação do dia.',
                'Revisar quadras inativas ou horários desatualizados.',
                'Checar visitantes inativos na aba Usuários, se houver.',
              ]}
            />
          </GuideCard>

          <div className="flex flex-wrap gap-2">
            {onIrParaAgenda && (
              <button type="button" onClick={onIrParaAgenda} className="motion-btn motion-btn--primary motion-btn--md min-h-11">
                Ir para Agenda
              </button>
            )}
            {onIrParaQuadras && (
              <button type="button" onClick={onIrParaQuadras} className="motion-btn motion-btn--secondary motion-btn--md min-h-11">
                Ir para Quadras
              </button>
            )}
            {onIrParaUsuarios && (
              <button type="button" onClick={onIrParaUsuarios} className="motion-btn motion-btn--secondary motion-btn--md min-h-11">
                Ir para Usuários
              </button>
            )}
          </div>
        </GuideSection>

        <GuideSection
          id="admin-quadras"
          title="Quadras"
          description="Cadastro, horários, fotos e configuração das quadras esportivas."
        >
          <GuideCard title="Cadastrar ou editar">
            <GuideSteps
              steps={[
                'Aba Quadras → Nova quadra ou Editar na listagem.',
                'Preencha nome, tipo de esporte, tipo de quadra (Geral, Sócios ou Locação).',
                'Defina expiração de pendente (minutos) e valor visitante (R$).',
                'Opcional: envie foto (convertida para JPG no celular).',
                'Configure horários por dia da semana no editor de horários.',
              ]}
            />
          </GuideCard>
          <GuideTable
            caption="Tipos de quadra"
            headers={['Tipo', 'Sócio titular', 'Visitante']}
            rows={[
              ['Geral', 'Sim', 'Sim'],
              ['Sócios', 'Sim', 'Não'],
              ['Locação', 'Só com liberação na Agenda', 'Sim'],
            ]}
          />
          <GuideCallout variant="info">
            Prefira <strong>desativar</strong> quadras em manutenção em vez de excluir — reservas antigas
            permanecem no histórico.
          </GuideCallout>
        </GuideSection>

        <GuideSection
          id="admin-agenda"
          title="Agenda"
          description="Aprovação de visitantes, liberações e visão geral das reservas."
        >
          <GuideCard title="Aprovar visitante (após PIX)">
            <GuideSteps
              steps={[
                'Filtre Só pendentes ou busque por data/quadra.',
                'Confira nome, WhatsApp, valor e horário.',
                'Clique em Aprovar + WhatsApp e confirme.',
                'O sistema confirma a reserva e abre mensagem pré-formatada.',
              ]}
            />
          </GuideCard>
          <GuideCard title="Liberação para sócios (quadra de locação)">
            <GuideSteps
              steps={[
                'Na seção Liberações, escolha a quadra de locação.',
                'Informe data e, se necessário, horário específico (ou dia inteiro).',
                'Clique em Liberar. Revogue após o evento.',
              ]}
            />
          </GuideCard>
          <GuideCallout variant="warning">
            Reservas pendentes <strong>bloqueiam</strong> o horário até aprovação, recusa, cancelamento ou
            expiração automática.
          </GuideCallout>
        </GuideSection>

        <GuideSection
          id="admin-usuarios"
          title="Usuários"
          description="Cadastro, edição, inadimplência e exportação."
        >
          <GuideCard title="Criar usuário">
            <GuideSteps
              steps={[
                'Novo usuário → código 4 dígitos (0 = titular, 1–9 = dependente).',
                'CPF, nome, e-mail, telefone, perfil (usuario/admin), tipo sócio ou visitante.',
                'Preencha campos da planilha quando aplicável (categoria clube, parentesco, titular).',
                'Senha inicial = 6 primeiros dígitos do CPF.',
              ]}
            />
          </GuideCard>
          <GuideTable
            caption="Ações sobre usuários"
            headers={['Ação', 'Efeito']}
            rows={[
              ['Ativar', 'Sócio pode reservar novamente'],
              ['Desativar', 'Marca inadimplência — bloqueia novas reservas'],
              ['Redefinir senha', 'Admin define nova senha de 6 dígitos'],
              ['Exportar Excel', 'Baixa lista filtrada da tabela'],
            ]}
          />
        </GuideSection>

        <GuideSection
          id="admin-regras"
          title="Regras de negócio"
          description="Referência rápida das validações automáticas do sistema."
        >
          <GuideTable
            caption="Quem pode reservar"
            headers={['Perfil', 'Reserva']}
            rows={[
              ['Admin', 'Sim — em nome de qualquer usuário, sem limite semanal'],
              ['Sócio titular ativo', 'Confirmada na hora — máx. 2/semana'],
              ['Sócio inadimplente', 'Bloqueado'],
              ['Dependente', 'Não — só participante'],
              ['Visitante com WhatsApp', 'Pendente até aprovação'],
            ]}
          />
          <GuideCard title="Período e limites">
            <ul className="text-sm text-stone-600 space-y-2 list-disc pl-5 leading-relaxed max-w-prose">
              <li>Semana atual + próxima (próxima abre aos domingos).</li>
              <li>Admin ignora limite semanal ao reservar por terceiros.</li>
              <li>Expiração de pendente configurável por quadra.</li>
            </ul>
          </GuideCard>
        </GuideSection>

        <GuideSection
          id="admin-fluxos"
          title="Fluxos operacionais"
          description="Cenários frequentes no dia a dia da secretaria."
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <GuideCard title="Visitante → reserva confirmada">
              <p className="text-sm text-stone-600 leading-relaxed">
                Reserva → PIX + comprovante WhatsApp → verificar pagamento → Aprovar + WhatsApp →
                confirmada.
              </p>
            </GuideCard>
            <GuideCard title="Novo sócio na planilha">
              <GuideSteps
                steps={[
                  'Cadastrar em Usuários.',
                  'Informar matrícula e senha inicial (6 dígitos CPF).',
                  'Orientar alteração de senha em Conta.',
                ]}
              />
            </GuideCard>
            <GuideCard title="Evento em quadra de locação">
              <GuideSteps
                steps={[
                  'Agenda → Liberar quadra + data.',
                  'Comunicar sócios.',
                  'Revogar liberação após o evento.',
                ]}
              />
            </GuideCard>
            <GuideCard title="Reserva admin para terceiro">
              <p className="text-sm text-stone-600 leading-relaxed">
                Em Reservas, admin busca usuário por nome/matrícula/CPF e reserva — ignora limite semanal e
                período de datas.
              </p>
            </GuideCard>
          </div>
        </GuideSection>

        <GuideSection id="admin-problemas" title="Solução de problemas">
          <GuideTable
            caption="Problemas comuns e ações"
            headers={['Problema', 'Verificar / ação']}
            rows={[
              ['Visitante não reserva', 'WhatsApp cadastrado? Conta ativa?'],
              ['Sócio não reserva', 'Ativo? Titular? Já tem 2 reservas na semana?'],
              ['Horário não aparece', 'Quadra ativa? Dia com horário? Horário passado?'],
              ['Pendente não expirou', 'Conferir expiração pendente (min) da quadra'],
              ['Foto não sobe', 'Formato/tamanho; tentar outra imagem'],
            ]}
          />
          <GuideCard title="Contato operacional">
            <dl className="text-sm space-y-2 text-stone-600">
              <div>
                <dt className="text-stone-500">Secretaria</dt>
                <dd>
                  <a href={buildWhatsAppUrl()} target="_blank" rel="noopener noreferrer" className="text-emerald-700 font-medium hover:underline">
                    (47) 98808-0903
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-stone-500">PIX visitantes</dt>
                <dd className="font-mono">{formatCnpj(CLUBE_PIX_CNPJ)}</dd>
              </div>
            </dl>
          </GuideCard>
        </GuideSection>

        <GuideSection id="admin-faq" title="Perguntas frequentes">
          <GuideFaq items={ADMIN_FAQ} />
        </GuideSection>

        <GuideCallout variant="success" title="Boas práticas">
          Não compartilhe credenciais admin. Verifique WhatsApp e valor antes de aprovar. Use Sair em
          computadores compartilhados.
        </GuideCallout>

        <p className="text-xs text-stone-400 text-center pt-2 border-t border-stone-100">
          Guia administrativo — agosto de 2026
        </p>
      </div>
    </div>
  )
}

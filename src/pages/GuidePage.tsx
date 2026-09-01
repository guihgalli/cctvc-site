import { useEffect, useMemo, useState } from 'react'

import { Link } from 'react-router-dom'

import { Layout } from '../components/Layout'

import {

  GuideCallout,

  GuideCard,

  GuideFaq,

  GuideFeatureCard,

  GuideMobileNav,

  GuideSection,

  GuideSteps,

  GuideTable,

  GuideToc,

  type GuideNavItem,

} from '../components/guide/GuidePrimitives'

import { CalendarIcon, HomeIcon, ListIcon, UserIcon } from '../components/guide/GuideIcons'

import { useAuth } from '../contexts/AuthContext'

import { labelCategoriaSocio } from '../lib/bookingRules'

import { buildWhatsAppUrl, CLUBE_PIX_CNPJ, formatCnpj } from '../lib/utils'



const GUIDE_NAV: GuideNavItem[] = [

  { id: 'comecar', label: 'Comece aqui' },

  { id: 'visao-geral', label: 'Visão geral' },

  { id: 'seu-perfil', label: 'Seu perfil' },

  { id: 'reservar', label: 'Fazer reserva' },

  { id: 'minhas-reservas', label: 'Minhas reservas' },

  { id: 'conta', label: 'Minha conta' },

  { id: 'regras', label: 'Regras e quadras' },

  { id: 'contato', label: 'Contato' },

  { id: 'faq', label: 'FAQ' },

]

const FAQ_ITEMS = [

  {

    question: 'Qual é o limite de reservas da família?',

    answer:

      'Titular e dependentes compartilham o limite de 2 reservas por semana (segunda a domingo). Reservas pendentes e confirmadas contam para esse total.',

  },

  {

    question: 'Sou dependente. Posso reservar sozinho?',

    answer:

      'Sim. Dependentes podem criar reservas normalmente, respeitando o limite de 2 por semana da família (titular + dependentes).',

  },

  {

    question: 'Estou inadimplente. O que fazer?',

    answer:

      'Regularize sua situação com a secretaria do clube. Enquanto a conta estiver inativa, você pode visualizar horários, mas não criar novas reservas.',

  },

  {

    question: 'Minha reserva pendente sumiu. Por quê?',

    answer:

      'Reservas pendentes de visitantes expiram automaticamente se o pagamento não for confirmado no prazo da quadra. Faça uma nova solicitação ou fale com a secretaria.',

  },

  {

    question: 'Posso reservar para a semana que vem?',

    answer:

      'Sim. A próxima semana (segunda a domingo) abre para reserva aos domingos, junto com a semana atual.',

  },

  {

    question: 'Como incluo meu filho(a) na reserva?',

    answer:

      'Na confirmação da reserva, use Adicionar participantes. Dependentes vinculados ao seu cadastro aparecem automaticamente na lista.',

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



function profileHighlightIndex(

  isVisitante: boolean,

  isInadimplente: boolean,

  isDependente: boolean,

  isTitular: boolean

): number | undefined {

  if (isVisitante) return 3

  if (isInadimplente) return 2

  if (isDependente) return 1

  if (isTitular) return 0

  return undefined

}



export function GuidePage() {

  const { user, isTitular, isDependente, isInadimplente, canBook, isAdmin, isSocio } = useAuth()

  const isVisitante = user?.tipo_socio === 'nao_socio'

  const prefersReducedMotion = usePrefersReducedMotion()

  const [activeSection, setActiveSection] = useState(GUIDE_NAV[0].id)

  const [pixCopiado, setPixCopiado] = useState(false)



  const perfilLabel = useMemo(() => {

    if (!user) return 'Usuário'

    if (isVisitante) return 'Visitante'

    if (isInadimplente) return 'Sócio inadimplente'

    if (isDependente) return 'Sócio dependente'

    if (isTitular) return 'Sócio titular'

    return 'Sócio'

  }, [user, isVisitante, isInadimplente, isDependente, isTitular])



  const highlightRow = profileHighlightIndex(isVisitante, isInadimplente, isDependente, isTitular)



  useEffect(() => {

    if (prefersReducedMotion) return



    const sectionIds = GUIDE_NAV.map((item) => item.id)

    const elements = sectionIds

      .map((id) => document.getElementById(id))

      .filter((el): el is HTMLElement => el != null)



    if (elements.length === 0) return



    const observer = new IntersectionObserver(

      (entries) => {

        const visible = entries

          .filter((entry) => entry.isIntersecting)

          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)

        if (visible[0]?.target.id) {

          setActiveSection(visible[0].target.id)

        }

      },

      { rootMargin: '-20% 0px -55% 0px', threshold: [0, 0.25, 0.5] }

    )



    elements.forEach((el) => observer.observe(el))

    return () => observer.disconnect()

  }, [prefersReducedMotion])



  async function copiarPix() {

    try {

      await navigator.clipboard.writeText(CLUBE_PIX_CNPJ)

      setPixCopiado(true)

      window.setTimeout(() => setPixCopiado(false), 2500)

    } catch {

      setPixCopiado(false)

    }

  }



  return (

    <Layout>

      <div className="guide-page max-w-6xl mx-auto px-4 py-8 lg:py-10">

        <Link

          to="/reservas"

          className="inline-flex items-center text-emerald-700 text-sm hover:underline mb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 rounded"

        >

          ← Voltar às reservas

        </Link>



        <div className="guide-page__hero motion-card border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/40 p-6 sm:p-8 mb-8">

          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">

            <div className="min-w-0">

              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 mb-2">

                Central de ajuda

              </p>

              <h1 className="font-display text-2xl sm:text-3xl font-semibold text-emerald-950 mb-2 text-balance max-w-xl">

                Guia de uso — Reservas

              </h1>

              <p className="text-stone-600 leading-relaxed max-w-prose">

                Tudo o que você precisa saber para reservar quadras, acompanhar agendamentos e gerenciar

                sua conta no CCTVC Velha Central.

              </p>

              {user && (

                <div className="flex flex-wrap items-center gap-2 mt-4">

                  <span className="inline-flex items-center rounded-full bg-emerald-800 px-3 py-1 text-xs font-medium text-white">

                    {perfilLabel}

                  </span>

                  <p className="text-sm text-stone-500">

                    {user.nome}

                    {user.codigo_usuario && (

                      <>

                        {' '}

                        · <span className="font-mono">{user.codigo_usuario}</span>

                      </>

                    )}

                  </p>

                </div>

              )}

            </div>

            <div className="flex flex-wrap gap-2 shrink-0">

              <Link to="/reservas" className="motion-btn motion-btn--primary motion-btn--md min-h-11">

                Ir para reservas

              </Link>

              <Link to="/conta" className="motion-btn motion-btn--secondary motion-btn--md min-h-11">

                Minha conta

              </Link>

            </div>

          </div>

        </div>



        {isAdmin && (
          <div className="mb-6">
            <GuideCallout variant="info" title="Administrador">
              O guia operacional do painel (aprovações, quadras, usuários) está em{' '}
              <Link to="/admin/guias" className="underline font-medium">
                Admin → Guias
              </Link>
              . Esta página é orientada a sócios e visitantes.
            </GuideCallout>
          </div>
        )}



        <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[240px_minmax(0,1fr)]">

          <aside className="hidden lg:block">

            <div className="sticky top-28">

              <GuideToc items={GUIDE_NAV} activeId={activeSection} />

            </div>

          </aside>



          <div className="min-w-0 space-y-10 pb-8">

            <GuideMobileNav items={GUIDE_NAV} activeId={activeSection} />



            <GuideSection

              id="comecar"

              title="Comece aqui"

              description="Siga o caminho mais relevante para o seu perfil."

            >

              {user?.precisa_cadastro && (

                <GuideCallout variant="warning" title="Ação necessária">

                  Conclua CPF e WhatsApp em{' '}

                  <Link to="/conta?cadastro=google" className="underline font-medium">

                    Minha conta

                  </Link>{' '}

                  para liberar reservas.

                </GuideCallout>

              )}



              {user?.precisa_telefone && !user.precisa_cadastro && (

                <GuideCallout variant="warning" title="Ação necessária">

                  Cadastre seu WhatsApp em{' '}

                  <Link to="/conta?cadastro=telefone" className="underline font-medium">

                    Minha conta

                  </Link>{' '}

                  antes de solicitar reservas.

                </GuideCallout>

              )}



              {canBook && isSocio && !isVisitante && (

                <GuideCard title="Próximo passo">

                  <p className="text-sm text-stone-600 mb-4 max-w-prose">

                    Você pode reservar agora. Escolha uma quadra, data e horário — a confirmação é

                    imediata.

                  </p>

                  <Link to="/reservas" className="motion-btn motion-btn--primary motion-btn--md min-h-11">

                    Fazer uma reserva

                  </Link>

                </GuideCard>

              )}



              {isVisitante && canBook && (

                <GuideCard title="Próximo passo">

                  <GuideSteps

                    steps={[

                      'Cadastre WhatsApp em Minha conta (se ainda não fez).',

                      'Solicite a reserva em Nova Reserva.',

                      'Pague via PIX e envie o comprovante pelo WhatsApp.',

                    ]}

                  />

                  <div className="flex flex-wrap gap-2 mt-4">

                    <Link to="/reservas" className="motion-btn motion-btn--primary motion-btn--md min-h-11">

                      Solicitar reserva

                    </Link>

                    <a

                      href={buildWhatsAppUrl()}

                      target="_blank"

                      rel="noopener noreferrer"

                      className="motion-btn motion-btn--whatsapp motion-btn--md min-h-11"

                    >

                      Falar com a secretaria

                    </a>

                  </div>

                </GuideCard>

              )}



              {isDependente && canBook && (

                <GuideCard title="Próximo passo">

                  <p className="text-sm text-stone-600 mb-4 max-w-prose">

                    Você pode reservar quadras normalmente. Lembre-se: sua família (titular +

                    dependentes) compartilha o limite de 2 reservas por semana.

                  </p>

                  <Link to="/reservas" className="motion-btn motion-btn--primary motion-btn--md min-h-11">

                    Fazer uma reserva

                  </Link>

                </GuideCard>

              )}



              {isInadimplente && (

                <GuideCard title="Próximo passo">

                  <p className="text-sm text-stone-600 mb-4 max-w-prose">

                    Regularize pendências financeiras com a secretaria para voltar a reservar.

                  </p>

                  <a

                    href={buildWhatsAppUrl()}

                    target="_blank"

                    rel="noopener noreferrer"

                    className="motion-btn motion-btn--whatsapp motion-btn--md min-h-11"

                  >

                    Contatar secretaria

                  </a>

                </GuideCard>

              )}

            </GuideSection>



            <GuideSection

              id="visao-geral"

              title="Visão geral"

              description="O sistema de reservas permite agendar quadras de beach tennis, vôlei e futebol society pelo site."

            >

              <div className="grid sm:grid-cols-2 gap-4">

                <GuideFeatureCard

                  icon={<CalendarIcon />}

                  title="Reservar quadras"

                  text="Escolha quadra, data e horário disponível conforme seu perfil."

                />

                <GuideFeatureCard

                  icon={<ListIcon />}

                  title="Acompanhar reservas"

                  text="Veja confirmações, pendências e reservas em que você participa."

                />

                <GuideFeatureCard

                  icon={<UserIcon />}

                  title="Gerenciar conta"

                  text="Cadastre WhatsApp ou conclua vínculo com Google."

                />

                <GuideFeatureCard

                  icon={<HomeIcon />}

                  title="Conhecer o clube"

                  text="História, departamentos e contatos na página inicial."

                />

              </div>

            </GuideSection>



            <GuideSection

              id="seu-perfil"

              title="Seu perfil"

              description="As permissões de reserva dependem do tipo de associado cadastrado no clube."

            >

              {canBook && isSocio && !isVisitante && (

                <GuideCallout variant="success" title={`Você está como ${perfilLabel}`}>

                  Suas reservas são <strong>confirmadas na hora</strong>, sem necessidade de aprovação

                  da secretaria. Sua família pode fazer no máximo <strong>2 reservas por semana</strong>.

                </GuideCallout>

              )}



              {isDependente && !canBook && (

                <GuideCallout variant="info" title="Sócio dependente">

                  Você pode visualizar horários, mas não criar novas reservas enquanto houver

                  pendências financeiras no seu cadastro.

                </GuideCallout>

              )}



              {isInadimplente && (

                <GuideCallout variant="danger" title="Pendências financeiras">

                  Regularize sua situação com a secretaria. Enquanto a conta estiver inativa, você só

                  visualiza horários — não pode criar novas reservas.

                </GuideCallout>

              )}



              {isVisitante && canBook && (

                <GuideCallout variant="warning" title="Visitante (não-sócio)">

                  Suas reservas ficam <strong>pendentes</strong> até o pagamento via PIX e aprovação

                  da secretaria. Envie o comprovante pelo WhatsApp após pagar.

                </GuideCallout>

              )}



              <GuideTable

                caption="Comparativo de perfis e permissões de reserva"

                headers={['Perfil', 'Pode reservar?', 'Como funciona']}

                highlightRowIndex={highlightRow}

                rows={[

                  ['Sócio titular (ativo)', 'Sim', 'Reserva confirmada na hora — limite familiar 2/semana'],

                  ['Sócio dependente (ativo)', 'Sim', 'Reserva confirmada na hora — limite familiar 2/semana'],

                  ['Sócio inadimplente', 'Não', 'Acesso ao sistema, sem novos agendamentos'],

                  ['Visitante', 'Sim, com aprovação', 'Reserva pendente até pagamento e confirmação'],

                ]}

              />



              {user?.categoria_socio && !isVisitante && (

                <p className="text-sm text-stone-500">

                  Seu cadastro:{' '}

                  <strong className="text-stone-700">{labelCategoriaSocio(user.categoria_socio)}</strong>

                </p>

              )}

            </GuideSection>



            <GuideSection

              id="reservar"

              title="Fazer uma reserva"

              description="Acesse Reservas no menu e use a aba Nova Reserva."

            >

              {canBook && isSocio && !isVisitante && (

                <GuideCard title="Passo a passo — sócio">

                  <GuideSteps

                    steps={[

                      'Escolha a quadra desejada (nome, modalidade e tipo aparecem no card).',

                      'Selecione a data no calendário horizontal.',

                      'Clique em um horário livre (disponível).',

                      'Opcional: adicione participantes — dependentes aparecem primeiro; para outros, busque por nome, matrícula ou CPF (mínimo 2 caracteres).',

                      'Confirme a reserva. Ela ficará confirmada imediatamente.',

                    ]}

                  />

                </GuideCard>

              )}



              {isVisitante && canBook && (

                <GuideCard title="Passo a passo — visitante">

                  <GuideSteps

                    steps={[

                      'Cadastre seu WhatsApp em Minha conta, se ainda não tiver feito.',

                      'Em Nova Reserva, escolha quadra, data e horário.',

                      'Confirme a solicitação — a reserva ficará pendente.',

                      `Faça o pagamento via PIX (CNPJ ${formatCnpj(CLUBE_PIX_CNPJ)}) no valor indicado.`,

                      'Envie o comprovante pelo botão Enviar comprovante no WhatsApp.',

                      'Aguarde a secretaria aprovar a reserva.',

                    ]}

                  />

                  <div className="mt-4">

                    <GuideCallout variant="warning" title="Prazo de pagamento">

                      Reservas pendentes expiram automaticamente se o pagamento não for confirmado dentro

                      do prazo definido para aquela quadra. O horário volta a ficar disponível.

                    </GuideCallout>

                  </div>

                </GuideCard>

              )}



              {isInadimplente && (

                <GuideCallout variant="danger">

                  Regularize pendências financeiras com a secretaria para voltar a reservar.

                </GuideCallout>

              )}



              <GuideCard title="Legenda de horários">

                <GuideTable

                  caption="Significado dos estados de horário na grade de reservas"

                  headers={['Estado', 'Significado']}

                  rows={[

                    ['Livre', 'Disponível para reserva'],

                    ['Confirmada', 'Já reservado e confirmado'],

                    ['Pendente', 'Aguardando pagamento ou aprovação (bloqueia o horário)'],

                    ['Ocupado / indisponível', 'Não pode ser escolhido'],

                  ]}

                />

              </GuideCard>

            </GuideSection>



            <GuideSection

              id="minhas-reservas"

              title="Minhas reservas"

              description="Na aba Minhas Reservas você vê agendamentos futuros como titular ou participante."

            >

              <GuideSteps

                steps={[

                  'Abra Reservas e selecione a aba Minhas Reservas.',

                  'Visualize reservas futuras com quadra, data, horário e status.',

                  'Reservas em que você foi incluído aparecem com o badge Participante.',

                  'Para cancelar: abra a reserva e clique em Cancelar reserva — quem fez o agendamento pode cancelar.',

                ]}

              />

              <GuideCallout variant="info">

                Participantes incluídos na reserva não cancelam o horário. Se precisar desistir, peça

                a quem criou a reserva.

              </GuideCallout>

            </GuideSection>



            <GuideSection

              id="conta"

              title="Minha conta"

              description="Gerencie dados pessoais e cadastro complementar."

            >

              <GuideCard title="O que você encontra">

                <ul className="text-sm text-stone-600 space-y-2 list-disc pl-5 leading-relaxed max-w-prose">

                  <li>Nome, matrícula, código de usuário e categoria (titular, dependente ou visitante)</li>

                  <li>Dados do cadastro do clube: admissão, nascimento, parentesco, titular vinculado</li>

                  <li>Cadastro de WhatsApp (visitantes)</li>

                  <li>Conclusão de cadastro Google (CPF + WhatsApp no primeiro acesso)</li>

                </ul>

              </GuideCard>



              <GuideCard title="Login com Google">

                  <ul className="text-sm text-stone-600 space-y-2 leading-relaxed max-w-prose">

                    <li>Sócios: use o e-mail cadastrado no clube ou vincule pelo CPF.</li>

                    <li>Primeiro acesso: informe CPF e WhatsApp para concluir.</li>

                    <li>Visitantes: conta criada automaticamente se não houver vínculo de sócio.</li>

                  </ul>

                </GuideCard>

            </GuideSection>



            <GuideSection

              id="regras"

              title="Regras e tipos de quadra"

              description="Limites e restrições aplicados automaticamente pelo sistema."

            >

              <GuideTable

                caption="Tipos de quadra e quem pode reservar"

                headers={['Tipo de quadra', 'Quem pode reservar']}

                rows={[

                  ['Geral', 'Sócios titulares e visitantes'],

                  ['Sócios', 'Apenas sócios titulares'],

                  ['Locação', 'Visitantes sempre; sócios quando a secretaria liberar naquele dia'],

                ]}

              />



              <GuideCard title="Regras gerais">

                <ul className="text-sm text-stone-600 space-y-2 list-disc pl-5 leading-relaxed max-w-prose">

                  <li>

                    <strong>Período:</strong> semana atual (segunda a domingo) + próxima semana.

                  </li>

                  <li>

                    <strong>Próxima semana</strong> abre para reserva aos <strong>domingos</strong>.

                  </li>

                  <li>

                    <strong>Limite:</strong> família (titular + dependentes) — no máximo{' '}

                    <strong>2 reservas por semana</strong> (inclui pendentes e confirmadas).

                  </li>

                  <li>Não é possível reservar datas ou horários passados.</li>

                  <li>Horários ocupados ou pendentes bloqueiam novas reservas naquele slot.</li>

                  <li>Dependentes podem reservar diretamente; o limite semanal é compartilhado com o titular.</li>

                </ul>

              </GuideCard>

            </GuideSection>



            <GuideSection id="contato" title="Contato e suporte">

              <div className="grid sm:grid-cols-2 gap-4">

                <GuideCard title="Secretaria">

                  <dl className="text-sm space-y-2 text-stone-600">

                    <div>

                      <dt className="text-stone-500">WhatsApp / telefone</dt>

                      <dd>

                        <a

                          href={buildWhatsAppUrl()}

                          target="_blank"

                          rel="noopener noreferrer"

                          className="text-emerald-700 font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded"

                        >

                          (47) 98808-0903

                        </a>

                      </dd>

                    </div>

                    <div>

                      <dt className="text-stone-500">Endereço</dt>

                      <dd>

                        Rua dos Caçadores, 3680

                        <br />

                        Velha Central — Blumenau/SC

                      </dd>

                    </div>

                  </dl>

                </GuideCard>

                <GuideCard title="Pagamento (visitantes)">

                  <p className="text-sm text-stone-600 leading-relaxed">PIX via CNPJ do clube:</p>

                  <p className="font-mono text-emerald-900 font-semibold mt-2">{formatCnpj(CLUBE_PIX_CNPJ)}</p>

                  <button

                    type="button"

                    onClick={copiarPix}

                    className="mt-3 motion-btn motion-btn--secondary motion-btn--sm min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"

                  >

                    {pixCopiado ? 'CNPJ copiado!' : 'Copiar CNPJ PIX'}

                  </button>

                  <p className="text-xs text-stone-500 mt-2 max-w-prose">

                    Dúvidas sobre matrícula, inadimplência ou aprovação de reservas: fale com a

                    secretaria.

                  </p>

                </GuideCard>

              </div>

            </GuideSection>



            <GuideSection id="faq" title="Perguntas frequentes">

              <GuideFaq items={FAQ_ITEMS} />

            </GuideSection>



            <p className="text-xs text-stone-400 text-center pt-4 border-t border-stone-100">

              Última atualização: agosto de 2026 — CCTVC Velha Central

            </p>

          </div>

        </div>

      </div>

    </Layout>

  )

}



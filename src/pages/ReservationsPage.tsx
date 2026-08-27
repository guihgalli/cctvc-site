import { useRef, useState, useCallback, type CSSProperties } from 'react'

import { Layout } from '../components/Layout'

import { ReservaStatusModal } from '../components/ReservaStatusModal'

import { FeedbackMessage } from '../components/motion/FeedbackMessage'

import { TabPanel } from '../components/motion/TabPanel'

import { ConfirmDialog } from '../components/motion/ConfirmDialog'

import { LazyImage } from '../components/motion/LazyImage'

import { ReservationsPageSkeleton, Skeleton } from '../components/motion/Skeleton'

import { useAuth } from '../contexts/AuthContext'

import { useQuadras } from '../hooks/useQuadras'

import { useCourtBookings } from '../hooks/useCourtBookings'

import { useMyBookings } from '../hooks/useMyBookings'

import { useBookingActions } from '../hooks/useBookingActions'

import { ParticipantesReservaModal } from '../components/ParticipantesReservaModal'
import { AdminReservaUsuarioModal } from '../components/AdminReservaUsuarioModal'
import { diaDisponivel } from '../lib/bookingSchedule'
import { isDataReservavel, labelTipoQuadra } from '../lib/bookingRules'

import {

  DEFAULT_SLOT_MINUTES,

  generateTimeSlotsFromRange,

  getWeekdayShort,

  getMonthShort,

  getDayNumber,

  isToday,

  formatDate,

  formatTime,

  formatMoney,

} from '../lib/utils'

import type { Reserva } from '../types'



const TAB_RESERVAR_ID = 'tab-reservar'

const TAB_MINHAS_ID = 'tab-minhas'



function PlusIcon() {

  return (

    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">

      <path d="M12 5v14M5 12h14" />

    </svg>

  )

}



function LockIcon() {

  return (

    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">

      <rect x="4" y="10" width="16" height="10" rx="2" />

      <path d="M8 10V7a4 4 0 0 1 8 0v3" />

    </svg>

  )

}



function TrashIcon() {

  return (

    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">

      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z" />

    </svg>

  )

}



function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {

  return (

    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">

      <path d={direction === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />

    </svg>

  )

}



export function ReservationsPage() {

  const { user, isSocio, canBook, isAdmin, isDependente, isInadimplente, isTitular } = useAuth()

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [abaAtiva, setAbaAtiva] = useState<'reservar' | 'minhas'>('reservar')

  const dateStripRef = useRef<HTMLDivElement>(null)



  const reportError = useCallback((text: string) => {

    setMessage({ type: 'error', text })

  }, [])



  const {

    quadras,

    quadraSelecionada,

    setQuadraSelecionada,

    dataSelecionada,

    setDataSelecionada,

    datasDisponiveis,

    loading,

  } = useQuadras({ user, onError: reportError })



  const {

    reservas,

    loading: loadingHorarios,

    refresh: refreshCourtBookings,

  } = useCourtBookings(quadraSelecionada?.id, dataSelecionada, {

    enabled: abaAtiva === 'reservar',

    onError: reportError,

  })



  const { minhasReservas, refresh: refreshMyBookings } = useMyBookings(user?.id, {

    onError: reportError,

  })



  const {

    janelaDia,

    reservandoSlot,

    cancelConfirmId,

    setCancelConfirmId,

    cancelando,

    reservaModal,

    modalQuadraNome,

    modalExpiracaoMinutos,

    modalValorVisitante,

    horarioOcupado,

    horarioDisponivel,

    abrirModalReserva,

    fecharModalReserva,

    solicitarCancelamento,

    confirmarCancelamento,

    handleReservar,

    participantesModalOpen,

    fecharParticipantesModal,

    confirmarReservaComParticipantes,

    adminUsuarioModalOpen,

    fecharAdminUsuarioModal,

    confirmarReservaAdmin,

    nomeUsuarioReserva,

  } = useBookingActions({

    user,

    canBook,

    isAdmin,

    isSocio,

    isTitular,

    quadraSelecionada,

    dataSelecionada,

    reservas,

    refreshCourtBookings,

    refreshMyBookings,

    setMessage,

  })



  const horarios = janelaDia

    ? generateTimeSlotsFromRange(

        formatTime(janelaDia.hora_inicio),

        formatTime(janelaDia.hora_fim),

        janelaDia.intervalo_min || DEFAULT_SLOT_MINUTES

      )

    : []



  function rolarDatas(direcao: 'left' | 'right') {

    dateStripRef.current?.scrollBy({ left: direcao === 'left' ? -160 : 160, behavior: 'smooth' })

  }



  const fotoPrincipal = quadraSelecionada?.fotos_quadras?.find((f) => f.principal)

    || quadraSelecionada?.fotos_quadras?.[0]



  if (loading) {

    return (

      <Layout>

        <ReservationsPageSkeleton />

      </Layout>

    )

  }



  return (

    <Layout>

      <div className="max-w-5xl mx-auto px-4 py-8">

        <h1 className="text-2xl font-bold text-emerald-900 mb-2">Reserva de Quadras</h1>

        {!isSocio && (

          <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm mb-4">

            Como visitante, sua reserva ficará <strong>pendente</strong> até a secretaria confirmar o

            pagamento. Se não houver confirmação dentro do prazo configurado na quadra, a reserva

            expira automaticamente e o horário é liberado. A confirmação será enviada no WhatsApp

            cadastrado.

          </p>

        )}

        {isAdmin && (

          <p className="text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm mb-4">

            Como <strong>administrador</strong>, você pode reservar horários em nome de qualquer

            usuário. Ao clicar em &quot;Reservar horário&quot;, selecione o usuário desejado.

          </p>

        )}

        {isDependente && (

          <p className="text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm mb-4">

            Como <strong>sócio dependente</strong>, você pode visualizar horários e acompanhar suas

            reservas, mas apenas o titular pode fazer novos agendamentos.

          </p>

        )}

        {isInadimplente && (

          <p className="text-red-800 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm mb-4">

            Há <strong>pendências financeiras</strong> em sua associação. Procure a secretaria do clube

            para regularizar antes de agendar.

          </p>

        )}

        <p className="text-stone-500 text-sm mb-6">

          Agendamentos da semana atual (segunda a domingo). A <strong>próxima semana</strong> abre aos{' '}

          <strong>domingos</strong>.

        </p>



        <div className="flex gap-2 mb-6" role="tablist" aria-label="Seções de reserva">

          <button

            id={TAB_RESERVAR_ID}

            role="tab"

            aria-selected={abaAtiva === 'reservar'}

            aria-controls="panel-reservar"

            onClick={() => setAbaAtiva('reservar')}

            className={`motion-tab ${abaAtiva === 'reservar' ? 'motion-tab--active' : 'motion-tab--inactive'}`}

          >

            Nova Reserva

          </button>

          <button

            id={TAB_MINHAS_ID}

            role="tab"

            aria-selected={abaAtiva === 'minhas'}

            aria-controls="panel-minhas"

            onClick={() => setAbaAtiva('minhas')}

            className={`motion-tab ${abaAtiva === 'minhas' ? 'motion-tab--active' : 'motion-tab--inactive'}`}

          >

            Minhas Reservas ({minhasReservas.length})

          </button>

        </div>



        {message && (

          <FeedbackMessage

            type={message.type === 'success' ? 'success' : 'error'}

            className="mb-4"

            onDismiss={() => setMessage(null)}

            autoHideMs={message.type === 'success' ? 5000 : 0}

          >

            {message.text}

          </FeedbackMessage>

        )}



        <TabPanel active={abaAtiva === 'reservar'} id="panel-reservar" labelledBy={TAB_RESERVAR_ID}>

          {quadras.length === 0 ? (

            <div className="motion-card p-8 text-center text-stone-500">

              Nenhuma quadra disponível no momento.

            </div>

          ) : (

            <div className="space-y-5">

              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">

                {quadras.map((quadra) => (

                  <button

                    key={quadra.id}

                    type="button"

                    onClick={() => setQuadraSelecionada(quadra)}

                    className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap motion-tab ${

                      quadraSelecionada?.id === quadra.id

                        ? 'motion-tab--active'

                        : 'motion-tab--inactive'

                    }`}

                  >

                    {quadra.nome}
                    {quadra.tipo_quadra && quadra.tipo_quadra !== 'geral' && (
                      <span className="ml-1 text-xs opacity-75">
                        ({labelTipoQuadra(quadra.tipo_quadra)})
                      </span>
                    )}

                  </button>

                ))}

              </div>



              {quadraSelecionada && (

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">

                  {quadraSelecionada.descricao && (

                    <p className="text-stone-500">{quadraSelecionada.descricao}</p>

                  )}

                  {!isSocio && quadraSelecionada.valor_visitante != null && (

                    <p className="text-emerald-800 font-semibold">

                      Valor visitante: {formatMoney(Number(quadraSelecionada.valor_visitante))}

                    </p>

                  )}

                </div>

              )}



              {quadraSelecionada && fotoPrincipal && (
                <div className="w-full max-w-4xl motion-page-enter">
                  <LazyImage
                    src={fotoPrincipal.url}
                    alt={quadraSelecionada.nome}
                    className="rounded-xl"
                    aspectRatio="3/2"
                    objectFit="contain"
                    loading="eager"
                  />
                </div>
              )}



              <div className="flex items-center gap-1">

                <button

                  type="button"

                  onClick={() => rolarDatas('left')}

                  className="shrink-0 p-2 rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-600 motion-cta"

                  aria-label="Ver dias anteriores"

                >

                  <ChevronIcon direction="left" />

                </button>

                <div

                  ref={dateStripRef}

                  className="flex gap-2 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"

                >

                  {datasDisponiveis.map((data) => {

                    const selecionada = data === dataSelecionada

                    const disponivel = diaDisponivel(quadraSelecionada, data) && isDataReservavel(data)

                    return (

                      <button

                        key={data}

                        type="button"

                        disabled={!disponivel}

                        aria-disabled={!disponivel}

                        aria-label={

                          disponivel

                            ? `${getWeekdayShort(data)} ${getDayNumber(data)} de ${getMonthShort(data)}`

                            : `${getWeekdayShort(data)} ${getDayNumber(data)} — fechado`

                        }

                        onClick={() => disponivel && setDataSelecionada(data)}

                        className={`shrink-0 w-[76px] flex flex-col items-center gap-0.5 rounded-2xl py-3 motion-cta transition-colors ${

                          selecionada

                            ? 'bg-emerald-700 text-white'

                            : disponivel

                              ? 'bg-white text-stone-700 border border-stone-200 hover:border-emerald-300'

                              : 'bg-stone-50 text-stone-400 border border-stone-100 cursor-not-allowed opacity-60'

                        }`}

                      >

                        <span className={`text-[11px] font-semibold tracking-wide ${selecionada ? 'text-emerald-100' : 'text-stone-400'}`}>

                          {getWeekdayShort(data)}

                        </span>

                        <span className="text-2xl font-bold leading-tight">{getDayNumber(data)}</span>

                        <span className={`text-[11px] font-medium ${selecionada ? 'text-emerald-100' : 'text-stone-400'}`}>

                          {getMonthShort(data)}

                        </span>

                        {isToday(data) && (

                          <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${selecionada ? 'bg-white' : 'bg-emerald-500'}`} />

                        )}

                        {!disponivel && (

                          <span className={`text-[9px] font-medium ${selecionada ? 'text-emerald-100' : 'text-stone-400'}`}>

                            Fechado

                          </span>

                        )}

                      </button>

                    )

                  })}

                </div>

                <button

                  type="button"

                  onClick={() => rolarDatas('right')}

                  className="shrink-0 p-2 rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-600 motion-cta"

                  aria-label="Ver próximos dias"

                >

                  <ChevronIcon direction="right" />

                </button>

              </div>



              {quadraSelecionada && dataSelecionada && (

                <div className="space-y-3">

                  <div className="flex items-center justify-between gap-3 flex-wrap">

                    <h3 className="font-semibold text-stone-700">

                      Horários — {formatDate(dataSelecionada)}

                    </h3>

                    {janelaDia && (

                      <div className="flex items-center gap-3 text-xs text-stone-500">

                        <span className="flex items-center gap-1.5">

                          <span className="w-3 h-3 rounded border border-dashed border-stone-300" />

                          Livre

                        </span>

                        <span className="flex items-center gap-1.5">

                          <span className="w-3 h-3 rounded border-2 border-emerald-500" />

                          Sua reserva

                        </span>

                        <span className="flex items-center gap-1.5">

                          <span className="w-3 h-3 rounded border border-stone-300 bg-stone-100" />

                          Ocupado

                        </span>

                      </div>

                    )}

                  </div>



                  {!janelaDia ? (

                    <div className="motion-card border border-stone-200 p-8 text-center text-stone-500">

                      Quadra fechada neste dia.

                    </div>

                  ) : horarios.length === 0 ? (

                    <div className="motion-card border border-stone-200 p-8 text-center text-stone-500">

                      Nenhum horário disponível para esta configuração.

                    </div>

                  ) : loadingHorarios ? (

                    <div className="motion-card border border-stone-200 divide-y divide-stone-100 overflow-hidden" aria-busy="true">

                      {Array.from({ length: 5 }).map((_, i) => (

                        <div key={i} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">

                          <Skeleton variant="text" width="48px" height="20px" />

                          <Skeleton variant="rounded" className="flex-1 h-11" />

                        </div>

                      ))}

                    </div>

                  ) : (

                    <div className="motion-card border border-stone-200 divide-y divide-stone-100 overflow-hidden">

                      {horarios.map((slot) => {

                        const reserva = horarioOcupado(slot.start)

                        const disponivel = horarioDisponivel(slot.start)

                        const minha = !!reserva && !!user && reserva.usuario_id === user.id



                        return (

                          <div key={slot.start} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">

                            <span className="w-12 shrink-0 text-sm font-semibold text-stone-600">

                              {slot.start}

                            </span>



                            {reserva ? (

                              <div

                                className={`flex-1 flex items-center gap-2 rounded-lg border px-2 py-1.5 sm:px-3 ${

                                  minha

                                    ? reserva.status === 'pendente'

                                      ? 'border-amber-300 bg-amber-50'

                                      : 'border-emerald-300 bg-emerald-50'

                                    : 'border-stone-200 bg-stone-50'

                                }`}

                              >

                                {minha ? (

                                  <button

                                    type="button"

                                    onClick={() => abrirModalReserva(reserva, quadraSelecionada?.nome)}

                                    className={`flex-1 flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left motion-cta ${

                                      reserva.status === 'pendente'

                                        ? 'hover:bg-amber-100/70'

                                        : 'hover:bg-emerald-100/70'

                                    }`}

                                  >

                                    <div>

                                      <p

                                        className={`font-semibold text-sm ${

                                          reserva.status === 'pendente'

                                            ? 'text-amber-800'

                                            : 'text-emerald-800'

                                        }`}

                                      >

                                        {reserva.status === 'pendente'

                                          ? 'Sua reserva (pendente)'

                                          : 'Sua reserva'}

                                      </p>

                                      <p className="text-xs text-stone-400 flex items-center gap-1 mt-0.5">

                                        <LockIcon /> {slot.start} – {slot.end}

                                      </p>

                                    </div>

                                  </button>

                                ) : (

                                  <div className="flex-1 flex items-center justify-between gap-3 px-2 py-1.5">

                                    <div>

                                      <p className="font-semibold text-sm text-stone-500">Ocupado</p>

                                      <p className="text-xs text-stone-400 flex items-center gap-1 mt-0.5">

                                        <LockIcon /> {slot.start} – {slot.end}

                                      </p>

                                    </div>

                                  </div>

                                )}

                                {minha && (

                                  <button

                                    type="button"

                                    onClick={() => solicitarCancelamento(reserva.id)}

                                    className="text-stone-400 hover:text-red-600 transition-colors p-1 shrink-0"

                                    aria-label="Cancelar reserva"

                                  >

                                    <TrashIcon />

                                  </button>

                                )}

                              </div>

                            ) : (

                              <button

                                type="button"

                                disabled={!disponivel || reservandoSlot !== null}

                                onClick={() => handleReservar(slot.start, slot.end)}

                                className={`flex-1 flex items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-2.5 text-sm font-medium motion-cta transition-colors ${

                                  disponivel && reservandoSlot === null

                                    ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400'

                                    : 'border-stone-200 text-stone-300 cursor-not-allowed'

                                }`}

                              >

                                {reservandoSlot === slot.start ? (

                                  <>

                                    <span className="motion-spinner motion-spinner--btn border-emerald-300 border-t-emerald-700" />

                                    Reservando...

                                  </>

                                ) : (

                                  <>

                                    <PlusIcon /> Reservar horário

                                  </>

                                )}

                              </button>

                            )}

                          </div>

                        )

                      })}

                    </div>

                  )}

                </div>

              )}

            </div>

          )}

        </TabPanel>



        <TabPanel active={abaAtiva === 'minhas'} id="panel-minhas" labelledBy={TAB_MINHAS_ID}>

          <div className="space-y-3">

            {minhasReservas.length === 0 ? (

              <div className="motion-card p-8 text-center text-stone-500">

                Você não tem reservas futuras.

              </div>

            ) : (

              minhasReservas.map((reserva, index) => (

                <div

                  key={reserva.id}

                  className="motion-card p-4 border border-stone-200 flex items-center justify-between gap-4 motion-stagger-item"

                  style={{ '--stagger-index': index } as CSSProperties}

                >

                  <button

                    type="button"

                    onClick={() => abrirModalReserva(reserva)}

                    className="flex-1 text-left hover:opacity-80 transition-opacity"

                  >

                    <div className="flex items-center gap-2 mb-1">

                      <p className="font-semibold text-emerald-900">{reserva.quadras?.nome}</p>

                      <StatusBadge status={reserva.status} />

                    </div>

                    <p className="text-stone-600 text-sm">

                      {formatDate(reserva.data_reserva)} · {formatTime(reserva.hora_inicio)} –{' '}

                      {formatTime(reserva.hora_fim)}

                    </p>

                  </button>

                  {(reserva.status === 'confirmada' || reserva.status === 'pendente') && (

                    <button

                      type="button"

                      onClick={() => solicitarCancelamento(reserva.id)}

                      className="text-red-600 hover:text-red-800 text-sm font-medium shrink-0"

                    >

                      Cancelar

                    </button>

                  )}

                </div>

              ))

            )}

          </div>

        </TabPanel>

      </div>



      <ReservaStatusModal

        reserva={reservaModal}

        quadraNome={modalQuadraNome}

        isVisitante={!isSocio}

        nomeUsuario={nomeUsuarioReserva ?? user?.nome}

        expiracaoPendenteMinutos={modalExpiracaoMinutos}

        valorVisitante={modalValorVisitante}

        onClose={fecharModalReserva}

        onCancel={solicitarCancelamento}

      />



      <ParticipantesReservaModal
        open={participantesModalOpen}
        onClose={fecharParticipantesModal}
        onConfirm={confirmarReservaComParticipantes}
        loading={!!reservandoSlot}
      />

      <AdminReservaUsuarioModal
        open={adminUsuarioModalOpen}
        onClose={fecharAdminUsuarioModal}
        onConfirm={confirmarReservaAdmin}
        loading={!!reservandoSlot}
      />

      <ConfirmDialog

        open={!!cancelConfirmId}

        title="Cancelar reserva"

        message="Deseja cancelar esta reserva? Esta ação não pode ser desfeita."

        confirmLabel="Sim, cancelar"

        cancelLabel="Voltar"

        loading={cancelando}

        onConfirm={confirmarCancelamento}

        onCancel={() => setCancelConfirmId(null)}

      />

    </Layout>

  )

}



function StatusBadge({ status }: { status: Reserva['status'] }) {

  const styles: Record<Reserva['status'], string> = {

    pendente: 'bg-amber-100 text-amber-800',

    confirmada: 'bg-emerald-100 text-emerald-800',

    recusada: 'bg-red-100 text-red-700',

    cancelada: 'bg-stone-100 text-stone-500',

  }

  const labels: Record<Reserva['status'], string> = {

    pendente: 'Pendente',

    confirmada: 'Confirmada',

    recusada: 'Recusada',

    cancelada: 'Cancelada',

  }

  return (

    <span className={`text-xs px-2 py-0.5 rounded font-medium ${styles[status]}`}>

      {labels[status]}

    </span>

  )

}



import { useRef, useState, useEffect } from 'react'
import { Layout } from '../components/Layout'
import { ReservaStatusModal } from '../components/ReservaStatusModal'
import { useAuth } from '../contexts/AuthContext'
import {
  fetchCourts,
  fetchBookingsByCourtAndDate,
  createBooking,
  fetchUserBookings,
  cancelBooking,
} from '../services/api'
import {
  BOOKING_DATE_RANGE_DAYS,
  DEFAULT_SLOT_END,
  DEFAULT_SLOT_MINUTES,
  DEFAULT_SLOT_START,
  generateDateRange,
  generateTimeSlotsFromRange,
  getWeekdayIndex,
  getWeekdayShort,
  getMonthShort,
  getDayNumber,
  isToday,
  isPastDate,
  isPastDateTime,
  formatDate,
  formatTime,
} from '../lib/utils'
import type { HorarioQuadra, Quadra, Reserva } from '../types'

function horarioDoDia(
  quadra: Quadra | null,
  data: string
): HorarioQuadra | { hora_inicio: string; hora_fim: string; intervalo_min: number } | null {
  if (!quadra) return null

  const dia = getWeekdayIndex(data)
  const configurados = (quadra.horarios_quadra || []).filter((h) => h.ativo !== false)

  if (configurados.length === 0) {
    // Fallback enquanto a migration não rodou / sem configuração
    return {
      hora_inicio: DEFAULT_SLOT_START,
      hora_fim: DEFAULT_SLOT_END,
      intervalo_min: DEFAULT_SLOT_MINUTES,
    }
  }

  return configurados.find((h) => h.dia_semana === dia) || null
}

function diaDisponivel(quadra: Quadra | null, data: string): boolean {
  return !!horarioDoDia(quadra, data)
}

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
  const { user, isSocio } = useAuth()
  const [quadras, setQuadras] = useState<Quadra[]>([])
  const [quadraSelecionada, setQuadraSelecionada] = useState<Quadra | null>(null)
  const hoje = new Date().toISOString().split('T')[0]
  const [dataSelecionada, setDataSelecionada] = useState(hoje)
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [minhasReservas, setMinhasReservas] = useState<Reserva[]>([])
  const [loading, setLoading] = useState(true)
  const [reservando, setReservando] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [reservaModal, setReservaModal] = useState<Reserva | null>(null)
  const [modalQuadraNome, setModalQuadraNome] = useState<string | undefined>()
  const [abaAtiva, setAbaAtiva] = useState<'reservar' | 'minhas'>('reservar')
  const dateStripRef = useRef<HTMLDivElement>(null)

  const datasDisponiveis = generateDateRange(BOOKING_DATE_RANGE_DAYS)
  const janelaDia = horarioDoDia(quadraSelecionada, dataSelecionada)
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

  useEffect(() => {
    carregarQuadras()
    if (user) carregarMinhasReservas()
  }, [user])

  useEffect(() => {
    if (quadraSelecionada && dataSelecionada) {
      carregarReservas()
    }
  }, [quadraSelecionada, dataSelecionada])

  useEffect(() => {
    if (!quadraSelecionada) return
    if (diaDisponivel(quadraSelecionada, dataSelecionada)) return
    const proxima = datasDisponiveis.find((data) => diaDisponivel(quadraSelecionada, data))
    if (proxima) setDataSelecionada(proxima)
  }, [quadraSelecionada])

  async function carregarQuadras() {
    try {
      const data = await fetchCourts()
      setQuadras(data)
      if (data.length > 0) {
        const primeira = data[0]
        setQuadraSelecionada(primeira)
        if (!diaDisponivel(primeira, dataSelecionada)) {
          const proxima = datasDisponiveis.find((data) => diaDisponivel(primeira, data))
          if (proxima) setDataSelecionada(proxima)
        }
      }
    } catch {
      setMessage({ type: 'error', text: 'Erro ao carregar quadras.' })
    } finally {
      setLoading(false)
    }
  }

  async function carregarReservas() {
    if (!quadraSelecionada || !dataSelecionada) return
    try {
      const data = await fetchBookingsByCourtAndDate(quadraSelecionada.id, dataSelecionada)
      setReservas(data)
    } catch {
      setMessage({ type: 'error', text: 'Erro ao carregar horários.' })
    }
  }

  async function carregarMinhasReservas() {
    if (!user) return
    try {
      const data = await fetchUserBookings(user.id)
      setMinhasReservas(data)
    } catch {
      /* silencioso */
    }
  }

  function horarioOcupado(horaInicio: string): Reserva | undefined {
    return reservas.find((r) => formatTime(r.hora_inicio) === horaInicio)
  }

  function horarioDisponivel(horaInicio: string): boolean {
    if (!dataSelecionada) return false
    if (isPastDate(dataSelecionada)) return false
    if (isPastDateTime(dataSelecionada, horaInicio)) return false
    return !horarioOcupado(horaInicio)
  }

  async function handleReservar(horaInicio: string, horaFim: string) {
    if (!quadraSelecionada || !dataSelecionada || !user) return

    if (!janelaDia) {
      setMessage({ type: 'error', text: 'Quadra fechada neste dia.' })
      return
    }

    if (isPastDate(dataSelecionada)) {
      setMessage({ type: 'error', text: 'Não é possível reservar datas passadas.' })
      return
    }

    if (isPastDateTime(dataSelecionada, horaInicio)) {
      setMessage({ type: 'error', text: 'Não é possível reservar horários passados.' })
      return
    }

    if (horarioOcupado(horaInicio)) {
      setMessage({ type: 'error', text: 'Este horário já está reservado.' })
      return
    }

    setReservando(true)
    setMessage(null)

    try {
      const reserva = await createBooking({
        quadra_id: quadraSelecionada.id,
        usuario_id: user.id,
        data_reserva: dataSelecionada,
        hora_inicio: horaInicio,
        hora_fim: horaFim,
      })
      setReservaModal(reserva)
      setModalQuadraNome(quadraSelecionada.nome)
      await carregarReservas()
      await carregarMinhasReservas()
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erro ao fazer reserva.',
      })
    } finally {
      setReservando(false)
    }
  }

  async function handleCancelar(reservaId: string) {
    if (!confirm('Deseja cancelar esta reserva?')) return
    try {
      await cancelBooking(reservaId)
      setReservaModal(null)
      setModalQuadraNome(undefined)
      setMessage({ type: 'success', text: 'Reserva cancelada.' })
      await carregarMinhasReservas()
      if (quadraSelecionada && dataSelecionada) await carregarReservas()
    } catch {
      setMessage({ type: 'error', text: 'Erro ao cancelar reserva.' })
    }
  }

  function abrirModalReserva(reserva: Reserva, quadraNome?: string) {
    setReservaModal(reserva)
    setModalQuadraNome(quadraNome ?? reserva.quadras?.nome)
  }

  function fecharModalReserva() {
    setReservaModal(null)
    setModalQuadraNome(undefined)
  }

  const fotoPrincipal = quadraSelecionada?.fotos_quadras?.find((f) => f.principal)
    || quadraSelecionada?.fotos_quadras?.[0]

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-32">
          <div className="text-emerald-700">Carregando...</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-emerald-900 mb-2">Reserva de Quadras</h1>
        {!isSocio && (
          <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm mb-6">
            Como visitante, sua reserva ficará <strong>pendente</strong> até a secretaria confirmar o
            pagamento. A confirmação será enviada no WhatsApp cadastrado.
          </p>
        )}

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setAbaAtiva('reservar')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              abaAtiva === 'reservar'
                ? 'bg-emerald-700 text-white'
                : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
            }`}
          >
            Nova Reserva
          </button>
          <button
            onClick={() => setAbaAtiva('minhas')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              abaAtiva === 'minhas'
                ? 'bg-emerald-700 text-white'
                : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
            }`}
          >
            Minhas Reservas ({minhasReservas.length})
          </button>
        </div>

        {message && (
          <div
            className={`mb-4 px-4 py-3 rounded-lg text-sm ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {abaAtiva === 'reservar' ? (
          quadras.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center text-stone-500">
              Nenhuma quadra disponível no momento.
            </div>
          ) : (
            <div className="space-y-5">
              {/* Seleção de quadra: pills horizontais, 1 clique */}
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {quadras.map((quadra) => (
                  <button
                    key={quadra.id}
                    onClick={() => setQuadraSelecionada(quadra)}
                    className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                      quadraSelecionada?.id === quadra.id
                        ? 'bg-emerald-700 text-white'
                        : 'bg-white text-stone-600 border border-stone-200 hover:border-emerald-300'
                    }`}
                  >
                    {quadra.nome}
                  </button>
                ))}
              </div>

              {quadraSelecionada && (fotoPrincipal || quadraSelecionada.descricao) && (
                <div className="flex items-center gap-3">
                  {fotoPrincipal && (
                    <img
                      src={fotoPrincipal.url}
                      alt={quadraSelecionada.nome}
                      className="w-14 h-14 object-cover rounded-lg shrink-0"
                    />
                  )}
                  {quadraSelecionada.descricao && (
                    <p className="text-stone-500 text-sm">{quadraSelecionada.descricao}</p>
                  )}
                </div>
              )}

              {/* Seleção de data: tira horizontal, 1 clique */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => rolarDatas('left')}
                  className="shrink-0 p-2 rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-600"
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
                    const disponivel = diaDisponivel(quadraSelecionada, data)
                    return (
                      <button
                        key={data}
                        onClick={() => setDataSelecionada(data)}
                        className={`shrink-0 w-[76px] flex flex-col items-center gap-0.5 rounded-2xl py-3 transition-colors ${
                          selecionada
                            ? 'bg-emerald-700 text-white'
                            : disponivel
                              ? 'bg-white text-stone-700 border border-stone-200 hover:border-emerald-300'
                              : 'bg-stone-50 text-stone-400 border border-stone-100'
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
                  onClick={() => rolarDatas('right')}
                  className="shrink-0 p-2 rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-600"
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
                    <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-stone-500">
                      Quadra fechada neste dia.
                    </div>
                  ) : horarios.length === 0 ? (
                    <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-stone-500">
                      Nenhum horário disponível para esta configuração.
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl border border-stone-200 divide-y divide-stone-100 overflow-hidden">
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
                                role={minha ? 'button' : undefined}
                                tabIndex={minha ? 0 : undefined}
                                onClick={minha ? () => abrirModalReserva(reserva, quadraSelecionada?.nome) : undefined}
                                onKeyDown={
                                  minha
                                    ? (e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                          e.preventDefault()
                                          abrirModalReserva(reserva, quadraSelecionada?.nome)
                                        }
                                      }
                                    : undefined
                                }
                                className={`flex-1 flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 ${
                                  minha
                                    ? reserva.status === 'pendente'
                                      ? 'border-amber-300 bg-amber-50 cursor-pointer hover:bg-amber-100/70'
                                      : 'border-emerald-300 bg-emerald-50 cursor-pointer hover:bg-emerald-100/70'
                                    : 'border-stone-200 bg-stone-50'
                                }`}
                              >
                                <div>
                                  <p
                                    className={`font-semibold text-sm ${
                                      minha
                                        ? reserva.status === 'pendente'
                                          ? 'text-amber-800'
                                          : 'text-emerald-800'
                                        : 'text-stone-500'
                                    }`}
                                  >
                                    {minha
                                      ? reserva.status === 'pendente'
                                        ? 'Sua reserva (pendente)'
                                        : 'Sua reserva'
                                      : 'Ocupado'}
                                  </p>
                                  <p className="text-xs text-stone-400 flex items-center gap-1 mt-0.5">
                                    <LockIcon /> {slot.start} – {slot.end}
                                  </p>
                                </div>
                                {minha && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleCancelar(reserva.id)
                                    }}
                                    className="text-stone-400 hover:text-red-600 transition-colors p-1"
                                    aria-label="Cancelar reserva"
                                  >
                                    <TrashIcon />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <button
                                disabled={!disponivel || reservando}
                                onClick={() => handleReservar(slot.start, slot.end)}
                                className={`flex-1 flex items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-2.5 text-sm font-medium transition-colors ${
                                  disponivel
                                    ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400'
                                    : 'border-stone-200 text-stone-300 cursor-not-allowed'
                                }`}
                              >
                                <PlusIcon /> Reservar horário
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
          )
        ) : (
          <div className="space-y-3">
            {minhasReservas.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center text-stone-500">
                Você não tem reservas futuras.
              </div>
            ) : (
              minhasReservas.map((reserva) => (
                <div
                  key={reserva.id}
                  className="bg-white rounded-xl p-4 border border-stone-200 flex items-center justify-between gap-4"
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
                      onClick={() => handleCancelar(reserva.id)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium shrink-0"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <ReservaStatusModal
        reserva={reservaModal}
        quadraNome={modalQuadraNome}
        onClose={fecharModalReserva}
        onCancel={handleCancelar}
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

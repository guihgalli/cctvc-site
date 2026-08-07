import { useState, useEffect } from 'react'
import { Layout } from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'
import {
  fetchCourts,
  fetchBookingsByCourtAndDate,
  createBooking,
  fetchUserBookings,
  cancelBooking,
} from '../services/api'
import {
  generateTimeSlots,
  isPastDate,
  isPastDateTime,
  formatDate,
  formatTime,
} from '../lib/utils'
import type { Quadra, Reserva } from '../types'

export function ReservationsPage() {
  const { user } = useAuth()
  const [quadras, setQuadras] = useState<Quadra[]>([])
  const [quadraSelecionada, setQuadraSelecionada] = useState<Quadra | null>(null)
  const [dataSelecionada, setDataSelecionada] = useState('')
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [minhasReservas, setMinhasReservas] = useState<Reserva[]>([])
  const [loading, setLoading] = useState(true)
  const [reservando, setReservando] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [abaAtiva, setAbaAtiva] = useState<'reservar' | 'minhas'>('reservar')

  const horarios = generateTimeSlots(7, 22, 60)
  const hoje = new Date().toISOString().split('T')[0]

  useEffect(() => {
    carregarQuadras()
    if (user) carregarMinhasReservas()
  }, [user])

  useEffect(() => {
    if (quadraSelecionada && dataSelecionada) {
      carregarReservas()
    }
  }, [quadraSelecionada, dataSelecionada])

  async function carregarQuadras() {
    try {
      const data = await fetchCourts()
      setQuadras(data)
      if (data.length > 0) setQuadraSelecionada(data[0])
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
      await createBooking({
        quadra_id: quadraSelecionada.id,
        usuario_id: user.id,
        data_reserva: dataSelecionada,
        hora_inicio: horaInicio,
        hora_fim: horaFim,
      })
      setMessage({ type: 'success', text: 'Reserva confirmada com sucesso!' })
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
      setMessage({ type: 'success', text: 'Reserva cancelada.' })
      await carregarMinhasReservas()
      if (quadraSelecionada && dataSelecionada) await carregarReservas()
    } catch {
      setMessage({ type: 'error', text: 'Erro ao cancelar reserva.' })
    }
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
        <h1 className="text-2xl font-bold text-emerald-900 mb-6">Reserva de Quadras</h1>

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
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 space-y-3">
                <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide">
                  Quadras
                </h2>
                {quadras.map((quadra) => (
                  <button
                    key={quadra.id}
                    onClick={() => setQuadraSelecionada(quadra)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      quadraSelecionada?.id === quadra.id
                        ? 'border-emerald-600 bg-emerald-50'
                        : 'border-stone-200 bg-white hover:border-emerald-300'
                    }`}
                  >
                    <p className="font-semibold text-emerald-900">{quadra.nome}</p>
                    {quadra.tipo_esporte && (
                      <p className="text-stone-500 text-sm">{quadra.tipo_esporte}</p>
                    )}
                  </button>
                ))}
              </div>

              <div className="lg:col-span-2 space-y-4">
                {quadraSelecionada && (
                  <>
                    {fotoPrincipal && (
                      <img
                        src={fotoPrincipal.url}
                        alt={quadraSelecionada.nome}
                        className="w-full h-48 object-cover rounded-xl"
                      />
                    )}
                    {quadraSelecionada.descricao && (
                      <p className="text-stone-600 text-sm">{quadraSelecionada.descricao}</p>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-2">
                        Data da reserva
                      </label>
                      <input
                        type="date"
                        min={hoje}
                        value={dataSelecionada}
                        onChange={(e) => setDataSelecionada(e.target.value)}
                        className="border border-stone-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    {dataSelecionada && (
                      <div>
                        <h3 className="font-semibold text-stone-700 mb-3">
                          Horários — {formatDate(dataSelecionada)}
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {horarios.map((slot) => {
                            const ocupado = horarioOcupado(slot.start)
                            const disponivel = horarioDisponivel(slot.start)

                            return (
                              <button
                                key={slot.start}
                                disabled={!disponivel || reservando}
                                onClick={() => handleReservar(slot.start, slot.end)}
                                className={`p-3 rounded-lg text-sm font-medium transition-all ${
                                  ocupado
                                    ? 'bg-red-50 text-red-400 border border-red-200 cursor-not-allowed'
                                    : disponivel
                                      ? 'bg-white border-2 border-emerald-200 text-emerald-800 hover:bg-emerald-50 hover:border-emerald-400'
                                      : 'bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed'
                                }`}
                              >
                                {slot.start} – {slot.end}
                                {ocupado && (
                                  <span className="block text-xs mt-0.5 truncate">
                                    Ocupado
                                  </span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
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
                  <div>
                    <p className="font-semibold text-emerald-900">
                      {reserva.quadras?.nome}
                    </p>
                    <p className="text-stone-600 text-sm">
                      {formatDate(reserva.data_reserva)} · {formatTime(reserva.hora_inicio)} –{' '}
                      {formatTime(reserva.hora_fim)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCancelar(reserva.id)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium shrink-0"
                  >
                    Cancelar
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}

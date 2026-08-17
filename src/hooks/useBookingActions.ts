import { useCallback, useState } from 'react'
import { cancelBooking, createBooking } from '../services/api'
import {
  formatTime,
  getBookingErrorMessage,
  isPastDate,
  isPastDateTime,
} from '../lib/utils'
import { horarioDoDia } from '../lib/bookingSchedule'
import type { AuthUser } from '../types'
import type { Quadra, Reserva } from '../types'

type PageMessage = { type: 'success' | 'error'; text: string }

interface UseBookingActionsParams {
  user: AuthUser | null
  quadraSelecionada: Quadra | null
  dataSelecionada: string
  reservas: Reserva[]
  refreshCourtBookings: (options?: { silent?: boolean }) => Promise<void>
  refreshMyBookings: () => Promise<void>
  setMessage: (message: PageMessage | null) => void
}

export function useBookingActions({
  user,
  quadraSelecionada,
  dataSelecionada,
  reservas,
  refreshCourtBookings,
  refreshMyBookings,
  setMessage,
}: UseBookingActionsParams) {
  const [reservandoSlot, setReservandoSlot] = useState<string | null>(null)
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null)
  const [cancelando, setCancelando] = useState(false)
  const [reservaModal, setReservaModal] = useState<Reserva | null>(null)
  const [modalQuadraNome, setModalQuadraNome] = useState<string | undefined>()
  const [modalExpiracaoMinutos, setModalExpiracaoMinutos] = useState(60)
  const [modalValorVisitante, setModalValorVisitante] = useState<number | null>(null)

  const janelaDia = horarioDoDia(quadraSelecionada, dataSelecionada)

  const horarioOcupado = useCallback(
    (horaInicio: string) => reservas.find((r) => formatTime(r.hora_inicio) === horaInicio),
    [reservas]
  )

  const horarioDisponivel = useCallback(
    (horaInicio: string) => {
      if (!dataSelecionada) return false
      if (isPastDate(dataSelecionada)) return false
      if (isPastDateTime(dataSelecionada, horaInicio)) return false
      return !horarioOcupado(horaInicio)
    },
    [dataSelecionada, horarioOcupado]
  )

  const abrirModalReserva = useCallback((reserva: Reserva, quadraNome?: string) => {
    setReservaModal(reserva)
    setModalQuadraNome(quadraNome ?? reserva.quadras?.nome)
    setModalExpiracaoMinutos(reserva.quadras?.expiracao_pendente_minutos ?? 60)
    setModalValorVisitante(reserva.quadras?.valor_visitante ?? null)
  }, [])

  const fecharModalReserva = useCallback(() => {
    setReservaModal(null)
    setModalQuadraNome(undefined)
    setModalExpiracaoMinutos(60)
    setModalValorVisitante(null)
  }, [])

  const solicitarCancelamento = useCallback((reservaId: string) => {
    setCancelConfirmId(reservaId)
  }, [])

  const confirmarCancelamento = useCallback(async () => {
    if (!cancelConfirmId) return

    setCancelando(true)
    try {
      await cancelBooking(cancelConfirmId)
      fecharModalReserva()
      setCancelConfirmId(null)
      setMessage({ type: 'success', text: 'Reserva cancelada.' })
      await Promise.all([refreshMyBookings(), refreshCourtBookings()])
    } catch {
      setMessage({ type: 'error', text: 'Erro ao cancelar reserva.' })
    } finally {
      setCancelando(false)
    }
  }, [cancelConfirmId, fecharModalReserva, refreshCourtBookings, refreshMyBookings, setMessage])

  const handleReservar = useCallback(
    async (horaInicio: string, horaFim: string) => {
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

      setReservandoSlot(horaInicio)
      setMessage(null)

      try {
        const reserva = await createBooking({
          quadra_id: quadraSelecionada.id,
          usuario_id: user.id,
          data_reserva: dataSelecionada,
          hora_inicio: horaInicio,
          hora_fim: horaFim,
        })
        abrirModalReserva(reserva, quadraSelecionada.nome)
        setModalExpiracaoMinutos(quadraSelecionada.expiracao_pendente_minutos ?? 60)
        setModalValorVisitante(quadraSelecionada.valor_visitante ?? null)
        await Promise.all([refreshCourtBookings(), refreshMyBookings()])
      } catch (err) {
        const text = getBookingErrorMessage(err)
        setMessage({ type: 'error', text })
        if (text.includes('acabou de ser reservado')) {
          await refreshCourtBookings()
        }
      } finally {
        setReservandoSlot(null)
      }
    },
    [
      quadraSelecionada,
      dataSelecionada,
      user,
      janelaDia,
      horarioOcupado,
      abrirModalReserva,
      refreshCourtBookings,
      refreshMyBookings,
      setMessage,
    ]
  )

  return {
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
  }
}

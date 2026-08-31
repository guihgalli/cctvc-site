import { useCallback, useState } from 'react'
import { adminCreateBooking, cancelBooking, createBooking } from '../services/api'
import {
  formatTime,
  getBookingErrorMessage,
  isPastDate,
  isPastDateTime,
} from '../lib/utils'
import { isDataReservavel, quadraRequerPagamento } from '../lib/bookingRules'
import { horarioDoDia } from '../lib/bookingSchedule'
import type { AuthUser } from '../types'
import type { Quadra, Reserva } from '../types'

type PageMessage = { type: 'success' | 'error'; text: string }

interface UseBookingActionsParams {
  user: AuthUser | null
  canBook: boolean
  isAdmin: boolean
  isSocio: boolean
  isTitular: boolean
  quadraSelecionada: Quadra | null
  dataSelecionada: string
  reservas: Reserva[]
  refreshCourtBookings: (options?: { silent?: boolean }) => Promise<void>
  refreshMyBookings: () => Promise<void>
  setMessage: (message: PageMessage | null) => void
  onBookingSuccess?: () => void
}

export function useBookingActions({
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
  onBookingSuccess,
}: UseBookingActionsParams) {
  const [reservandoSlot, setReservandoSlot] = useState<string | null>(null)
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null)
  const [cancelando, setCancelando] = useState(false)
  const [reservaModal, setReservaModal] = useState<Reserva | null>(null)
  const [modalQuadraNome, setModalQuadraNome] = useState<string | undefined>()
  const [modalExpiracaoMinutos, setModalExpiracaoMinutos] = useState(60)
  const [modalValorVisitante, setModalValorVisitante] = useState<number | null>(null)
  const [participantesModalOpen, setParticipantesModalOpen] = useState(false)
  const [adminUsuarioModalOpen, setAdminUsuarioModalOpen] = useState(false)
  const [visitanteConfirmOpen, setVisitanteConfirmOpen] = useState(false)
  const [slotPendente, setSlotPendente] = useState<{ inicio: string; fim: string } | null>(null)
  const [nomeUsuarioReserva, setNomeUsuarioReserva] = useState<string | undefined>()

  const janelaDia = horarioDoDia(quadraSelecionada, dataSelecionada)

  const horarioOcupado = useCallback(
    (horaInicio: string) => reservas.find((r) => formatTime(r.hora_inicio) === horaInicio),
    [reservas]
  )

  const horarioPassado = useCallback(
    (horaInicio: string) => {
      if (!dataSelecionada) return false
      return isPastDate(dataSelecionada) || isPastDateTime(dataSelecionada, horaInicio)
    },
    [dataSelecionada]
  )

  const horarioDisponivel = useCallback(
    (horaInicio: string) => {
      if (!canBook) return false
      if (!dataSelecionada) return false
      if (!isDataReservavel(dataSelecionada)) return false
      if (horarioPassado(horaInicio)) return false
      return !horarioOcupado(horaInicio)
    },
    [canBook, dataSelecionada, horarioOcupado, horarioPassado]
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
    setNomeUsuarioReserva(undefined)
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

  const executarReserva = useCallback(
    async (
      horaInicio: string,
      horaFim: string,
      options?: { usuarioId?: string; participantes?: string[]; nomeUsuario?: string }
    ) => {
      if (!quadraSelecionada || !dataSelecionada || !user) return

      const usuarioId = options?.usuarioId ?? user.id
      const participantes = options?.participantes

      setReservandoSlot(horaInicio)
      setMessage(null)

      try {
        const reserva = isAdmin && options?.usuarioId
          ? await adminCreateBooking({
              quadra_id: quadraSelecionada.id,
              usuario_id: usuarioId,
              data_reserva: dataSelecionada,
              hora_inicio: horaInicio,
              hora_fim: horaFim,
              participantes,
            })
          : await createBooking({
              quadra_id: quadraSelecionada.id,
              usuario_id: usuarioId,
              data_reserva: dataSelecionada,
              hora_inicio: horaInicio,
              hora_fim: horaFim,
              participantes,
            })
        setNomeUsuarioReserva(options?.nomeUsuario)
        abrirModalReserva(reserva, quadraSelecionada.nome)
        setModalExpiracaoMinutos(quadraSelecionada.expiracao_pendente_minutos ?? 60)
        setModalValorVisitante(quadraSelecionada.valor_visitante ?? null)
        setParticipantesModalOpen(false)
        setAdminUsuarioModalOpen(false)
        setVisitanteConfirmOpen(false)
        setSlotPendente(null)
        onBookingSuccess?.()
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
      isAdmin,
      abrirModalReserva,
      refreshCourtBookings,
      refreshMyBookings,
      setMessage,
      onBookingSuccess,
    ]
  )

  const handleReservar = useCallback(
    async (horaInicio: string, horaFim: string) => {
      if (!quadraSelecionada || !dataSelecionada || !user) return

      if (!canBook) {
        setMessage({
          type: 'error',
          text: user.inadimplente
            ? 'Há pendências financeiras em sua associação. Procure a secretaria do clube.'
            : 'Seu perfil não permite fazer reservas.',
        })
        return
      }

      if (!janelaDia) {
        setMessage({ type: 'error', text: 'Quadra fechada neste dia.' })
        return
      }

      if (!isDataReservavel(dataSelecionada)) {
        setMessage({
          type: 'error',
          text: 'Data fora do período liberado. A próxima semana abre aos domingos.',
        })
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

      if (isAdmin) {
        setSlotPendente({ inicio: horaInicio, fim: horaFim })
        setAdminUsuarioModalOpen(true)
        return
      }

      const requerPagamento = quadraRequerPagamento(quadraSelecionada.tipo_quadra)

      if (isSocio && isTitular && !requerPagamento) {
        setSlotPendente({ inicio: horaInicio, fim: horaFim })
        setParticipantesModalOpen(true)
        return
      }

      setSlotPendente({ inicio: horaInicio, fim: horaFim })
      setVisitanteConfirmOpen(true)
    },
    [
      quadraSelecionada,
      dataSelecionada,
      user,
      canBook,
      janelaDia,
      horarioOcupado,
      isAdmin,
      isSocio,
      isTitular,
      setMessage,
    ]
  )

  const confirmarReservaVisitante = useCallback(async () => {
    if (!slotPendente) return
    await executarReserva(slotPendente.inicio, slotPendente.fim)
  }, [slotPendente, executarReserva])

  const confirmarReservaComParticipantes = useCallback(
    async (participanteIds: string[]) => {
      if (!slotPendente) return
      await executarReserva(slotPendente.inicio, slotPendente.fim, { participantes: participanteIds })
    },
    [slotPendente, executarReserva]
  )

  const confirmarReservaAdmin = useCallback(
    async (usuarioId: string, participanteIds: string[], nomeUsuario: string) => {
      if (!slotPendente) return
      await executarReserva(slotPendente.inicio, slotPendente.fim, {
        usuarioId,
        participantes: participanteIds.length ? participanteIds : undefined,
        nomeUsuario,
      })
    },
    [slotPendente, executarReserva]
  )

  const fecharParticipantesModal = useCallback(() => {
    setParticipantesModalOpen(false)
    setSlotPendente(null)
  }, [])

  const fecharAdminUsuarioModal = useCallback(() => {
    setAdminUsuarioModalOpen(false)
    setSlotPendente(null)
  }, [])

  const fecharVisitanteConfirm = useCallback(() => {
    setVisitanteConfirmOpen(false)
    setSlotPendente(null)
  }, [])

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
    horarioPassado,
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
    visitanteConfirmOpen,
    fecharVisitanteConfirm,
    confirmarReservaVisitante,
    slotPendente,
    nomeUsuarioReserva,
  }
}

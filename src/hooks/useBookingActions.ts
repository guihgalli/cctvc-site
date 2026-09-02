import { useCallback, useState } from 'react'
import {
  adminCreateBooking,
  cancelBooking,
  createBooking,
  fetchFamilyWeeklyBookingCount,
  fetchUserBookings,
} from '../services/api'
import {
  formatTime,
  getBookingErrorMessage,
  getErrorMessage,
  isPastDate,
  isPastDateTime,
} from '../lib/utils'
import {
  contarReservasFamiliaSemana,
  isDataReservavel,
  LIMITE_RESERVAS_FAMILIA_SEMANA,
  mensagemLimiteSemanalFamilia,
  quadraRequerPagamento,
  reservaPermiteCancelamento,
} from '../lib/bookingRules'
import { horarioDoDia } from '../lib/bookingSchedule'
import type { AuthUser } from '../types'
import type { Quadra, Reserva } from '../types'

type PageMessage = { type: 'success' | 'error'; text: string }

type SlotPendente = {
  inicio: string
  fim: string
  limiteAtingido: boolean
}

interface UseBookingActionsParams {
  user: AuthUser | null
  canBook: boolean
  isAdmin: boolean
  isSocio: boolean
  quadraSelecionada: Quadra | null
  dataSelecionada: string
  reservas: Reserva[]
  minhasReservas: Reserva[]
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
  quadraSelecionada,
  dataSelecionada,
  reservas,
  minhasReservas,
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
  const [slotPendente, setSlotPendente] = useState<SlotPendente | null>(null)
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

  const verificarLimiteSemanalFamilia = useCallback(
    async (data: string): Promise<boolean> => {
      if (!isSocio || isAdmin || !user) return false

      let count = contarReservasFamiliaSemana(minhasReservas, data)

      try {
        const [freshReservas, remoteCount] = await Promise.all([
          fetchUserBookings(user.id),
          fetchFamilyWeeklyBookingCount(data).catch(() => null),
        ])
        count = Math.max(count, contarReservasFamiliaSemana(freshReservas, data))
        if (remoteCount !== null) count = Math.max(count, remoteCount)
      } catch {
        /* mantém contagem local */
      }

      return count >= LIMITE_RESERVAS_FAMILIA_SEMANA
    },
    [isSocio, isAdmin, user, minhasReservas]
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

  const solicitarCancelamento = useCallback(
    (reservaId: string) => {
      const reserva =
        minhasReservas.find((item) => item.id === reservaId) ??
        reservas.find((item) => item.id === reservaId)

      if (reserva && !reservaPermiteCancelamento(reserva)) {
        setMessage({
          type: 'error',
          text: 'Não é possível cancelar reservas de datas anteriores.',
        })
        return
      }

      setCancelConfirmId(reservaId)
    },
    [minhasReservas, reservas, setMessage]
  )

  const confirmarCancelamento = useCallback(async () => {
    if (!cancelConfirmId) return

    setCancelando(true)
    try {
      await cancelBooking(cancelConfirmId)
      fecharModalReserva()
      setCancelConfirmId(null)
      setMessage({ type: 'success', text: 'Reserva cancelada.' })
      await Promise.all([refreshMyBookings(), refreshCourtBookings()])
    } catch (err) {
      setMessage({
        type: 'error',
        text: getErrorMessage(err, 'Erro ao cancelar reserva.'),
      })
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

      const limiteAtingido = await verificarLimiteSemanalFamilia(dataSelecionada)

      if (isAdmin) {
        setSlotPendente({ inicio: horaInicio, fim: horaFim, limiteAtingido: false })
        setAdminUsuarioModalOpen(true)
        return
      }

      const requerPagamento = quadraRequerPagamento(quadraSelecionada.tipo_quadra)

      if (isSocio && !requerPagamento) {
        setMessage(null)
        setSlotPendente({ inicio: horaInicio, fim: horaFim, limiteAtingido })
        setParticipantesModalOpen(true)
        return
      }

      if (limiteAtingido) {
        setMessage({ type: 'error', text: mensagemLimiteSemanalFamilia() })
        return
      }

      setSlotPendente({ inicio: horaInicio, fim: horaFim, limiteAtingido: false })
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
      setMessage,
      verificarLimiteSemanalFamilia,
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

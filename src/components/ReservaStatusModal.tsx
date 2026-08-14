import { useEffect } from 'react'
import { formatDate, formatTime } from '../lib/utils'
import type { Reserva } from '../types'

interface ReservaStatusModalProps {
  reserva: Reserva | null
  quadraNome?: string
  onClose: () => void
  onCancel?: (reservaId: string) => void
}

export function ReservaStatusModal({
  reserva,
  quadraNome,
  onClose,
  onCancel,
}: ReservaStatusModalProps) {
  useEffect(() => {
    if (!reserva) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [reserva, onClose])

  if (!reserva) return null

  const nomeQuadra = reserva.quadras?.nome || quadraNome || 'Quadra'
  const podeCancelar = reserva.status === 'pendente' || reserva.status === 'confirmada'

  const config = {
    pendente: {
      titulo: 'Reserva pendente',
      descricao:
        'Sua solicitação foi enviada e aguarda confirmação do pagamento. A secretaria entrará em contato pelo WhatsApp cadastrado.',
      badge: 'Pendente',
      badgeClass: 'bg-amber-100 text-amber-800',
      iconClass: 'bg-amber-100 text-amber-700',
    },
    confirmada: {
      titulo: 'Reserva confirmada',
      descricao: 'Sua reserva está confirmada. Compareça no horário reservado.',
      badge: 'Confirmada',
      badgeClass: 'bg-emerald-100 text-emerald-800',
      iconClass: 'bg-emerald-100 text-emerald-700',
    },
    recusada: {
      titulo: 'Reserva recusada',
      descricao: 'Esta solicitação não foi aprovada pela secretaria.',
      badge: 'Recusada',
      badgeClass: 'bg-red-100 text-red-700',
      iconClass: 'bg-red-100 text-red-700',
    },
    cancelada: {
      titulo: 'Reserva cancelada',
      descricao: 'Esta reserva foi cancelada.',
      badge: 'Cancelada',
      badgeClass: 'bg-stone-100 text-stone-500',
      iconClass: 'bg-stone-100 text-stone-500',
    },
  }[reserva.status]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reserva-status-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-stone-900/50"
        aria-label="Fechar"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-start gap-3">
            <div
              className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center ${config.iconClass}`}
            >
              {reserva.status === 'pendente' ? (
                <ClockIcon />
              ) : reserva.status === 'confirmada' ? (
                <CheckIcon />
              ) : (
                <InfoIcon />
              )}
            </div>
            <div>
              <h2 id="reserva-status-title" className="text-xl font-bold text-emerald-900">
                {config.titulo}
              </h2>
              <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded font-medium ${config.badgeClass}`}>
                {config.badge}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 text-2xl leading-none px-1"
            aria-label="Fechar modal"
          >
            ×
          </button>
        </div>

        <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 mb-4">
          <p className="font-semibold text-stone-800">{nomeQuadra}</p>
          <p className="text-stone-600 text-sm mt-1">
            {formatDate(reserva.data_reserva)} · {formatTime(reserva.hora_inicio)} –{' '}
            {formatTime(reserva.hora_fim)}
          </p>
        </div>

        <p className="text-stone-600 text-sm leading-relaxed">{config.descricao}</p>

        <div className="flex flex-col-reverse sm:flex-row gap-3 mt-6">
          {podeCancelar && onCancel && (
            <button
              type="button"
              onClick={() => onCancel(reserva.id)}
              className="w-full sm:w-auto px-4 py-3 rounded-lg border border-red-200 text-red-700 font-medium hover:bg-red-50 transition-colors"
            >
              Cancelar reserva
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-full flex-1 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  )
}

function ClockIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6M12 7h.01" />
    </svg>
  )
}

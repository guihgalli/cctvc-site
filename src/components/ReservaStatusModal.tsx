import { useEffect, useState } from 'react'
import {
  buildWhatsAppComprovanteReservaUrl,
  CLUBE_PIX_CNPJ,
  formatCnpj,
  formatDate,
  formatTime,
  formatExpiracaoReserva,
  formatExpiracaoRestante,
  formatMoney,
} from '../lib/utils'
import { reservaPermiteCancelamento } from '../lib/bookingRules'
import type { Reserva } from '../types'
import { Modal } from './motion/Modal'
import { Button } from './motion/Button'

interface ReservaStatusModalProps {
  reserva: Reserva | null
  quadraNome?: string
  isVisitante?: boolean
  requerPagamento?: boolean
  nomeUsuario?: string
  expiracaoPendenteMinutos?: number
  valorVisitante?: number | null
  onClose: () => void
  onCancel?: (reservaId: string) => void
}

export function ReservaStatusModal({
  reserva,
  quadraNome,
  isVisitante = false,
  requerPagamento = false,
  nomeUsuario = '',
  expiracaoPendenteMinutos = 60,
  valorVisitante = null,
  onClose,
  onCancel,
}: ReservaStatusModalProps) {
  const [pixCopiado, setPixCopiado] = useState(false)
  const [agora, setAgora] = useState(() => Date.now())

  useEffect(() => {
    if (!reserva) return
    setPixCopiado(false)
    setAgora(Date.now())
  }, [reserva])

  useEffect(() => {
    if (!reserva || reserva.status !== 'pendente') return
    const interval = window.setInterval(() => setAgora(Date.now()), 30_000)
    return () => window.clearInterval(interval)
  }, [reserva])

  if (!reserva) return null

  const reservaAtiva = reserva
  const nomeQuadra = reservaAtiva.quadras?.nome || quadraNome || 'Quadra'
  const minutosExpiracao =
    reservaAtiva.quadras?.expiracao_pendente_minutos ?? expiracaoPendenteMinutos
  const valorReserva = reservaAtiva.quadras?.valor_visitante ?? valorVisitante
  const podeCancelar = reservaPermiteCancelamento(reservaAtiva)
  const mostrarPagamentoPix =
    reservaAtiva.status === 'pendente' && (isVisitante || requerPagamento)
  const prazoPagamento =
    reservaAtiva.status === 'pendente'
      ? formatExpiracaoReserva(reservaAtiva.criado_em, minutosExpiracao)
      : null
  const tempoRestante =
    reservaAtiva.status === 'pendente'
      ? formatExpiracaoRestante(reservaAtiva.criado_em, minutosExpiracao, agora)
      : null

  const config = {
    pendente: {
      titulo: 'Reserva pendente',
      descricao: mostrarPagamentoPix
        ? null
        : 'Sua solicitação foi enviada e aguarda confirmação do pagamento. A secretaria entrará em contato pelo WhatsApp cadastrado.',
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
  }[reservaAtiva.status]

  async function copiarChavePix() {
    try {
      await navigator.clipboard.writeText(CLUBE_PIX_CNPJ)
      setPixCopiado(true)
      window.setTimeout(() => setPixCopiado(false), 2000)
    } catch {
      /* fallback silencioso */
    }
  }

  function enviarComprovanteWhatsApp() {
    const url = buildWhatsAppComprovanteReservaUrl(
      nomeUsuario || 'Visitante',
      nomeQuadra,
      reservaAtiva.data_reserva,
      reservaAtiva.hora_inicio,
      reservaAtiva.hora_fim,
      valorReserva
    )
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <Modal open={!!reserva} onClose={onClose} labelledBy="reserva-status-title" initialFocus>
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-start gap-3">
          <div
            className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center ${config.iconClass}`}
          >
            {reservaAtiva.status === 'pendente' ? (
              <ClockIcon />
            ) : reservaAtiva.status === 'confirmada' ? (
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
          className="text-stone-400 hover:text-stone-600 text-2xl leading-none px-1 motion-cta"
          aria-label="Fechar modal"
        >
          ×
        </button>
      </div>

      <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 mb-4">
        <p className="font-semibold text-stone-800">{nomeQuadra}</p>
        <p className="text-stone-600 text-sm mt-1">
          {formatDate(reservaAtiva.data_reserva)} · {formatTime(reservaAtiva.hora_inicio)} –{' '}
          {formatTime(reservaAtiva.hora_fim)}
        </p>
        {reservaAtiva.participante && (
          <p className="text-blue-800 text-sm mt-2 font-medium">Você participa desta reserva.</p>
        )}
        {(reservaAtiva.participante || reservaAtiva.reserva_familiar) &&
          reservaAtiva.titular_reserva && (
          <p className="text-blue-800 text-sm mt-2">
            Reserva de <strong>{reservaAtiva.titular_reserva.nome}</strong>
            {reservaAtiva.titular_reserva.codigo_usuario && (
              <span className="text-stone-500 font-mono text-xs ml-1">
                ({reservaAtiva.titular_reserva.codigo_usuario})
              </span>
            )}
          </p>
        )}
        {reservaAtiva.participantes && reservaAtiva.participantes.length > 0 && (
          <p className="text-stone-500 text-sm mt-2">
            Participantes:{' '}
            {reservaAtiva.participantes.map((p) => p.nome).join(', ')}
          </p>
        )}
      </div>

      {mostrarPagamentoPix ? (
        <div className="space-y-4">
          {prazoPagamento && (
            <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm motion-feedback--enter">
              Prazo para pagamento: até <strong>{prazoPagamento}</strong>
              {tempoRestante && tempoRestante !== 'Expirada' && (
                <> · <strong>{tempoRestante} restantes</strong></>
              )}
              {tempoRestante === 'Expirada' && (
                <> · <strong>prazo expirado</strong></>
              )}
              . Após esse horário, a reserva expira e o horário é liberado.
            </p>
          )}
          <p className="text-stone-600 text-sm leading-relaxed">
            {valorReserva != null && (
              <>
                Valor da reserva:{' '}
                <strong className="text-stone-800">{formatMoney(Number(valorReserva))}</strong>.{' '}
              </>
            )}
            Faça o pagamento no PIX{' '}
            <strong className="text-stone-800">{CLUBE_PIX_CNPJ}</strong> (CNPJ) e envie o
            comprovante clicando no botão abaixo para confirmar sua reserva.
          </p>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-xs font-medium text-emerald-800 uppercase tracking-wide mb-1">
              Chave PIX (CNPJ)
            </p>
            <div className="flex items-center gap-2">
              <p className="font-mono text-sm text-emerald-900 flex-1 break-all">
                {formatCnpj(CLUBE_PIX_CNPJ)}
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={copiarChavePix}
                className="shrink-0 border-emerald-300 text-emerald-800 hover:bg-emerald-100"
              >
                {pixCopiado ? (
                  <span key="copied" className="motion-icon-swap">Copiado!</span>
                ) : (
                  <span key="copy">Copiar</span>
                )}
              </Button>
            </div>
          </div>

          <Button
            variant="whatsapp"
            size="lg"
            className="w-full"
            onClick={enviarComprovanteWhatsApp}
          >
            <WhatsAppIcon />
            Enviar comprovante no WhatsApp
          </Button>
        </div>
      ) : (
        <>
          {prazoPagamento && reservaAtiva.status === 'pendente' && (
            <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm mb-4">
              Prazo para confirmação: até <strong>{prazoPagamento}</strong>
              {tempoRestante && tempoRestante !== 'Expirada' && (
                <> · <strong>{tempoRestante} restantes</strong></>
              )}
              .
            </p>
          )}
          {config.descricao && (
            <p className="text-stone-600 text-sm leading-relaxed">{config.descricao}</p>
          )}
        </>
      )}

      <div className="flex flex-col-reverse sm:flex-row gap-3 mt-6">
        {podeCancelar && onCancel && (
          <Button
            variant="danger"
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => onCancel(reservaAtiva.id)}
          >
            Cancelar reserva
          </Button>
        )}
        <Button variant="primary" size="lg" className="w-full flex-1" onClick={onClose}>
          Entendi
        </Button>
      </div>
    </Modal>
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

function WhatsAppIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.52 3.48A11.86 11.86 0 0 0 12.04 0C5.5 0 .2 5.3.2 11.84c0 2.09.55 4.12 1.6 5.92L0 24l6.4-1.68a11.8 11.8 0 0 0 5.64 1.44h.01c6.54 0 11.84-5.3 11.84-11.84 0-3.16-1.23-6.13-3.37-8.44ZM12.05 21.5h-.01a9.67 9.67 0 0 1-4.93-1.35l-.35-.21-3.8 1 1.01-3.7-.23-.38a9.66 9.66 0 0 1-1.48-5.16c0-5.34 4.35-9.68 9.7-9.68 2.59 0 5.02 1.01 6.85 2.84a9.62 9.62 0 0 1 2.84 6.85c0 5.34-4.35 9.79-9.6 9.79Zm5.3-7.25c-.29-.15-1.72-.85-1.99-.94-.27-.1-.46-.15-.66.14-.19.29-.76.94-.93 1.14-.17.19-.34.22-.63.07-.29-.15-1.23-.45-2.34-1.44-.86-.77-1.44-1.72-1.61-2.01-.17-.29-.02-.45.13-.6.13-.13.29-.34.43-.51.15-.17.19-.29.29-.48.1-.19.05-.36-.02-.51-.07-.15-.66-1.59-.9-2.18-.24-.57-.48-.49-.66-.5h-.56c-.19 0-.51.07-.78.36-.27.29-1.03 1-1.03 2.45s1.05 2.84 1.2 3.04c.15.19 2.07 3.16 5.01 4.43.7.3 1.25.48 1.68.62.7.22 1.34.19 1.85.12.56-.08 1.72-.7 1.96-1.38.24-.68.24-1.26.17-1.38-.07-.12-.26-.19-.55-.34Z" />
    </svg>
  )
}

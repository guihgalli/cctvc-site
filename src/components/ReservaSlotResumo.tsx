import { formatDate, formatMoney } from '../lib/utils'

interface ReservaSlotResumoProps {
  quadraNome: string
  dataReserva: string
  horaInicio: string
  horaFim: string
  valorVisitante?: number | null
  isVisitante?: boolean
  className?: string
}

export function ReservaSlotResumo({
  quadraNome,
  dataReserva,
  horaInicio,
  horaFim,
  valorVisitante,
  isVisitante = false,
  className = '',
}: ReservaSlotResumoProps) {
  return (
    <div className={`rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 ${className}`}>
      <p className="font-semibold text-stone-800">{quadraNome}</p>
      <p className="text-stone-600 text-sm mt-1">
        {formatDate(dataReserva)} · {horaInicio} – {horaFim}
      </p>
      {isVisitante && valorVisitante != null && (
        <p className="text-emerald-800 text-sm font-semibold mt-1.5">
          Valor: {formatMoney(Number(valorVisitante))}
        </p>
      )}
    </div>
  )
}

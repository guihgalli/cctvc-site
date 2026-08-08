import { useEffect, useState, type FormEvent } from 'react'
import {
  DEFAULT_SLOT_END,
  DEFAULT_SLOT_MINUTES,
  DEFAULT_SLOT_START,
  DIAS_SEMANA_LABELS,
  formatTime,
} from '../lib/utils'
import type { CourtScheduleInput, HorarioQuadra } from '../types'

type DiaForm = {
  ativo: boolean
  hora_inicio: string
  hora_fim: string
}

type Props = {
  horarios: HorarioQuadra[] | undefined
  saving?: boolean
  onSave: (schedules: CourtScheduleInput[]) => Promise<void>
  onCancel: () => void
}

function buildInitialDays(horarios: HorarioQuadra[] | undefined): DiaForm[] {
  return DIAS_SEMANA_LABELS.map((_, dia) => {
    const existente = horarios?.find((h) => h.dia_semana === dia && h.ativo !== false)
    if (existente) {
      return {
        ativo: true,
        hora_inicio: formatTime(existente.hora_inicio),
        hora_fim: formatTime(existente.hora_fim),
      }
    }
    return {
      ativo: !horarios || horarios.length === 0,
      hora_inicio: DEFAULT_SLOT_START,
      hora_fim: DEFAULT_SLOT_END,
    }
  })
}

export function CourtScheduleEditor({ horarios, saving = false, onSave, onCancel }: Props) {
  const [dias, setDias] = useState<DiaForm[]>(() => buildInitialDays(horarios))
  const [intervalo, setIntervalo] = useState(
    horarios?.find((h) => h.ativo !== false)?.intervalo_min || DEFAULT_SLOT_MINUTES
  )
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    setDias(buildInitialDays(horarios))
    setIntervalo(horarios?.find((h) => h.ativo !== false)?.intervalo_min || DEFAULT_SLOT_MINUTES)
    setErro(null)
  }, [horarios])

  function atualizarDia(index: number, patch: Partial<DiaForm>) {
    setDias((prev) => prev.map((dia, i) => (i === index ? { ...dia, ...patch } : dia)))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)

    const ativos = dias
      .map((dia, dia_semana) => ({ dia, dia_semana }))
      .filter(({ dia }) => dia.ativo)

    if (ativos.length === 0) {
      setErro('Selecione pelo menos um dia disponível.')
      return
    }

    for (const { dia, dia_semana } of ativos) {
      if (dia.hora_fim <= dia.hora_inicio) {
        setErro(`Horário inválido em ${DIAS_SEMANA_LABELS[dia_semana]}: fim deve ser após o início.`)
        return
      }
    }

    const schedules: CourtScheduleInput[] = ativos.map(({ dia, dia_semana }) => ({
      dia_semana,
      hora_inicio: dia.hora_inicio,
      hora_fim: dia.hora_fim,
      intervalo_min: intervalo,
    }))

    await onSave(schedules)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 rounded-lg border border-stone-200 bg-stone-50 p-3 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-stone-700">Dias e horários disponíveis</p>
        <label className="flex items-center gap-2 text-xs text-stone-600">
          Intervalo
          <select
            value={intervalo}
            onChange={(e) => setIntervalo(Number(e.target.value))}
            className="border rounded-md px-2 py-1 bg-white"
          >
            <option value={30}>30 min</option>
            <option value={60}>60 min</option>
            <option value={90}>90 min</option>
            <option value={120}>120 min</option>
          </select>
        </label>
      </div>

      <div className="space-y-2">
        {dias.map((dia, index) => (
          <div
            key={DIAS_SEMANA_LABELS[index]}
            className="grid grid-cols-[auto_1fr] sm:grid-cols-[7rem_1fr_1fr] gap-2 items-center bg-white rounded-md border border-stone-200 px-2 py-2"
          >
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={dia.ativo}
                onChange={(e) => atualizarDia(index, { ativo: e.target.checked })}
              />
              {DIAS_SEMANA_LABELS[index]}
            </label>
            <div className="flex items-center gap-2 col-span-1 sm:col-span-2">
              <input
                type="time"
                value={dia.hora_inicio}
                disabled={!dia.ativo}
                onChange={(e) => atualizarDia(index, { hora_inicio: e.target.value })}
                className="border rounded-md px-2 py-1 text-sm disabled:opacity-40 w-full"
              />
              <span className="text-stone-400 text-xs shrink-0">até</span>
              <input
                type="time"
                value={dia.hora_fim}
                disabled={!dia.ativo}
                onChange={(e) => atualizarDia(index, { hora_fim: e.target.value })}
                className="border rounded-md px-2 py-1 text-sm disabled:opacity-40 w-full"
              />
            </div>
          </div>
        ))}
      </div>

      {erro && <p className="text-xs text-red-600">{erro}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="text-xs bg-emerald-700 text-white px-3 py-1.5 rounded hover:bg-emerald-600 disabled:opacity-60"
        >
          {saving ? 'Salvando...' : 'Salvar horários'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs border border-stone-300 text-stone-600 px-3 py-1.5 rounded hover:bg-white"
        >
          Fechar
        </button>
      </div>
    </form>
  )
}

/** Resumo curto dos dias configurados */
export function resumirHorarios(horarios: HorarioQuadra[] | undefined): string {
  if (!horarios || horarios.length === 0) {
    return 'Sem horários configurados (padrão 07:00–22:00 todos os dias)'
  }

  const ativos = [...horarios]
    .filter((h) => h.ativo !== false)
    .sort((a, b) => a.dia_semana - b.dia_semana)

  if (ativos.length === 0) return 'Nenhum dia disponível'

  return ativos
    .map(
      (h) =>
        `${DIAS_SEMANA_LABELS[h.dia_semana].slice(0, 3)} ${formatTime(h.hora_inicio)}–${formatTime(h.hora_fim)}`
    )
    .join(' · ')
}

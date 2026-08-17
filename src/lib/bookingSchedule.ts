import {
  DEFAULT_SLOT_END,
  DEFAULT_SLOT_MINUTES,
  DEFAULT_SLOT_START,
  getWeekdayIndex,
} from './utils'
import type { HorarioQuadra, Quadra } from '../types'

export function horarioDoDia(
  quadra: Quadra | null,
  data: string
): HorarioQuadra | { hora_inicio: string; hora_fim: string; intervalo_min: number } | null {
  if (!quadra) return null

  const dia = getWeekdayIndex(data)
  const configurados = (quadra.horarios_quadra || []).filter((h) => h.ativo !== false)

  if (configurados.length === 0) {
    return {
      hora_inicio: DEFAULT_SLOT_START,
      hora_fim: DEFAULT_SLOT_END,
      intervalo_min: DEFAULT_SLOT_MINUTES,
    }
  }

  return configurados.find((h) => h.dia_semana === dia) || null
}

export function diaDisponivel(quadra: Quadra | null, data: string): boolean {
  return !!horarioDoDia(quadra, data)
}

export function proximaDataDisponivel(quadra: Quadra | null, datas: string[]): string | undefined {
  return datas.find((data) => diaDisponivel(quadra, data))
}

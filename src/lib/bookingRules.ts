import { todayIsoDate } from './utils'

/** Segunda=0 … Domingo=6 (semana clube) */
function dowSegunda(date: string): number {
  const d = new Date(`${date}T12:00:00`)
  const js = d.getDay()
  return js === 0 ? 6 : js - 1
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export function inicioSemanaSegunda(date: string): string {
  return addDays(date, -dowSegunda(date))
}

export function fimSemanaDomingo(date: string): string {
  return addDays(inicioSemanaSegunda(date), 6)
}

/** Data está no período liberado para reserva (semana atual + próxima aos domingos) */
export function isDataReservavel(date: string, hoje = todayIsoDate()): boolean {
  if (date < hoje) return false

  const inicioAtual = inicioSemanaSegunda(hoje)
  const fimAtual = fimSemanaDomingo(hoje)
  const inicioProx = addDays(inicioAtual, 7)
  const fimProx = addDays(fimAtual, 7)

  if (date >= inicioAtual && date <= fimAtual) return true
  if (dowSegunda(hoje) === 6 && date >= inicioProx && date <= fimProx) return true

  return false
}

/** Gera datas reserváveis conforme regra semanal */
export function generateBookableDates(maxDays = 14, hoje = todayIsoDate()): string[] {
  const dates: string[] = []
  for (let i = 0; i < maxDays; i++) {
    const d = addDays(hoje, i)
    if (isDataReservavel(d, hoje)) dates.push(d)
  }
  return dates
}

/** Seleção de participantes habilitada a partir de outubro */
export function isParticipantesHabilitado(date = todayIsoDate()): boolean {
  const month = Number(date.split('-')[1])
  return month >= 10
}

/** Último dígito 0 = titular, 1-9 = dependente */
export function categoriaFromCodigo(codigo: string | null | undefined): 'titular' | 'dependente' | null {
  if (!codigo || !/^\d{4}$/.test(codigo)) return null
  return codigo.endsWith('0') ? 'titular' : 'dependente'
}

export function labelCategoriaSocio(categoria: string | null | undefined): string {
  if (categoria === 'titular') return 'Sócio titular'
  if (categoria === 'dependente') return 'Sócio dependente'
  return 'Sócio'
}

export function labelTipoQuadra(tipo: string | null | undefined): string {
  if (tipo === 'socio') return 'Sócios'
  if (tipo === 'locacao') return 'Locação'
  return 'Geral'
}

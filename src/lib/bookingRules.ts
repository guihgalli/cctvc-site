import { todayIsoDate } from './utils'
import type { TitularResumo, Usuario } from '../types'

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

/** Seleção de participantes na reserva (sócio titular) */
export function isParticipantesHabilitado(_date = todayIsoDate()): boolean {
  return true
}

export function labelTipoUsuario(tipo: string | null | undefined): string {
  if (tipo === 'nao_socio') return 'Visitante'
  return 'Sócio'
}

export function descricaoUsuarioReserva(usuario: {
  tipo_socio?: string | null
  categoria_socio?: string | null
}): string {
  if (usuario.tipo_socio === 'socio') {
    return labelCategoriaSocio(usuario.categoria_socio)
  }
  return labelTipoUsuario(usuario.tipo_socio)
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

/** Matrícula do titular a partir do código do dependente (ex.: 0261 → 0260). */
export function codigoTitularFromDependente(codigo: string | null | undefined): string | null {
  if (!codigo || !/^\d{4}$/.test(codigo) || codigo.endsWith('0')) return null
  return codigo.slice(0, 3) + '0'
}

export function formatTitularVinculo(titular: TitularResumo | null | undefined): string | null {
  if (!titular?.nome) return null
  const matricula = titular.codigo_usuario ? ` · matrícula ${titular.codigo_usuario}` : ''
  return `${titular.nome}${matricula}`
}

/** Resolve titular de um dependente a partir da lista de usuários ou do vínculo da API. */
export function resolveTitularUsuario(
  usuario: Pick<Usuario, 'categoria_socio' | 'titular_id' | 'titular' | 'codigo_usuario'>,
  usuarios: Pick<Usuario, 'id' | 'nome' | 'codigo_usuario'>[] = []
): TitularResumo | null {
  if (usuario.categoria_socio !== 'dependente') return null
  if (usuario.titular?.nome) return usuario.titular

  if (usuario.titular_id) {
    const porId = usuarios.find((u) => u.id === usuario.titular_id)
    if (porId) return { nome: porId.nome, codigo_usuario: porId.codigo_usuario }
  }

  const codigoTitular = codigoTitularFromDependente(usuario.codigo_usuario)
  if (codigoTitular) {
    const porCodigo = usuarios.find((u) => u.codigo_usuario === codigoTitular)
    if (porCodigo) return { nome: porCodigo.nome, codigo_usuario: porCodigo.codigo_usuario }
    return { nome: 'Titular', codigo_usuario: codigoTitular }
  }

  return null
}

export function labelTipoQuadra(tipo: string | null | undefined): string {
  if (tipo === 'socio') return 'Sócios'
  if (tipo === 'locacao') return 'Locação'
  return 'Geral'
}

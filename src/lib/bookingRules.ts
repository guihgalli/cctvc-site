import { isPastDate, todayIsoDate } from './utils'
import type { Reserva, TitularResumo, Usuario } from '../types'

const BRAZIL_TZ = 'America/Sao_Paulo'
/** Horário-limite na sexta (America/Sao_Paulo) para reservar sábado/domingo */
export const PRAZO_FIM_SEMANA_HORA = 17

export const AVISO_PRAZO_FIM_SEMANA =
  'Reservas de sábado e domingo devem ser solicitadas até sexta-feira às 17h.'

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

function brazilNowParts(agora = new Date()): {
  date: string
  hour: number
  minute: number
} {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BRAZIL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(agora)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  const year = get('year')
  const month = get('month')
  const day = get('day')
  return {
    date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    hour: get('hour'),
    minute: get('minute'),
  }
}

export function inicioSemanaSegunda(date: string): string {
  return addDays(date, -dowSegunda(date))
}

export function fimSemanaDomingo(date: string): string {
  return addDays(inicioSemanaSegunda(date), 6)
}

/** Sábado ou domingo (JS: 0=domingo, 6=sábado) */
export function isDataFimDeSemana(date: string): boolean {
  const js = new Date(`${date}T12:00:00`).getDay()
  return js === 0 || js === 6
}

/** Sexta imediatamente anterior ao fim de semana da data */
export function sextaAntesDoFimDeSemana(date: string): string | null {
  const js = new Date(`${date}T12:00:00`).getDay()
  if (js === 6) return addDays(date, -1)
  if (js === 0) return addDays(date, -2)
  return null
}

/**
 * Reservas de sábado/domingo só até sexta 17h (America/Sao_Paulo) daquele fim de semana.
 * A partir de 17:00 de sexta o prazo está encerrado.
 */
export function prazoReservaFimDeSemanaExpirado(dataReserva: string, agora = new Date()): boolean {
  const sexta = sextaAntesDoFimDeSemana(dataReserva)
  if (!sexta) return false

  const { date: hoje, hour, minute } = brazilNowParts(agora)
  if (hoje > sexta) return true
  if (hoje < sexta) return false
  return hour * 60 + minute >= PRAZO_FIM_SEMANA_HORA * 60
}

export function mensagemPrazoFimDeSemana(): string {
  return `${AVISO_PRAZO_FIM_SEMANA} O prazo para este fim de semana já encerrou.`
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

/** Período liberado e, se for sábado/domingo, ainda dentro do prazo de sexta 17h */
export function podeAgendarData(date: string, hoje = todayIsoDate(), agora = new Date()): boolean {
  if (!isDataReservavel(date, hoje)) return false
  if (prazoReservaFimDeSemanaExpirado(date, agora)) return false
  return true
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

/** Quadra de locação exige pagamento PIX para confirmar a reserva */
export function quadraRequerPagamento(tipo: string | null | undefined): boolean {
  return tipo === 'locacao'
}

/** Limite semanal compartilhado entre titular e dependentes (segunda a domingo) */
export const LIMITE_RESERVAS_FAMILIA_SEMANA = 2

/** Mensagem quando a família já atingiu o limite semanal de reservas */
export function mensagemLimiteSemanalFamilia(): string {
  return `Você não pode solicitar esta reserva: sua família (titular e dependentes) já atingiu o limite de ${LIMITE_RESERVAS_FAMILIA_SEMANA} reservas nesta semana (segunda a domingo).`
}

type ReservaContagemSemanal = Pick<Reserva, 'data_reserva' | 'status'>

/** Conta reservas da família na semana da data (segunda a domingo). */
export function contarReservasFamiliaSemana(
  reservas: ReservaContagemSemanal[],
  data: string
): number {
  const inicio = inicioSemanaSegunda(data)
  const fim = fimSemanaDomingo(data)

  return reservas.filter(
    (reserva) =>
      (reserva.status === 'pendente' || reserva.status === 'confirmada') &&
      reserva.data_reserva >= inicio &&
      reserva.data_reserva <= fim
  ).length
}

export function familiaAtingiuLimiteSemanal(
  reservas: ReservaContagemSemanal[],
  data: string
): boolean {
  return contarReservasFamiliaSemana(reservas, data) >= LIMITE_RESERVAS_FAMILIA_SEMANA
}

type ReservaCancelamento = Pick<Reserva, 'data_reserva' | 'status'>

/** Reserva ainda pode ser cancelada (somente futuras ou hoje, status ativo). */
export function reservaPermiteCancelamento(reserva: ReservaCancelamento): boolean {
  if (reserva.status !== 'pendente' && reserva.status !== 'confirmada') return false
  return !isPastDate(reserva.data_reserva)
}

/** Visibilidade da quadra conforme perfil do usuário logado */
export function quadraVisivelParaUsuario(
  tipo: string | null | undefined,
  user: { perfil?: string; tipo_socio?: string } | null | undefined
): boolean {
  if (!user || user.perfil === 'admin') return true
  const tipoQuadra = tipo ?? 'geral'
  if (tipoQuadra === 'geral') return true
  if (user.tipo_socio === 'nao_socio') return tipoQuadra !== 'socio'
  if (user.tipo_socio === 'socio') return tipoQuadra === 'socio' || tipoQuadra === 'locacao'
  return true
}

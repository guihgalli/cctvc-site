export type PerfilUsuario = 'usuario' | 'admin'
export type TipoSocio = 'socio' | 'nao_socio'
export type CategoriaSocio = 'titular' | 'dependente'
export type TipoQuadra = 'socio' | 'locacao' | 'geral'
export type StatusReserva = 'pendente' | 'confirmada' | 'recusada' | 'cancelada'

export interface TitularResumo {
  nome: string
  codigo_usuario: string | null
  matricula?: number | null
  categoria_clube?: string | null
  data_nascimento?: string | null
  data_admissao?: string | null
}

export interface Usuario {
  id: string
  codigo_usuario: string | null
  cpf: string | null
  nome: string
  email: string | null
  telefone: string | null
  perfil: PerfilUsuario
  tipo_socio: TipoSocio
  categoria_socio?: CategoriaSocio | null
  titular_id?: string | null
  titular?: TitularResumo | null
  matricula?: number | null
  categoria_clube?: string | null
  data_nascimento?: string | null
  data_admissao?: string | null
  parentesco?: string | null
  sexo?: string | null
  numero_dependente?: number | null
  ativo: boolean
  criado_em: string
}

export interface HorarioQuadra {
  id: string
  quadra_id: string
  /** 0=domingo … 6=sábado */
  dia_semana: number
  hora_inicio: string
  hora_fim: string
  intervalo_min: number
  ativo: boolean
  criado_em: string
}

export interface Quadra {
  id: string
  nome: string
  descricao: string | null
  tipo_esporte: string | null
  ativo: boolean
  /** Minutos até cancelar reserva pendente e liberar o horário (padrão: 60) */
  expiracao_pendente_minutos?: number
  /** Valor cobrado por reserva de visitante (não-sócio), em reais */
  valor_visitante?: number | null
  tipo_quadra?: TipoQuadra
  criado_em: string
  fotos_quadras?: FotoQuadra[]
  horarios_quadra?: HorarioQuadra[]
}

export interface FotoQuadra {
  id: string
  quadra_id: string
  url: string
  principal: boolean
  criado_em: string
}

export type CourtScheduleInput = {
  dia_semana: number
  hora_inicio: string
  hora_fim: string
  intervalo_min: number
}

export interface Reserva {
  id: string
  quadra_id: string
  usuario_id: string
  data_reserva: string
  hora_inicio: string
  hora_fim: string
  status: StatusReserva
  criado_em: string
  quadras?: Quadra
  usuarios?: Usuario
  participantes?: ReservaParticipante[]
  participante?: boolean
  titular_reserva?: { nome: string; codigo_usuario: string | null }
}

export interface ReservaParticipante {
  id: string
  nome: string
  codigo_usuario: string | null
  categoria_socio?: CategoriaSocio | null
}

export interface AuthUser {
  id: string
  codigo_usuario: string | null
  nome: string
  perfil: PerfilUsuario
  tipo_socio: TipoSocio
  categoria_socio?: CategoriaSocio | null
  titular?: TitularResumo | null
  matricula?: number | null
  categoria_clube?: string | null
  data_nascimento?: string | null
  data_admissao?: string | null
  parentesco?: string | null
  sexo?: string | null
  numero_dependente?: number | null
  ativo?: boolean
  inadimplente?: boolean
  telefone: string | null
  email: string | null
  precisa_cadastro?: boolean
  precisa_telefone?: boolean
}

export interface TimeSlot {
  start: string
  end: string
  available: boolean
  bookingId?: string
}

// Aliases em inglês para compatibilidade interna (deprecated)
export type User = Usuario
export type Court = Quadra
export type CourtPhoto = FotoQuadra
export type Booking = Reserva
export type UserRole = PerfilUsuario

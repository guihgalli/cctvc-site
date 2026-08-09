export type PerfilUsuario = 'usuario' | 'admin'

export interface Usuario {
  id: string
  codigo_usuario: string
  cpf: string
  nome: string
  email: string | null
  telefone: string | null
  perfil: PerfilUsuario
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
  status: 'confirmada' | 'cancelada'
  criado_em: string
  quadras?: Quadra
  usuarios?: Usuario
}

export interface AuthUser {
  id: string
  codigo_usuario: string
  nome: string
  perfil: PerfilUsuario
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

import { supabase } from '../lib/supabase'
import type {
  CourtScheduleInput,
  FotoQuadra,
  HorarioQuadra,
  Quadra,
  Reserva,
  Usuario,
} from '../types'

const COURT_SELECT = '*, fotos_quadras(*), horarios_quadra(*)'

let sessionToken: string | null = null

export function setSessionToken(token: string | null) {
  sessionToken = token
}

export function getSessionToken(): string | null {
  return sessionToken
}

function requireToken(): string {
  if (!sessionToken) {
    throw new Error('Sessão inválida. Faça login novamente.')
  }
  return sessionToken
}

function rpcErrorMessage(error: { message?: string } | null, fallback: string): string {
  const message = error?.message?.trim()
  if (!message) return fallback
  return message
}

async function rpc<T>(fn: string, args: Record<string, unknown>, fallbackError: string): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) {
    throw new Error(rpcErrorMessage(error, fallbackError))
  }
  return data as T
}

export interface LoginResult {
  token: string
  user: {
    id: string
    codigo_usuario: string
    nome: string
    perfil: 'usuario' | 'admin'
  }
}

export async function loginWithCredentials(
  userCode: string,
  password: string
): Promise<LoginResult> {
  return rpc<LoginResult>(
    'fazer_login',
    { p_codigo: userCode, p_senha: password },
    'Usuário ou senha inválidos'
  )
}

export async function fetchSession(token: string): Promise<LoginResult> {
  return rpc<LoginResult>('obter_sessao', { p_token: token }, 'Sessão inválida ou expirada')
}

export async function logoutSession(token: string): Promise<void> {
  try {
    await rpc('fazer_logout', { p_token: token }, 'Erro ao encerrar sessão')
  } catch {
    /* ignora falha de rede no logout */
  }
}

/** Catálogo público: apenas quadras ativas (RLS) */
export async function fetchCourts(): Promise<Quadra[]> {
  const { data, error } = await supabase
    .from('quadras')
    .select(COURT_SELECT)
    .eq('ativo', true)
    .order('nome')

  if (error) throw error
  return data || []
}

export async function fetchAllCourts(): Promise<Quadra[]> {
  const token = requireToken()
  const data = await rpc<Quadra[]>(
    'admin_listar_quadras',
    { p_token: token },
    'Erro ao carregar quadras.'
  )
  return data || []
}

export async function createCourt(quadra: {
  nome: string
  descricao?: string
  tipo_esporte?: string
}): Promise<Quadra> {
  const token = requireToken()
  return rpc<Quadra>(
    'admin_criar_quadra',
    {
      p_token: token,
      p_nome: quadra.nome,
      p_descricao: quadra.descricao ?? null,
      p_tipo_esporte: quadra.tipo_esporte ?? null,
    },
    'Erro ao cadastrar quadra.'
  )
}

export async function replaceCourtSchedules(
  quadraId: string,
  schedules: CourtScheduleInput[]
): Promise<HorarioQuadra[]> {
  const token = requireToken()
  const data = await rpc<HorarioQuadra[]>(
    'admin_substituir_horarios_quadra',
    {
      p_token: token,
      p_quadra_id: quadraId,
      p_horarios: schedules,
    },
    'Erro ao salvar horários.'
  )
  return data || []
}

export async function updateCourt(
  id: string,
  updates: Partial<{ nome: string; descricao: string; tipo_esporte: string; ativo: boolean }>
): Promise<Quadra> {
  const token = requireToken()
  return rpc<Quadra>(
    'admin_atualizar_quadra',
    {
      p_token: token,
      p_id: id,
      p_nome: updates.nome ?? null,
      p_descricao: updates.descricao ?? null,
      p_tipo_esporte: updates.tipo_esporte ?? null,
      p_ativo: updates.ativo ?? null,
    },
    'Erro ao atualizar quadra.'
  )
}

export async function deleteCourt(id: string): Promise<void> {
  const token = requireToken()
  await rpc('admin_excluir_quadra', { p_token: token, p_id: id }, 'Erro ao excluir quadra.')
}

const COURT_PHOTOS_BUCKET = 'fotos-quadra'

export async function uploadCourtPhoto(
  quadraId: string,
  file: File,
  principal = false
): Promise<FotoQuadra> {
  const token = requireToken()
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()

  const ticket = await rpc<{ ticket_id: string; path: string; bucket: string }>(
    'admin_solicitar_upload_foto',
    { p_token: token, p_quadra_id: quadraId, p_ext: ext },
    'Erro ao autorizar upload da foto.'
  )

  const { error: uploadError } = await supabase.storage
    .from(COURT_PHOTOS_BUCKET)
    .upload(ticket.path, file, {
      contentType: file.type || 'image/jpeg',
      upsert: false,
    })

  if (uploadError) throw uploadError

  const { data: urlData } = supabase.storage.from(COURT_PHOTOS_BUCKET).getPublicUrl(ticket.path)

  return rpc<FotoQuadra>(
    'admin_confirmar_foto_quadra',
    {
      p_token: token,
      p_path: ticket.path,
      p_url: urlData.publicUrl,
      p_principal: principal,
    },
    'Erro ao registrar foto da quadra.'
  )
}

export async function fetchBookingsByCourtAndDate(
  quadraId: string,
  date: string
): Promise<Reserva[]> {
  const token = requireToken()
  const data = await rpc<Reserva[]>(
    'listar_reservas_quadra_data',
    { p_token: token, p_quadra_id: quadraId, p_data: date },
    'Erro ao carregar horários.'
  )
  return data || []
}

export async function fetchAllBookings(filters?: {
  courtId?: string
  date?: string
}): Promise<Reserva[]> {
  const token = requireToken()
  const data = await rpc<Reserva[]>(
    'admin_listar_reservas',
    {
      p_token: token,
      p_quadra_id: filters?.courtId || null,
      p_data: filters?.date || null,
    },
    'Erro ao carregar agenda.'
  )
  return data || []
}

export async function fetchUserBookings(_usuarioId: string): Promise<Reserva[]> {
  const token = requireToken()
  const data = await rpc<Reserva[]>(
    'listar_minhas_reservas',
    { p_token: token },
    'Erro ao carregar suas reservas.'
  )
  return data || []
}

export async function createBooking(reserva: {
  quadra_id: string
  usuario_id: string
  data_reserva: string
  hora_inicio: string
  hora_fim: string
}): Promise<Reserva> {
  const token = requireToken()
  // usuario_id é ignorado no servidor — sempre usa o dono da sessão
  void reserva.usuario_id
  return rpc<Reserva>(
    'criar_reserva',
    {
      p_token: token,
      p_quadra_id: reserva.quadra_id,
      p_data: reserva.data_reserva,
      p_hora_inicio: reserva.hora_inicio,
      p_hora_fim: reserva.hora_fim,
    },
    'Erro ao fazer reserva.'
  )
}

export async function cancelBooking(id: string): Promise<void> {
  const token = requireToken()
  await rpc('cancelar_reserva', { p_token: token, p_reserva_id: id }, 'Erro ao cancelar reserva.')
}

export async function fetchUsers(): Promise<Usuario[]> {
  const token = requireToken()
  const data = await rpc<Usuario[]>(
    'admin_listar_usuarios',
    { p_token: token },
    'Erro ao carregar usuários.'
  )
  return data || []
}

export async function createUser(usuario: {
  codigo_usuario: string
  cpf: string
  nome: string
  email: string
  telefone: string
  perfil?: 'usuario' | 'admin'
}): Promise<Usuario> {
  const token = requireToken()
  return rpc<Usuario>(
    'admin_criar_usuario',
    {
      p_token: token,
      p_codigo: usuario.codigo_usuario,
      p_cpf: usuario.cpf,
      p_nome: usuario.nome,
      p_email: usuario.email,
      p_telefone: usuario.telefone,
      p_perfil: usuario.perfil || 'usuario',
    },
    'Erro ao cadastrar usuário.'
  )
}

export async function updateUser(
  id: string,
  updates: Partial<{
    nome: string
    cpf: string
    ativo: boolean
    perfil: 'usuario' | 'admin'
    email: string
    telefone: string
  }>
): Promise<Usuario> {
  const token = requireToken()
  return rpc<Usuario>(
    'admin_atualizar_usuario',
    {
      p_token: token,
      p_id: id,
      p_nome: updates.nome ?? null,
      p_cpf: updates.cpf ?? null,
      p_ativo: updates.ativo ?? null,
      p_perfil: updates.perfil ?? null,
      p_email: updates.email ?? null,
      p_telefone: updates.telefone ?? null,
    },
    'Erro ao atualizar usuário.'
  )
}

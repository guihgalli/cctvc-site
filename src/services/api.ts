import { supabase } from '../lib/supabase'
import type {
  AuthUser,
  CourtScheduleInput,
  FotoQuadra,
  HorarioQuadra,
  Quadra,
  Reserva,
  TipoQuadra,
  TipoSocio,
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
  user: AuthUser
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

/** Após OAuth Google: converte sessão Supabase em token customizado do app */
export async function loginWithGoogleSession(): Promise<LoginResult> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !sessionData.session) {
    throw new Error('Sessão Google não encontrada. Tente novamente.')
  }

  const result = await rpc<LoginResult>('fazer_login_google', {}, 'Erro ao entrar com Google.')

  await supabase.auth.signOut()

  return result
}

export async function startGoogleOAuth(redirectPath = '/auth/callback'): Promise<void> {
  const redirectTo = `${window.location.origin}${redirectPath}`
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  })
  if (error) throw error
}

export async function completePhoneRegistration(telefone: string): Promise<AuthUser> {
  const token = requireToken()
  const result = await rpc<{ ok: boolean; user: AuthUser }>(
    'completar_telefone',
    { p_token: token, p_telefone: telefone },
    'Erro ao salvar telefone.'
  )
  return result.user
}

export async function completeGoogleRegistration(
  cpf: string,
  telefone: string
): Promise<LoginResult> {
  const token = requireToken()
  return rpc<LoginResult>(
    'completar_cadastro_google',
    {
      p_token: token,
      p_cpf: cpf,
      p_telefone: telefone,
    },
    'Erro ao concluir cadastro.'
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

export interface ChangePasswordResult {
  ok: boolean
  token: string
}

/** Usuário logado altera a própria senha (exige sessão válida). Retorna novo token. */
export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<ChangePasswordResult> {
  const token = requireToken()
  const result = await rpc<ChangePasswordResult>(
    'alterar_senha',
    {
      p_token: token,
      p_senha_atual: currentPassword,
      p_senha_nova: newPassword,
    },
    'Erro ao alterar senha.'
  )
  if (!result?.token) {
    throw new Error('Resposta inválida ao alterar senha. Atualize a migration no Supabase.')
  }
  return result
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
  expiracao_pendente_minutos?: number
  valor_visitante?: number | null
  tipo_quadra?: TipoQuadra
}): Promise<Quadra> {
  const token = requireToken()
  return rpc<Quadra>(
    'admin_criar_quadra',
    {
      p_token: token,
      p_nome: quadra.nome,
      p_descricao: quadra.descricao ?? null,
      p_tipo_esporte: quadra.tipo_esporte ?? null,
      p_expiracao_pendente_minutos: quadra.expiracao_pendente_minutos ?? 60,
      p_valor_visitante: quadra.valor_visitante ?? null,
      p_tipo_quadra: quadra.tipo_quadra ?? 'geral',
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
  updates: Partial<{
    nome: string
    descricao: string
    tipo_esporte: string
    ativo: boolean
    expiracao_pendente_minutos: number
    valor_visitante: number | null
    tipo_quadra: TipoQuadra
  }>
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
      p_expiracao_pendente_minutos: updates.expiracao_pendente_minutos ?? null,
      p_valor_visitante: updates.valor_visitante ?? null,
      p_tipo_quadra: updates.tipo_quadra ?? null,
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
  apenasPendentes?: boolean
}): Promise<Reserva[]> {
  const token = requireToken()
  const data = await rpc<Reserva[]>(
    'admin_listar_reservas',
    {
      p_token: token,
      p_quadra_id: filters?.courtId || null,
      p_data: filters?.date || null,
      p_apenas_pendentes: filters?.apenasPendentes ?? false,
    },
    'Erro ao carregar agenda.'
  )
  return data || []
}

export interface ApproveBookingResult {
  ok: boolean
  telefone: string | null
  nome: string
  quadra: string
  reserva: Reserva
}

export async function approveBooking(reservaId: string): Promise<ApproveBookingResult> {
  const token = requireToken()
  return rpc<ApproveBookingResult>(
    'admin_aprovar_reserva',
    { p_token: token, p_reserva_id: reservaId },
    'Erro ao aprovar reserva.'
  )
}

export async function rejectBooking(reservaId: string, motivo?: string): Promise<void> {
  const token = requireToken()
  await rpc(
    'admin_recusar_reserva',
    { p_token: token, p_reserva_id: reservaId, p_motivo: motivo ?? null },
    'Erro ao recusar reserva.'
  )
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
  participantes?: string[]
}): Promise<Reserva> {
  const token = requireToken()
  void reserva.usuario_id
  return rpc<Reserva>(
    'criar_reserva',
    {
      p_token: token,
      p_quadra_id: reserva.quadra_id,
      p_data: reserva.data_reserva,
      p_hora_inicio: reserva.hora_inicio,
      p_hora_fim: reserva.hora_fim,
      p_participantes: reserva.participantes?.length ? reserva.participantes : null,
    },
    'Erro ao fazer reserva.'
  )
}

export async function adminCreateBooking(reserva: {
  usuario_id: string
  quadra_id: string
  data_reserva: string
  hora_inicio: string
  hora_fim: string
  participantes?: string[]
}): Promise<Reserva> {
  const token = requireToken()
  return rpc<Reserva>(
    'admin_criar_reserva',
    {
      p_token: token,
      p_usuario_id: reserva.usuario_id,
      p_quadra_id: reserva.quadra_id,
      p_data: reserva.data_reserva,
      p_hora_inicio: reserva.hora_inicio,
      p_hora_fim: reserva.hora_fim,
      p_participantes: reserva.participantes?.length ? reserva.participantes : null,
    },
    'Erro ao criar reserva administrativa.'
  )
}

export async function searchParticipantesReserva(busca = ''): Promise<
  (Pick<Usuario, 'id' | 'codigo_usuario' | 'nome' | 'categoria_socio' | 'tipo_socio'> & {
    eh_dependente?: boolean
  })[]
> {
  const token = requireToken()
  const data = await rpc<
    (Pick<Usuario, 'id' | 'codigo_usuario' | 'nome' | 'categoria_socio' | 'tipo_socio'> & {
      eh_dependente?: boolean
    })[]
  >(
    'buscar_participantes_reserva',
    { p_token: token, p_busca: busca.trim() || null },
    'Erro ao buscar participantes.'
  )
  return data || []
}

export async function searchSocios(busca: string): Promise<
  Pick<Usuario, 'id' | 'codigo_usuario' | 'nome' | 'categoria_socio' | 'ativo'>[]
> {
  const token = requireToken()
  const data = await rpc<
    Pick<Usuario, 'id' | 'codigo_usuario' | 'nome' | 'categoria_socio' | 'ativo'>[]
  >('buscar_socios', { p_token: token, p_busca: busca }, 'Erro ao buscar sócios.')
  return data || []
}

export async function adminSearchUsers(busca: string): Promise<
  Pick<Usuario, 'id' | 'codigo_usuario' | 'nome' | 'categoria_socio' | 'tipo_socio' | 'ativo'>[]
> {
  const token = requireToken()
  const data = await rpc<
    Pick<Usuario, 'id' | 'codigo_usuario' | 'nome' | 'categoria_socio' | 'tipo_socio' | 'ativo'>[]
  >('admin_buscar_usuarios', { p_token: token, p_busca: busca }, 'Erro ao buscar usuários.')
  return data || []
}

export async function adminResetUserPassword(
  usuarioId: string,
  senhaNova: string
): Promise<void> {
  const token = requireToken()
  await rpc(
    'admin_alterar_senha_usuario',
    { p_token: token, p_usuario_id: usuarioId, p_senha_nova: senhaNova },
    'Erro ao alterar senha do usuário.'
  )
}

export interface LiberacaoQuadra {
  id: string
  quadra_id: string
  data_reserva: string
  hora_inicio: string | null
  quadra_nome?: string
}

export async function adminLiberarQuadraSocio(
  quadraId: string,
  data: string,
  horaInicio?: string | null
): Promise<LiberacaoQuadra> {
  const token = requireToken()
  return rpc<LiberacaoQuadra>(
    'admin_liberar_quadra_socio',
    {
      p_token: token,
      p_quadra_id: quadraId,
      p_data: data,
      p_hora_inicio: horaInicio ?? null,
    },
    'Erro ao liberar quadra para sócios.'
  )
}

export async function adminListarLiberacoes(filters?: {
  quadraId?: string
  date?: string
}): Promise<LiberacaoQuadra[]> {
  const token = requireToken()
  const data = await rpc<LiberacaoQuadra[]>(
    'admin_listar_liberacoes_quadra',
    {
      p_token: token,
      p_quadra_id: filters?.quadraId ?? null,
      p_data: filters?.date ?? null,
    },
    'Erro ao listar liberações.'
  )
  return data || []
}

export async function adminRevogarLiberacao(liberacaoId: string): Promise<void> {
  const token = requireToken()
  await rpc(
    'admin_revogar_liberacao_quadra',
    { p_token: token, p_liberacao_id: liberacaoId },
    'Erro ao revogar liberação.'
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
  tipo_socio?: TipoSocio
  matricula?: number | null
  categoria_clube?: string | null
  data_nascimento?: string | null
  data_admissao?: string | null
  parentesco?: string | null
  sexo?: string | null
  numero_dependente?: number | null
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
      p_tipo_socio: usuario.tipo_socio || 'socio',
      p_matricula: usuario.matricula ?? null,
      p_categoria_clube: usuario.categoria_clube ?? null,
      p_data_nascimento: usuario.data_nascimento || null,
      p_data_admissao: usuario.data_admissao || null,
      p_parentesco: usuario.parentesco ?? null,
      p_sexo: usuario.sexo ?? null,
      p_numero_dependente: usuario.numero_dependente ?? null,
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
    tipo_socio: TipoSocio
    matricula: number | null
    categoria_clube: string | null
    data_nascimento: string | null
    data_admissao: string | null
    parentesco: string | null
    sexo: string | null
    numero_dependente: number | null
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
      p_tipo_socio: updates.tipo_socio ?? null,
      p_matricula: updates.matricula ?? null,
      p_categoria_clube: updates.categoria_clube ?? null,
      p_data_nascimento: updates.data_nascimento ?? null,
      p_data_admissao: updates.data_admissao ?? null,
      p_parentesco: updates.parentesco ?? null,
      p_sexo: updates.sexo ?? null,
      p_numero_dependente: updates.numero_dependente ?? null,
    },
    'Erro ao atualizar usuário.'
  )
}

export async function deleteUser(id: string): Promise<void> {
  const token = requireToken()
  await rpc('admin_excluir_usuario', { p_token: token, p_id: id }, 'Erro ao excluir usuário.')
}

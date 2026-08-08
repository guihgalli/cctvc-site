import { supabase } from '../lib/supabase'
import type { Quadra, Reserva, Usuario, FotoQuadra } from '../types'

export async function fetchCourts(): Promise<Quadra[]> {
  const { data, error } = await supabase
    .from('quadras')
    .select('*, fotos_quadras(*)')
    .eq('ativo', true)
    .order('nome')

  if (error) throw error
  return data || []
}

export async function fetchAllCourts(): Promise<Quadra[]> {
  const { data, error } = await supabase
    .from('quadras')
    .select('*, fotos_quadras(*)')
    .order('nome')

  if (error) throw error
  return data || []
}

export async function createCourt(quadra: {
  nome: string
  descricao?: string
  tipo_esporte?: string
}): Promise<Quadra> {
  const { data, error } = await supabase
    .from('quadras')
    .insert(quadra)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateCourt(
  id: string,
  updates: Partial<{ nome: string; descricao: string; tipo_esporte: string; ativo: boolean }>
): Promise<Quadra> {
  const { data, error } = await supabase
    .from('quadras')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteCourt(id: string): Promise<void> {
  const { error } = await supabase.from('quadras').delete().eq('id', id)

  if (error) throw error
}

export async function uploadCourtPhoto(
  quadraId: string,
  file: File,
  principal = false
): Promise<FotoQuadra> {
  const ext = file.name.split('.').pop()
  const fileName = `${quadraId}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('fotos-quadras')
    .upload(fileName, file)

  if (uploadError) throw uploadError

  const { data: urlData } = supabase.storage.from('fotos-quadras').getPublicUrl(fileName)

  const { data, error } = await supabase
    .from('fotos_quadras')
    .insert({ quadra_id: quadraId, url: urlData.publicUrl, principal })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function fetchBookingsByCourtAndDate(
  quadraId: string,
  date: string
): Promise<Reserva[]> {
  const { data, error } = await supabase
    .from('reservas')
    .select('*, usuarios(nome, codigo_usuario)')
    .eq('quadra_id', quadraId)
    .eq('data_reserva', date)
    .eq('status', 'confirmada')

  if (error) throw error
  return data || []
}

export async function fetchAllBookings(
  filters?: { courtId?: string; date?: string }
): Promise<Reserva[]> {
  let query = supabase
    .from('reservas')
    .select('*, quadras(nome), usuarios(nome, codigo_usuario)')
    .eq('status', 'confirmada')
    .order('data_reserva')
    .order('hora_inicio')

  if (filters?.courtId) query = query.eq('quadra_id', filters.courtId)
  if (filters?.date) query = query.eq('data_reserva', filters.date)

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function fetchUserBookings(usuarioId: string): Promise<Reserva[]> {
  const { data, error } = await supabase
    .from('reservas')
    .select('*, quadras(nome, tipo_esporte)')
    .eq('usuario_id', usuarioId)
    .eq('status', 'confirmada')
    .gte('data_reserva', new Date().toISOString().split('T')[0])
    .order('data_reserva')
    .order('hora_inicio')

  if (error) throw error
  return data || []
}

export async function createBooking(reserva: {
  quadra_id: string
  usuario_id: string
  data_reserva: string
  hora_inicio: string
  hora_fim: string
}): Promise<Reserva> {
  const { data, error } = await supabase
    .from('reservas')
    .insert(reserva)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('Este horário já está reservado para esta quadra.')
    }
    throw error
  }
  return data
}

export async function cancelBooking(id: string): Promise<void> {
  const { error } = await supabase
    .from('reservas')
    .update({ status: 'cancelada' })
    .eq('id', id)

  if (error) throw error
}

export async function fetchUsers(): Promise<Usuario[]> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .order('nome')

  if (error) throw error
  return data || []
}

export async function createUser(usuario: {
  codigo_usuario: string
  cpf: string
  nome: string
  perfil?: 'usuario' | 'admin'
}): Promise<Usuario> {
  const { data, error } = await supabase.from('usuarios').insert(usuario).select().single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('Código de usuário já cadastrado.')
    }
    throw error
  }
  return data
}

export async function updateUser(
  id: string,
  updates: Partial<{ nome: string; cpf: string; ativo: boolean; perfil: 'usuario' | 'admin' }>
): Promise<Usuario> {
  const { data, error } = await supabase
    .from('usuarios')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

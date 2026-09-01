import type { CategoriaSocio, PerfilUsuario, TipoSocio, Usuario } from '../types'

export type UsuarioSortCol = 'codigo' | 'nome' | 'status'
export type UsuarioSortDir = 'asc' | 'desc'
export type UsuarioSort = { col: UsuarioSortCol; dir: UsuarioSortDir }

export type FiltroTipoSocio = '' | TipoSocio
export type FiltroCategoria = '' | CategoriaSocio
export type FiltroPerfil = '' | PerfilUsuario
export type FiltroAtivo = '' | 'ativo' | 'inativo'

export interface FiltrosUsuario {
  busca: string
  tipoSocio: FiltroTipoSocio
  categoria: FiltroCategoria
  perfil: FiltroPerfil
  ativo: FiltroAtivo
}

export const FILTROS_USUARIO_VAZIOS: FiltrosUsuario = {
  busca: '',
  tipoSocio: '',
  categoria: '',
  perfil: '',
  ativo: '',
}

export const ITENS_POR_PAGINA_OPCOES = [100, 500, 1000] as const
export type ItensPorPagina = (typeof ITENS_POR_PAGINA_OPCOES)[number]

export function filtrarUsuarios(usuarios: Usuario[], filtros: FiltrosUsuario): Usuario[] {
  const q = filtros.busca.trim().toLowerCase()
  const digits = filtros.busca.replace(/\D/g, '')

  return usuarios.filter((u) => {
    if (filtros.tipoSocio && u.tipo_socio !== filtros.tipoSocio) return false
    if (filtros.categoria && u.categoria_socio !== filtros.categoria) return false
    if (filtros.perfil && u.perfil !== filtros.perfil) return false
    if (filtros.ativo === 'ativo' && !u.ativo) return false
    if (filtros.ativo === 'inativo' && u.ativo) return false

    if (!q && !digits) return true

    const nomeMatch = u.nome.toLowerCase().includes(q)
    const emailMatch = u.email?.toLowerCase().includes(q) ?? false
    const codigoMatch =
      (digits && u.codigo_usuario?.includes(digits)) ||
      (q && (u.codigo_usuario?.includes(q) ?? false))
    const cpfMatch = digits.length > 0 && (u.cpf?.includes(digits) ?? false)
    const telMatch = digits.length > 0 && (u.telefone?.includes(digits) ?? false)

    const matriculaMatch =
      u.matricula != null && digits && String(u.matricula).includes(digits)
    const parentescoMatch = u.parentesco?.toLowerCase().includes(q) ?? false
    const categoriaMatch = u.categoria_clube?.toLowerCase().includes(q) ?? false

    return (
      nomeMatch ||
      emailMatch ||
      codigoMatch ||
      cpfMatch ||
      telMatch ||
      matriculaMatch ||
      parentescoMatch ||
      categoriaMatch
    )
  })
}

export function ordenarUsuarios(usuarios: Usuario[], sort: UsuarioSort): Usuario[] {
  const dir = sort.dir === 'asc' ? 1 : -1
  return [...usuarios].sort((a, b) => {
    switch (sort.col) {
      case 'codigo':
        return dir * (a.codigo_usuario ?? '').localeCompare(b.codigo_usuario ?? '', undefined, {
          numeric: true,
        })
      case 'nome':
        return dir * a.nome.localeCompare(b.nome, 'pt-BR')
      case 'status':
        return dir * (Number(a.ativo) - Number(b.ativo))
      default:
        return 0
    }
  })
}

export function paginarUsuarios<T>(items: T[], pagina: number, porPagina: number): T[] {
  const inicio = (pagina - 1) * porPagina
  return items.slice(inicio, inicio + porPagina)
}

export function totalPaginas(total: number, porPagina: number): number {
  return Math.max(1, Math.ceil(total / porPagina))
}

export function contarUsuariosPendentes(usuarios: Usuario[]): number {
  return usuarios.filter((u) => u.tipo_socio === 'nao_socio' && !u.ativo).length
}

export function temFiltrosUsuariosAtivos(filtros: FiltrosUsuario): boolean {
  return (
    filtros.busca.trim() !== '' ||
    filtros.tipoSocio !== '' ||
    filtros.categoria !== '' ||
    filtros.perfil !== '' ||
    filtros.ativo !== ''
  )
}

export function proximaOrdenacao(
  atual: UsuarioSort,
  col: UsuarioSortCol
): UsuarioSort {
  if (atual.col === col) {
    return { col, dir: atual.dir === 'asc' ? 'desc' : 'asc' }
  }
  return { col, dir: 'asc' }
}

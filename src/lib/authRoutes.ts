import type { AuthUser } from '../types'

const SKIP_REDIRECT_PATHS = ['/login', '/auth/callback']

/** Destino após login ou conclusão de cadastro */
export function getPostLoginPath(user: AuthUser, from?: string): string {
  if (user.precisa_cadastro) return '/conta?cadastro=google'
  if (user.precisa_telefone) return '/conta?cadastro=telefone'
  if (user.perfil === 'admin') return '/admin'
  if (from && !SKIP_REDIRECT_PATHS.includes(from)) return from
  return '/reservas'
}

export type AdminTab = 'reservas' | 'agenda' | 'usuarios' | 'quadras' | 'guias'

export const ADMIN_TABS: AdminTab[] = ['reservas', 'agenda', 'usuarios', 'quadras', 'guias']

export function parseAdminTab(param?: string): AdminTab | null {
  if (!param) return null
  if (ADMIN_TABS.includes(param as AdminTab)) return param as AdminTab
  return null
}

export function adminTabPath(tab: AdminTab): string {
  return tab === 'reservas' ? '/admin' : `/admin/${tab}`
}

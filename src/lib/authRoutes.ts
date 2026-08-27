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

export type AdminTab = 'quadras' | 'agenda' | 'usuarios' | 'guias'

export const ADMIN_TABS: AdminTab[] = ['quadras', 'agenda', 'usuarios', 'guias']

export function parseAdminTab(param?: string): AdminTab | null {
  if (param && ADMIN_TABS.includes(param as AdminTab)) return param as AdminTab
  return null
}

export function adminTabPath(tab: AdminTab): string {
  return tab === 'quadras' ? '/admin' : `/admin/${tab}`
}

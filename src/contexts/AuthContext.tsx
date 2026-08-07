import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { cpfToPassword } from '../lib/utils'
import type { AuthUser } from '../types'

const STORAGE_KEY = 'cctvc_auth'

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  login: (userCode: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

function loadStoredUser(): AuthUser | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(loadStoredUser)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [user])

  const login = useCallback(async (userCode: string, password: string) => {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Sistema não configurado. Contate o administrador.' }
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, codigo_usuario, cpf, nome, perfil, ativo')
        .eq('codigo_usuario', userCode)
        .single()

      if (error || !data) {
        return { success: false, error: 'Usuário ou senha inválidos' }
      }

      if (!data.ativo) {
        return { success: false, error: 'Usuário desativado. Contate o administrador.' }
      }

      const expectedPassword = cpfToPassword(data.cpf)
      if (password !== expectedPassword) {
        return { success: false, error: 'Usuário ou senha inválidos' }
      }

      const authUser: AuthUser = {
        id: data.id,
        codigo_usuario: data.codigo_usuario,
        nome: data.nome,
        perfil: data.perfil,
      }

      setUser(authUser)
      return { success: true }
    } catch {
      return { success: false, error: 'Erro ao conectar. Tente novamente.' }
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAdmin: user?.perfil === 'admin',
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider')
  }
  return context
}

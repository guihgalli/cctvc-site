import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { isSupabaseConfigured } from '../lib/supabase'
import {
  fetchSession,
  loginWithCredentials,
  loginWithGoogleSession,
  logoutSession,
  setSessionToken,
  startGoogleOAuth,
} from '../services/api'
import type { AuthUser } from '../types'

const STORAGE_KEY = 'cctvc_auth'
const TOKEN_KEY = 'cctvc_session'

interface StoredAuth {
  token: string
  user: AuthUser
}

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  login: (userCode: string, password: string) => Promise<{ success: boolean; error?: string; user?: AuthUser }>
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>
  finalizeGoogleLogin: () => Promise<{ success: boolean; error?: string }>
  logout: () => void
  updateSessionToken: (token: string) => void
  updateUser: (user: AuthUser) => void
  isAdmin: boolean
  isSocio: boolean
  isTitular: boolean
  isDependente: boolean
  canBook: boolean
  isInadimplente: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

function loadStoredAuth(): StoredAuth | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY)
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!token || !stored) return null
    const user = JSON.parse(stored) as AuthUser
    if (!user?.id || !user?.perfil) return null
    return { token, user }
  } catch {
    return null
  }
}

function persistAuth(auth: StoredAuth | null) {
  if (auth) {
    localStorage.setItem(TOKEN_KEY, auth.token)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(auth.user))
    setSessionToken(auth.token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(STORAGE_KEY)
    setSessionToken(null)
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const initial = loadStoredAuth()
  const [user, setUser] = useState<AuthUser | null>(initial?.user ?? null)
  const [loading, setLoading] = useState(Boolean(initial?.token))

  useEffect(() => {
    if (initial?.token) {
      setSessionToken(initial.token)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function validateSession() {
      const stored = loadStoredAuth()
      if (!stored) {
        setLoading(false)
        return
      }

      if (!isSupabaseConfigured) {
        persistAuth(null)
        setUser(null)
        setLoading(false)
        return
      }

      try {
        const session = await fetchSession(stored.token)
        if (cancelled) return
        persistAuth({ token: session.token, user: session.user })
        setUser(session.user)
      } catch {
        if (cancelled) return
        persistAuth(null)
        setUser(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void validateSession()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (userCode: string, password: string) => {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Sistema não configurado. Contate o administrador.' }
    }

    setLoading(true)
    try {
      const result = await loginWithCredentials(userCode, password)
      persistAuth({ token: result.token, user: result.user })
      setUser(result.user)
      return { success: true, user: result.user }
    } catch (err) {
      const message =
        err instanceof Error && err.message ? err.message : 'Usuário ou senha inválidos'
      return { success: false, error: message }
    } finally {
      setLoading(false)
    }
  }, [])

  const loginWithGoogle = useCallback(async () => {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Sistema não configurado. Contate o administrador.' }
    }

    try {
      await startGoogleOAuth()
      return { success: true }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Erro ao iniciar login com Google.',
      }
    }
  }, [])

  const finalizeGoogleLogin = useCallback(async () => {
    setLoading(true)
    try {
      const result = await loginWithGoogleSession()
      persistAuth({ token: result.token, user: result.user })
      setUser(result.user)
      return { success: true }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Erro ao concluir login com Google.',
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) {
      void logoutSession(token)
    }
    persistAuth(null)
    setUser(null)
  }, [])

  const updateSessionToken = useCallback((token: string) => {
    const current = loadStoredAuth()
    if (!current?.user) {
      persistAuth(null)
      setUser(null)
      return
    }
    persistAuth({ token, user: current.user })
  }, [])

  const updateUser = useCallback((next: AuthUser) => {
    const current = loadStoredAuth()
    if (!current) return
    persistAuth({ token: current.token, user: next })
    setUser(next)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        loginWithGoogle,
        finalizeGoogleLogin,
        logout,
        updateSessionToken,
        updateUser,
        isAdmin: user?.perfil === 'admin',
        isSocio: user?.tipo_socio !== 'nao_socio',
        isTitular: user?.categoria_socio === 'titular',
        isDependente: user?.categoria_socio === 'dependente',
        isInadimplente: Boolean(user?.inadimplente),
        canBook:
          user?.perfil === 'admin' ||
          (user?.tipo_socio === 'socio' && !user?.inadimplente) ||
          user?.tipo_socio === 'nao_socio',
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

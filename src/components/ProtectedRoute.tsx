import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import type { ReactNode } from 'react'

interface ProtectedRouteProps {
  children: ReactNode
  adminOnly?: boolean
}

export function ProtectedRoute({ children, adminOnly = false }: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-stone-500 text-sm">
        Verificando sessão...
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (adminOnly && user.perfil !== 'admin') {
    return <Navigate to="/reservas" replace />
  }

  if (user.precisa_cadastro && location.pathname !== '/conta') {
    return <Navigate to="/conta?cadastro=google" replace />
  }

  if (user.precisa_telefone && location.pathname !== '/conta') {
    return <Navigate to="/conta?cadastro=telefone" replace />
  }

  return <>{children}</>
}

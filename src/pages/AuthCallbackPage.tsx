import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Logo } from '../components/Logo'
import { useAuth } from '../contexts/AuthContext'

export function AuthCallbackPage() {
  const { finalizeGoogleLogin, user, loading } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function handleCallback() {
      const result = await finalizeGoogleLogin()
      if (cancelled) return

      if (!result.success) {
        setError(result.error || 'Não foi possível entrar com Google.')
        return
      }
    }

    void handleCallback()
    return () => {
      cancelled = true
    }
  }, [finalizeGoogleLogin])

  useEffect(() => {
    if (loading || error) return
    if (!user) return

    if (user.precisa_telefone) {
      navigate('/conta?cadastro=telefone', { replace: true })
      return
    }

    navigate(user.perfil === 'admin' ? '/admin' : '/reservas', { replace: true })
  }, [user, loading, error, navigate])

  return (
    <Layout>
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <Logo size="md" className="mx-auto mb-6" />
        {error ? (
          <>
            <p className="text-red-700 mb-4">{error}</p>
            <a href="/login" className="text-emerald-700 font-medium hover:underline">
              Voltar ao login
            </a>
          </>
        ) : (
          <p className="text-emerald-800">Concluindo login com Google...</p>
        )}
      </div>
    </Layout>
  )
}

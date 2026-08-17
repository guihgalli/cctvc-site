import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Logo } from '../components/Logo'
import { FeedbackMessage } from '../components/motion/FeedbackMessage'
import { useAuth } from '../contexts/AuthContext'
import { getPostLoginPath } from '../lib/authRoutes'

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

    if (user.precisa_cadastro) {
      navigate('/conta?cadastro=google', { replace: true })
      return
    }

    if (user.precisa_telefone) {
      navigate('/conta?cadastro=telefone', { replace: true })
      return
    }

    navigate(getPostLoginPath(user), { replace: true })
  }, [user, loading, error, navigate])

  return (
    <Layout>
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <Logo size="md" className="mx-auto mb-6 home-fade-up" />
        {error ? (
          <div className="space-y-4 motion-page-enter">
            <FeedbackMessage type="error">{error}</FeedbackMessage>
            <a href="/login" className="inline-block text-emerald-700 font-medium hover:underline motion-cta">
              Voltar ao login
            </a>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 motion-page-enter" aria-busy="true">
            <div className="motion-spinner motion-spinner--lg" aria-hidden="true" />
            <p className="text-emerald-800">Concluindo login com Google...</p>
          </div>
        )}
      </div>
    </Layout>
  )
}

import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Logo } from '../components/Logo'
import { FeedbackMessage } from '../components/motion/FeedbackMessage'
import { Button } from '../components/motion/Button'
import { PageLoadingSkeleton } from '../components/motion/Skeleton'
import { useAuth } from '../contexts/AuthContext'
import { isValidUserCode, isValidPassword } from '../lib/utils'
import { getPostLoginPath } from '../lib/authRoutes'

const benefits = [
  {
    title: 'Reserve quadras online',
    description: 'Beach Tennis, vôlei, Futebol Society — escolha horário e confirme em segundos.',
    icon: CalendarIcon,
  },
  {
    title: 'Acompanhe suas reservas',
    description: 'Veja pendências, confirmações e histórico direto na sua conta.',
    icon: ListIcon,
  },
  {
    title: 'Acesso exclusivo para sócios',
    description: 'Entre com matrícula ou Google e use os serviços digitais do clube.',
    icon: ShieldIcon,
  },
]

export function LoginPage() {
  const [userCode, setUserCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { login, loginWithGoogle, loading, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/reservas'

  useEffect(() => {
    if (!loading && user) {
      navigate(getPostLoginPath(user), { replace: true })
    }
  }, [user, loading, navigate])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!isValidUserCode(userCode)) {
      setError('Matrícula deve ter 4 dígitos (ex.: 1660 titular, 1661 dependente).')
      return
    }

    if (!isValidPassword(password)) {
      setError('Senha deve ter 6 dígitos.')
      return
    }

    const result = await login(userCode, password)
    if (result.success && result.user) {
      navigate(getPostLoginPath(result.user, from), { replace: true })
    } else if (result.success) {
      navigate(from, { replace: true })
    } else {
      setError(result.error || 'Erro ao fazer login.')
    }
  }

  async function handleGoogleLogin() {
    setError('')
    const result = await loginWithGoogle()
    if (!result.success) {
      setError(result.error || 'Erro ao iniciar login com Google.')
    }
  }

  if (loading && !user) {
    return (
      <Layout showHeader={false}>
        <PageLoadingSkeleton />
      </Layout>
    )
  }

  return (
    <Layout showHeader={false}>
      <div className="login-page">
        <div className="login-page__grid">
          <aside className="login-page__brand" aria-label="Sobre o acesso ao CCTVC">
            <div className="login-page__brand-pattern" aria-hidden="true" />
            <div className="relative max-w-lg mx-auto lg:mx-0 w-full">
              <Link
                to="/"
                className="inline-flex items-center gap-2 text-emerald-200/90 text-sm hover:text-white transition-colors mb-8 home-fade-up"
              >
                <ArrowLeftIcon />
                Voltar ao site
              </Link>

              <Logo size="md" className="mb-5 drop-shadow-lg home-fade-up home-fade-up--delay-1" />
              <p className="font-display text-emerald-100/90 text-xs tracking-[0.28em] uppercase mb-3 home-fade-up home-fade-up--delay-1">
                Área do associado
              </p>
              <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight mb-4 home-fade-up home-fade-up--delay-2">
                Entre e reserve sua quadra
              </h1>
              <p className="text-emerald-100/90 leading-relaxed mb-8 home-fade-up home-fade-up--delay-3">
                Acesse com matrícula e senha de sócio ou com Google para gerenciar reservas e sua conta no clube.
              </p>

              <ul className="space-y-3 home-fade-up home-fade-up--delay-4">
                {benefits.map(({ title, description, icon: Icon }) => (
                  <li key={title} className="login-page__benefit">
                    <span className="login-page__benefit-icon" aria-hidden="true">
                      <Icon />
                    </span>
                    <div>
                      <p className="font-medium text-emerald-50">{title}</p>
                      <p className="text-sm text-emerald-200/85 mt-0.5 leading-relaxed">{description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <div className="login-page__panel">
            <div className="login-page__card motion-card shadow-lg motion-page-enter">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-emerald-900">Entrar</h2>
                <p className="text-stone-500 text-sm mt-1">Use sua matrícula e senha de sócio</p>
              </div>

              {error && (
                <FeedbackMessage type="error" className="mb-4">
                  {error}
                </FeedbackMessage>
              )}

              <form onSubmit={handleSubmit} className="space-y-4 motion-tab-panel">
                <div>
                  <label htmlFor="userCode" className="block text-sm font-medium text-stone-700 mb-1.5">
                    Matrícula
                  </label>
                  <input
                    id="userCode"
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={userCode}
                    onChange={(e) => {
                      setUserCode(e.target.value.replace(/\D/g, '').slice(0, 4))
                      if (error) setError('')
                    }}
                    className="login-page__field"
                    placeholder="0000"
                    autoComplete="username"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-stone-700 mb-1.5">
                    Senha
                  </label>
                  <input
                    id="password"
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value.replace(/\D/g, '').slice(0, 6))
                      if (error) setError('')
                    }}
                    className="login-page__field"
                    placeholder="••••••"
                    autoComplete="current-password"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full"
                  loading={loading}
                  loadingText="Entrando..."
                >
                  Entrar com matrícula
                </Button>

                <div className="login-page__divider pt-2">ou</div>

                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="w-full border-stone-300"
                  onClick={handleGoogleLogin}
                  loading={loading}
                  loadingText="Conectando..."
                >
                  <GoogleIcon />
                  Continuar com Google
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
    </svg>
  )
}

function ListIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

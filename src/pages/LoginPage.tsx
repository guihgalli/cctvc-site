import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { Logo } from '../components/Logo'
import { SolicitarLoginModal } from '../components/SolicitarLoginModal'
import { useAuth } from '../contexts/AuthContext'
import { isValidUserCode, isValidPassword } from '../lib/utils'

export function LoginPage() {
  const [userCode, setUserCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [solicitarLoginOpen, setSolicitarLoginOpen] = useState(false)
  const { login, loginWithGoogle, loading, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/reservas'

  useEffect(() => {
    if (!loading && user) {
      navigate(user.perfil === 'admin' ? '/admin' : '/reservas', { replace: true })
    }
  }, [user, loading, navigate])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!isValidUserCode(userCode)) {
      setError('Matrícula deve ter 6 dígitos.')
      return
    }

    if (!isValidPassword(password)) {
      setError('Senha deve ter 3 dígitos.')
      return
    }

    const result = await login(userCode, password)
    if (result.success) {
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

  return (
    <Layout>
      <div className="max-w-sm mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-6">
            <Logo size="md" className="mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-emerald-900">Entrar</h1>
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200 mb-4">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 border border-stone-300 bg-white hover:bg-stone-50 disabled:opacity-50 text-stone-700 font-semibold py-3 rounded-lg transition-colors"
          >
            <GoogleIcon />
            Continuar com Google
          </button>

          <details className="mt-6 group">
            <summary className="cursor-pointer list-none text-center text-sm text-emerald-700 hover:underline marker:content-none">
              <span className="inline-flex items-center gap-1">
                Sou sócio — entrar com matrícula
                <ChevronIcon />
              </span>
            </summary>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3 pt-4 border-t border-stone-100">
              <input
                id="userCode"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={userCode}
                onChange={(e) => setUserCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full border border-stone-300 rounded-lg px-4 py-3 text-center text-lg tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Matrícula (6 dígitos)"
                autoComplete="username"
              />
              <input
                id="password"
                type="password"
                inputMode="numeric"
                maxLength={3}
                value={password}
                onChange={(e) => setPassword(e.target.value.replace(/\D/g, '').slice(0, 3))}
                className="w-full border border-stone-300 rounded-lg px-4 py-3 text-center text-lg tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Senha (3 dígitos)"
                autoComplete="current-password"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
          </details>

          <div className="mt-6 flex flex-col items-center gap-2 text-sm">
            <button
              type="button"
              onClick={() => setSolicitarLoginOpen(true)}
              className="text-emerald-700 hover:underline"
            >
              Solicitar cadastro ao clube
            </button>
            <Link to="/" className="text-stone-500 hover:underline">
              Voltar ao início
            </Link>
          </div>
        </div>
      </div>

      <SolicitarLoginModal open={solicitarLoginOpen} onClose={() => setSolicitarLoginOpen(false)} />
    </Layout>
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

function ChevronIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="transition-transform group-open:rotate-180"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

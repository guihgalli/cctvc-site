import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'
import { isValidUserCode, isValidPassword } from '../lib/utils'

export function LoginPage() {
  const [userCode, setUserCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { login, loading, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/reservas'

  useEffect(() => {
    if (user) {
      navigate(user.perfil === 'admin' ? '/admin' : '/reservas', { replace: true })
    }
  }, [user, navigate])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!isValidUserCode(userCode)) {
      setError('O usuário deve ter exatamente 6 dígitos numéricos.')
      return
    }

    if (!isValidPassword(password)) {
      setError('A senha deve ter exatamente 3 dígitos numéricos.')
      return
    }

    const result = await login(userCode, password)
    if (result.success) {
      navigate(from, { replace: true })
    } else {
      setError(result.error || 'Erro ao fazer login.')
    }
  }

  return (
    <Layout>
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-emerald-800 font-bold">CCTVC</span>
            </div>
            <h1 className="text-2xl font-bold text-emerald-900">Entrar</h1>
            <p className="text-stone-500 text-sm mt-1">Acesso para sócios do clube</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="userCode" className="block text-sm font-medium text-stone-700 mb-1">
                Usuário (6 dígitos)
              </label>
              <input
                id="userCode"
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={userCode}
                onChange={(e) => setUserCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full border border-stone-300 rounded-lg px-4 py-3 text-center text-2xl tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="000000"
                required
                autoComplete="username"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-stone-700 mb-1">
                Senha (3 dígitos do CPF)
              </label>
              <input
                id="password"
                type="password"
                inputMode="numeric"
                pattern="\d{3}"
                maxLength={3}
                value={password}
                onChange={(e) => setPassword(e.target.value.replace(/\D/g, '').slice(0, 3))}
                className="w-full border border-stone-300 rounded-lg px-4 py-3 text-center text-2xl tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="•••"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="text-center text-stone-400 text-xs mt-6">
            A senha corresponde aos 3 primeiros dígitos do seu CPF cadastrado.
            <br />
            Problemas? Contate a secretaria do clube.
          </p>

          <p className="text-center mt-4">
            <Link to="/" className="text-emerald-700 text-sm hover:underline">
              ← Voltar ao início
            </Link>
          </p>
        </div>
      </div>
    </Layout>
  )
}

import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'
import { changePassword } from '../services/api'
import { getErrorMessage, isValidPassword } from '../lib/utils'

export function AccountPage() {
  const { user, updateSessionToken } = useAuth()
  const [senhaAtual, setSenhaAtual] = useState('')
  const [senhaNova, setSenhaNova] = useState('')
  const [senhaNovaConfirm, setSenhaNovaConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!isValidPassword(senhaAtual) || !isValidPassword(senhaNova)) {
      setError('A senha deve ter exatamente 3 dígitos numéricos.')
      return
    }

    if (senhaNova !== senhaNovaConfirm) {
      setError('A confirmação da nova senha não confere.')
      return
    }

    if (senhaAtual === senhaNova) {
      setError('A nova senha deve ser diferente da senha atual.')
      return
    }

    setSaving(true)
    try {
      const result = await changePassword(senhaAtual, senhaNova)
      updateSessionToken(result.token)
      setSuccess('Senha alterada com sucesso!')
      setSenhaAtual('')
      setSenhaNova('')
      setSenhaNovaConfirm('')
    } catch (err) {
      setError(getErrorMessage(err, 'Erro ao alterar senha.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-md mx-auto px-4 py-10">
        <div className="mb-6">
          <Link to="/reservas" className="text-emerald-700 text-sm hover:underline">
            ← Voltar às reservas
          </Link>
          <h1 className="text-2xl font-bold text-emerald-900 mt-3">Minha conta</h1>
          {user && (
            <p className="text-stone-500 text-sm mt-1">
              {user.nome} · código {user.codigo_usuario}
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-emerald-900 mb-1">Alterar senha</h2>
          <p className="text-stone-500 text-sm mb-6">
            A senha tem exatamente 3 dígitos numéricos. No primeiro acesso, use os 3 primeiros
            dígitos do CPF.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="senhaAtual" className="block text-sm font-medium text-stone-700 mb-1">
                Senha atual
              </label>
              <input
                id="senhaAtual"
                type="password"
                inputMode="numeric"
                pattern="\d{3}"
                maxLength={3}
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value.replace(/\D/g, '').slice(0, 3))}
                className="w-full border border-stone-300 rounded-lg px-4 py-3 text-center text-2xl tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="•••"
                required
                autoComplete="current-password"
              />
            </div>

            <div>
              <label htmlFor="senhaNova" className="block text-sm font-medium text-stone-700 mb-1">
                Nova senha
              </label>
              <input
                id="senhaNova"
                type="password"
                inputMode="numeric"
                pattern="\d{3}"
                maxLength={3}
                value={senhaNova}
                onChange={(e) => setSenhaNova(e.target.value.replace(/\D/g, '').slice(0, 3))}
                className="w-full border border-stone-300 rounded-lg px-4 py-3 text-center text-2xl tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="•••"
                required
                autoComplete="new-password"
              />
            </div>

            <div>
              <label
                htmlFor="senhaNovaConfirm"
                className="block text-sm font-medium text-stone-700 mb-1"
              >
                Confirmar nova senha
              </label>
              <input
                id="senhaNovaConfirm"
                type="password"
                inputMode="numeric"
                pattern="\d{3}"
                maxLength={3}
                value={senhaNovaConfirm}
                onChange={(e) =>
                  setSenhaNovaConfirm(e.target.value.replace(/\D/g, '').slice(0, 3))
                }
                className="w-full border border-stone-300 rounded-lg px-4 py-3 text-center text-2xl tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="•••"
                required
                autoComplete="new-password"
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-emerald-50 text-emerald-800 text-sm px-4 py-3 rounded-lg border border-emerald-200">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              {saving ? 'Salvando...' : 'Salvar nova senha'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  )
}

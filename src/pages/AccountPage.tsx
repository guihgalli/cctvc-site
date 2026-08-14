import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'
import { changePassword, completePhoneRegistration } from '../services/api'
import {
  getErrorMessage,
  isValidPassword,
  isValidPhone,
  maskPhoneInput,
  cleanPhone,
  formatPhone,
} from '../lib/utils'

export function AccountPage() {
  const { user, updateSessionToken, updateUser } = useAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const cadastroTelefone = searchParams.get('cadastro') === 'telefone'

  const [telefone, setTelefone] = useState('')
  const [senhaAtual, setSenhaAtual] = useState('')
  const [senhaNova, setSenhaNova] = useState('')
  const [senhaNovaConfirm, setSenhaNovaConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)

  const isVisitante = user?.tipo_socio === 'nao_socio'
  const precisaTelefone = user?.precisa_telefone

  async function handleTelefone(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!isValidPhone(cleanPhone(telefone))) {
      setError('Informe um WhatsApp válido com DDD (10 ou 11 dígitos).')
      return
    }

    setSaving(true)
    try {
      const updated = await completePhoneRegistration(cleanPhone(telefone))
      updateUser(updated)
      setSuccess('WhatsApp cadastrado! Agora você pode solicitar reservas.')
      setTelefone('')
      if (cadastroTelefone) {
        setTimeout(() => navigate('/reservas', { replace: true }), 1200)
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Erro ao salvar telefone.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleSenha(e: FormEvent) {
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
      <div className="max-w-md mx-auto px-4 py-10 space-y-6">
        <div>
          <Link to="/reservas" className="text-emerald-700 text-sm hover:underline">
            ← Voltar às reservas
          </Link>
          <h1 className="text-2xl font-bold text-emerald-900 mt-3">Minha conta</h1>
          {user && (
            <p className="text-stone-500 text-sm mt-1">
              {user.nome}
              {user.codigo_usuario ? ` · matrícula ${user.codigo_usuario}` : ''}
              {isVisitante ? ' · visitante' : ' · sócio'}
            </p>
          )}
        </div>

        {(precisaTelefone || cadastroTelefone) && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
            Cadastre seu WhatsApp para receber a confirmação das reservas e concluir solicitações.
          </div>
        )}

        {(isVisitante || precisaTelefone) && (
          <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-emerald-900 mb-1">WhatsApp</h2>
            <p className="text-stone-500 text-sm mb-4">
              Usado para confirmar reservas após o pagamento.
              {user?.telefone && (
                <>
                  {' '}
                  Atual: <strong>{formatPhone(user.telefone)}</strong>
                </>
              )}
            </p>
            <form onSubmit={handleTelefone} className="space-y-4">
              <input
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(maskPhoneInput(e.target.value))}
                placeholder="(47) 99999-9999"
                inputMode="numeric"
                required
                className="w-full border border-stone-300 rounded-lg px-4 py-3 font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold py-3 rounded-lg"
              >
                {saving ? 'Salvando...' : 'Salvar WhatsApp'}
              </button>
            </form>
          </div>
        )}

        {!isVisitante && (
          <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-emerald-900 mb-1">Alterar senha</h2>
            <p className="text-stone-500 text-sm mb-6">
              A senha tem exatamente 3 dígitos numéricos.
            </p>
            <form onSubmit={handleSenha} className="space-y-4">
              <input
                type="password"
                inputMode="numeric"
                maxLength={3}
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value.replace(/\D/g, '').slice(0, 3))}
                placeholder="Senha atual"
                required
                className="w-full border rounded-lg px-4 py-3 text-center text-xl font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <input
                type="password"
                inputMode="numeric"
                maxLength={3}
                value={senhaNova}
                onChange={(e) => setSenhaNova(e.target.value.replace(/\D/g, '').slice(0, 3))}
                placeholder="Nova senha"
                required
                className="w-full border rounded-lg px-4 py-3 text-center text-xl font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <input
                type="password"
                inputMode="numeric"
                maxLength={3}
                value={senhaNovaConfirm}
                onChange={(e) => setSenhaNovaConfirm(e.target.value.replace(/\D/g, '').slice(0, 3))}
                placeholder="Confirmar nova senha"
                required
                className="w-full border rounded-lg px-4 py-3 text-center text-xl font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold py-3 rounded-lg"
              >
                {saving ? 'Salvando...' : 'Salvar nova senha'}
              </button>
            </form>
          </div>
        )}

        {(error || success) && (
          <div
            className={`text-sm px-4 py-3 rounded-lg border ${
              error
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}
          >
            {error || success}
          </div>
        )}
      </div>
    </Layout>
  )
}

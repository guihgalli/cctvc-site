import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'
import { FeedbackMessage } from '../components/motion/FeedbackMessage'
import { Button } from '../components/motion/Button'
import { changePassword, completeGoogleRegistration, completePhoneRegistration } from '../services/api'
import {
  getErrorMessage,
  isValidCpfLength,
  isValidPassword,
  isValidPhone,
  maskCpfInput,
  maskPhoneInput,
  cleanPhone,
  cleanCpf,
  formatPhone,
} from '../lib/utils'

export function AccountPage() {
  const { user, updateSessionToken, updateUser } = useAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const cadastroTelefone = searchParams.get('cadastro') === 'telefone'
  const cadastroGoogle = searchParams.get('cadastro') === 'google'

  const [cpf, setCpf] = useState('')
  const [telefone, setTelefone] = useState('')
  const [senhaAtual, setSenhaAtual] = useState('')
  const [senhaNova, setSenhaNova] = useState('')
  const [senhaNovaConfirm, setSenhaNovaConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)

  const isVisitante = user?.tipo_socio === 'nao_socio'
  const precisaCadastro = user?.precisa_cadastro
  const precisaTelefone = user?.precisa_telefone

  async function handleCadastroGoogle(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    const cpfLimpo = cleanCpf(cpf)
    const telefoneLimpo = cleanPhone(telefone)

    if (!isValidCpfLength(cpfLimpo)) {
      setError('Informe um CPF válido com 11 dígitos.')
      return
    }

    if (!isValidPhone(telefoneLimpo)) {
      setError('Informe um WhatsApp válido com DDD (10 ou 11 dígitos).')
      return
    }

    setSaving(true)
    try {
      const result = await completeGoogleRegistration(cpfLimpo, telefoneLimpo)
      updateSessionToken(result.token)
      updateUser(result.user)
      setSuccess(
        result.user.tipo_socio === 'nao_socio'
          ? 'Cadastro concluído! Você já pode solicitar reservas.'
          : 'Conta vinculada ao seu cadastro de sócio!'
      )
      setCpf('')
      setTelefone('')
      if (cadastroGoogle) {
        setTimeout(
          () => navigate(result.user.perfil === 'admin' ? '/admin' : '/reservas', { replace: true }),
          1200
        )
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Erro ao concluir cadastro.'))
    } finally {
      setSaving(false)
    }
  }

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

        {(precisaCadastro || cadastroGoogle) && (
          <div className="motion-feedback motion-feedback--info motion-feedback--enter">
            Informe seu CPF e WhatsApp para concluir o primeiro acesso. Se você já é sócio do clube,
            vincularemos automaticamente ao seu cadastro.
          </div>
        )}

        {(precisaTelefone || cadastroTelefone) && !precisaCadastro && !cadastroGoogle && (
          <div className="motion-feedback motion-feedback--info motion-feedback--enter">
            Cadastre seu WhatsApp para receber a confirmação das reservas e concluir solicitações.
          </div>
        )}

        {(precisaCadastro || cadastroGoogle) && (
          <div className="motion-card shadow-lg p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-emerald-900 mb-1">Concluir cadastro</h2>
            <p className="text-stone-500 text-sm mb-4">
              Usamos o CPF para identificar sócios já cadastrados e o WhatsApp para confirmações.
            </p>
            <form onSubmit={handleCadastroGoogle} className="space-y-4">
              <div>
                <label htmlFor="cpf-cadastro-google" className="block text-sm font-medium text-stone-700 mb-1">
                  CPF
                </label>
                <input
                  id="cpf-cadastro-google"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={cpf}
                  onChange={(e) => setCpf(maskCpfInput(e.target.value))}
                  placeholder="000.000.000-00"
                  required
                  className="w-full border border-stone-300 rounded-lg px-4 py-3 text-center text-lg font-mono tracking-wide focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label htmlFor="telefone-cadastro-google" className="block text-sm font-medium text-stone-700 mb-1">
                  WhatsApp
                </label>
                <input
                  id="telefone-cadastro-google"
                  type="tel"
                  value={telefone}
                  onChange={(e) => setTelefone(maskPhoneInput(e.target.value))}
                  placeholder="(47) 99999-9999"
                  inputMode="numeric"
                  required
                  className="w-full border border-stone-300 rounded-lg px-4 py-3 font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                loading={saving}
                loadingText="Salvando..."
              >
                Concluir cadastro
              </Button>
            </form>
          </div>
        )}

        {(isVisitante || precisaTelefone) && !precisaCadastro && !cadastroGoogle && (
          <div className="motion-card shadow-lg p-6 sm:p-8">
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
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                loading={saving}
                loadingText="Salvando..."
              >
                Salvar WhatsApp
              </Button>
            </form>
          </div>
        )}

        {!isVisitante && !precisaCadastro && (
          <div className="motion-card shadow-lg p-6 sm:p-8">
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
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                loading={saving}
                loadingText="Salvando..."
              >
                Salvar nova senha
              </Button>
            </form>
          </div>
        )}

        {(error || success) && (
          <FeedbackMessage
            type={error ? 'error' : 'success'}
            autoHideMs={success ? 5000 : 0}
            onDismiss={() => {
              setError('')
              setSuccess('')
            }}
          >
            {error || success}
          </FeedbackMessage>
        )}
      </div>
    </Layout>
  )
}

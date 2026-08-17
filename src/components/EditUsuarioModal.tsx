import { useEffect, useState, type FormEvent } from 'react'
import {
  cleanCpf,
  cleanPhone,
  isValidCpfLength,
  isValidEmail,
  isValidPhone,
  maskPhoneInput,
} from '../lib/utils'
import type { TipoSocio, Usuario } from '../types'
import { Modal } from './motion/Modal'
import { Button } from './motion/Button'
import { FeedbackMessage } from './motion/FeedbackMessage'

export interface UsuarioEditForm {
  nome: string
  cpf: string
  email: string
  telefone: string
  perfil: 'usuario' | 'admin'
  tipo_socio: TipoSocio
  ativo: boolean
}

interface EditUsuarioModalProps {
  usuario: Usuario | null
  isSelf: boolean
  saving?: boolean
  onClose: () => void
  onSave: (id: string, data: UsuarioEditForm) => Promise<void>
}

export function EditUsuarioModal({
  usuario,
  isSelf,
  saving = false,
  onClose,
  onSave,
}: EditUsuarioModalProps) {
  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [perfil, setPerfil] = useState<'usuario' | 'admin'>('usuario')
  const [tipoSocio, setTipoSocio] = useState<TipoSocio>('socio')
  const [ativo, setAtivo] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!usuario) return

    setNome(usuario.nome)
    setCpf(usuario.cpf ?? '')
    setEmail(usuario.email ?? '')
    setTelefone(usuario.telefone ? maskPhoneInput(usuario.telefone) : '')
    setPerfil(usuario.perfil)
    setTipoSocio(usuario.tipo_socio)
    setAtivo(usuario.ativo)
    setError('')
  }, [usuario])

  if (!usuario) return null

  const usuarioAtual = usuario

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    const cpfLimpo = cleanCpf(cpf)
    const telefoneLimpo = cleanPhone(telefone)
    const emailLimpo = email.trim().toLowerCase()

    if (!nome.trim()) {
      setError('Informe o nome.')
      return
    }

    if (tipoSocio === 'socio' && !isValidCpfLength(cpfLimpo)) {
      setError('Sócios devem ter CPF com 11 dígitos.')
      return
    }

    if (cpfLimpo && !isValidCpfLength(cpfLimpo)) {
      setError('CPF inválido.')
      return
    }

    if (emailLimpo && !isValidEmail(emailLimpo)) {
      setError('Informe um e-mail válido.')
      return
    }

    if (telefoneLimpo && !isValidPhone(telefoneLimpo)) {
      setError('Telefone deve ter 10 ou 11 dígitos (com DDD).')
      return
    }

    try {
      await onSave(usuarioAtual.id, {
        nome: nome.trim(),
        cpf: cpfLimpo,
        email: emailLimpo,
        telefone: telefoneLimpo,
        perfil: isSelf ? usuarioAtual.perfil : perfil,
        tipo_socio: tipoSocio,
        ativo: isSelf ? usuarioAtual.ativo : ativo,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar usuário.')
    }
  }

  return (
    <Modal open={!!usuario} onClose={onClose} labelledBy="edit-usuario-title" maxWidth="lg">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 id="edit-usuario-title" className="text-xl font-bold text-emerald-900">
            Editar usuário
          </h2>
          <p className="text-stone-500 text-sm mt-1">
            Matrícula: {usuarioAtual.codigo_usuario ?? '—'}
            {isSelf && ' · você não pode alterar seu perfil ou status aqui'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-stone-400 hover:text-stone-600 text-2xl leading-none px-1 motion-cta"
          aria-label="Fechar modal"
        >
          ×
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Nome *</label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            className="w-full border border-stone-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow duration-200"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              CPF {tipoSocio === 'socio' ? '*' : '(opcional)'}
            </label>
            <input
              value={cpf}
              onChange={(e) => setCpf(e.target.value.replace(/\D/g, '').slice(0, 11))}
              required={tipoSocio === 'socio'}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 font-mono focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow duration-200"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Telefone</label>
            <input
              type="tel"
              value={telefone}
              onChange={(e) => setTelefone(maskPhoneInput(e.target.value))}
              inputMode="numeric"
              placeholder="(47) 99999-9999"
              className="w-full border border-stone-300 rounded-lg px-3 py-2 font-mono focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow duration-200"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-stone-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow duration-200"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Tipo</label>
            <select
              value={tipoSocio}
              onChange={(e) => setTipoSocio(e.target.value as TipoSocio)}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow duration-200"
            >
              <option value="socio">Sócio</option>
              <option value="nao_socio">Visitante</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Perfil</label>
            <select
              value={perfil}
              onChange={(e) => setPerfil(e.target.value as 'usuario' | 'admin')}
              disabled={isSelf}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-stone-100 transition-shadow duration-200"
            >
              <option value="usuario">Usuário</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={ativo}
            onChange={(e) => setAtivo(e.target.checked)}
            disabled={isSelf}
            className="rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
          />
          Usuário ativo
        </label>

        {error && <FeedbackMessage type="error">{error}</FeedbackMessage>}

        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-1">
          <Button variant="ghost" size="lg" className="w-full sm:w-auto" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full flex-1"
            loading={saving}
            loadingText="Salvando..."
          >
            Salvar alterações
          </Button>
        </div>
      </form>
    </Modal>
  )
}

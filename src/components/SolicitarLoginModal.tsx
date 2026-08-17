import { useState, type FormEvent } from 'react'
import {
  buildWhatsAppLoginRequestUrl,
  isValidCpfLength,
  maskCpfInput,
} from '../lib/utils'
import { Modal } from './motion/Modal'
import { Button } from './motion/Button'
import { FeedbackMessage } from './motion/FeedbackMessage'

interface SolicitarLoginModalProps {
  open: boolean
  onClose: () => void
}

export function SolicitarLoginModal({ open, onClose }: SolicitarLoginModalProps) {
  const [cpf, setCpf] = useState('')
  const [error, setError] = useState('')

  function handleClose() {
    setCpf('')
    setError('')
    onClose()
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!isValidCpfLength(cpf)) {
      setError('Informe um CPF com 11 dígitos.')
      return
    }

    const url = buildWhatsAppLoginRequestUrl(cpf)
    window.open(url, '_blank', 'noopener,noreferrer')
    handleClose()
  }

  return (
    <Modal open={open} onClose={handleClose} labelledBy="solicitar-login-title" initialFocus>
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 id="solicitar-login-title" className="text-xl font-bold text-emerald-900">
            Solicitar login
          </h2>
          <p className="text-stone-500 text-sm mt-1">
            Informe seu CPF para abrir uma conversa no WhatsApp do clube solicitando o acesso.
          </p>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="text-stone-400 hover:text-stone-600 text-2xl leading-none px-1 motion-cta"
          aria-label="Fechar modal"
        >
          ×
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="cpf-solicitar-login" className="block text-sm font-medium text-stone-700 mb-1">
            CPF
          </label>
          <input
            id="cpf-solicitar-login"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={cpf}
            onChange={(e) => {
              setCpf(maskCpfInput(e.target.value))
              if (error) setError('')
            }}
            className="w-full border border-stone-300 rounded-lg px-4 py-3 text-center text-xl tracking-wide font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow duration-200"
            placeholder="000.000.000-00"
            required
          />
        </div>

        {error && <FeedbackMessage type="error">{error}</FeedbackMessage>}

        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-1">
          <Button variant="ghost" size="lg" className="w-full sm:w-auto" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" size="lg" className="w-full flex-1">
            Continuar no WhatsApp
          </Button>
        </div>
      </form>
    </Modal>
  )
}

import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  buildWhatsAppLoginRequestUrl,
  isValidCpfLength,
  maskCpfInput,
} from '../lib/utils'

interface SolicitarLoginModalProps {
  open: boolean
  onClose: () => void
}

export function SolicitarLoginModal({ open, onClose }: SolicitarLoginModalProps) {
  const [cpf, setCpf] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return

    setCpf('')
    setError('')

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const timer = window.setTimeout(() => inputRef.current?.focus(), 50)

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.clearTimeout(timer)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!isValidCpfLength(cpf)) {
      setError('Informe um CPF com 11 dígitos.')
      return
    }

    const url = buildWhatsAppLoginRequestUrl(cpf)
    window.open(url, '_blank', 'noopener,noreferrer')
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="solicitar-login-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-stone-900/50"
        aria-label="Fechar"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl p-6 sm:p-8">
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
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 text-2xl leading-none px-1"
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
              ref={inputRef}
              id="cpf-solicitar-login"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={cpf}
              onChange={(e) => {
                setCpf(maskCpfInput(e.target.value))
                if (error) setError('')
              }}
              className="w-full border border-stone-300 rounded-lg px-4 py-3 text-center text-xl tracking-wide font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="000.000.000-00"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-3 rounded-lg border border-stone-300 text-stone-700 font-medium hover:bg-stone-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="w-full flex-1 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              Continuar no WhatsApp
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

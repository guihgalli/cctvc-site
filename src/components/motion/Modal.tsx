import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

interface ModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** id do elemento de título para aria-labelledby */
  labelledBy?: string
  /** largura máxima do painel */
  maxWidth?: 'sm' | 'md' | 'lg'
  /** foco inicial ao abrir */
  initialFocus?: boolean
}

const maxWidthClass = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
}

export function Modal({
  open,
  onClose,
  children,
  labelledBy,
  maxWidth = 'md',
  initialFocus = false,
}: ModalProps) {
  const reducedMotion = usePrefersReducedMotion()
  const [mounted, setMounted] = useState(open)
  const [phase, setPhase] = useState<'enter' | 'exit' | 'idle'>('idle')
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setMounted(true)
      setPhase(reducedMotion ? 'idle' : 'enter')
      return
    }

    if (!mounted) return

    if (reducedMotion) {
      setMounted(false)
      setPhase('idle')
      return
    }

    setPhase('exit')
    const timer = window.setTimeout(() => {
      setMounted(false)
      setPhase('idle')
    }, 220)

    return () => window.clearTimeout(timer)
  }, [open, mounted, reducedMotion])

  useEffect(() => {
    if (!mounted) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)

    if (initialFocus) {
      const timer = window.setTimeout(() => {
        const focusable = panelRef.current?.querySelector<HTMLElement>(
          'input, button, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        focusable?.focus()
      }, 50)
      return () => {
        document.body.style.overflow = previousOverflow
        window.removeEventListener('keydown', handleKeyDown)
        window.clearTimeout(timer)
      }
    }

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [mounted, onClose, initialFocus])

  if (!mounted) return null

  const panelClass = [
    'motion-modal__panel',
    maxWidthClass[maxWidth],
    phase === 'enter' && 'motion-modal__panel--enter',
    phase === 'exit' && 'motion-modal__panel--exit',
  ]
    .filter(Boolean)
    .join(' ')

  const backdropClass = [
    'motion-modal__backdrop',
    phase === 'enter' && 'motion-modal__backdrop--enter',
    phase === 'exit' && 'motion-modal__backdrop--exit',
  ]
    .filter(Boolean)
    .join(' ')

  return createPortal(
    <div className="motion-modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      <button type="button" className={backdropClass} aria-label="Fechar" onClick={onClose} />
      <div ref={panelRef} className={panelClass}>
        {children}
      </div>
    </div>,
    document.body
  )
}

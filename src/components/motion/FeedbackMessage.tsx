import { useEffect, useState, useCallback, type ReactNode } from 'react'

interface FeedbackMessageProps {
  type: 'success' | 'error' | 'info'
  children: ReactNode
  onDismiss?: () => void
  /** auto-ocultar após ms (0 = não oculta) */
  autoHideMs?: number
  className?: string
}

export function FeedbackMessage({
  type,
  children,
  onDismiss,
  autoHideMs = 0,
  className = '',
}: FeedbackMessageProps) {
  const [visible, setVisible] = useState(true)
  const [exiting, setExiting] = useState(false)

  const dismiss = useCallback(() => {
    setExiting(true)
    window.setTimeout(() => {
      setVisible(false)
      onDismiss?.()
    }, 180)
  }, [onDismiss])

  useEffect(() => {
    if (!autoHideMs) return
    const timer = window.setTimeout(() => dismiss(), autoHideMs)
    return () => window.clearTimeout(timer)
  }, [autoHideMs, dismiss])

  if (!visible) return null

  const typeClass = {
    success: 'motion-feedback--success',
    error: 'motion-feedback--error',
    info: 'motion-feedback--info',
  }[type]

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      className={`motion-feedback ${typeClass} ${exiting ? 'motion-feedback--exit' : 'motion-feedback--enter'} ${className}`.trim()}
    >
      {children}
    </div>
  )
}

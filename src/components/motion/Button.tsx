import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
  loadingText?: string
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'whatsapp'
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
}

const variantClass = {
  primary: 'motion-btn--primary',
  secondary: 'motion-btn--secondary',
  ghost: 'motion-btn--ghost',
  danger: 'motion-btn--danger',
  whatsapp: 'motion-btn--whatsapp',
}

const sizeClass = {
  sm: 'motion-btn--sm',
  md: 'motion-btn--md',
  lg: 'motion-btn--lg',
}

export function Button({
  loading = false,
  loadingText,
  variant = 'primary',
  size = 'md',
  disabled,
  className = '',
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`motion-btn ${variantClass[variant]} ${sizeClass[size]} ${className}`.trim()}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <span className="motion-spinner motion-spinner--btn" aria-hidden="true" />}
      <span className={loading ? 'opacity-80' : undefined}>
        {loading && loadingText ? loadingText : children}
      </span>
    </button>
  )
}

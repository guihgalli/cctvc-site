interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: 'h-10 w-auto',
  md: 'h-16 w-auto',
  lg: 'h-28 md:h-32 w-auto',
}

export function Logo({ size = 'sm', className = '' }: LogoProps) {
  const src = size === 'sm' ? '/logo-sm.png' : '/logo.png'

  return (
    <img
      src={src}
      alt="CCTVC - Clube de Caça e Tiro Velha Central"
      className={`object-contain ${sizes[size]} ${className}`}
    />
  )
}

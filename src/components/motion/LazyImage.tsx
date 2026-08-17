import { useState } from 'react'
import { Skeleton } from './Skeleton'

interface LazyImageProps {
  src: string
  alt: string
  className?: string
  /** eager para imagens acima da dobra */
  loading?: 'lazy' | 'eager'
  /** aspect ratio CSS (ex.: "1", "4/3") */
  aspectRatio?: string
}

export function LazyImage({
  src,
  alt,
  className = '',
  loading = 'lazy',
  aspectRatio,
}: LazyImageProps) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  return (
    <span
      className={`motion-lazy-image ${aspectRatio ? '' : className}`.trim()}
      style={aspectRatio ? { aspectRatio } : undefined}
    >
      {!loaded && !error && (
        <Skeleton variant="rectangular" className="motion-lazy-image__skeleton absolute inset-0" />
      )}
      {error ? (
        <span className="motion-lazy-image__fallback" aria-label={alt}>
          Sem imagem
        </span>
      ) : (
        <img
          src={src}
          alt={alt}
          loading={loading}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={`motion-lazy-image__img ${className} ${loaded ? 'motion-lazy-image__img--loaded' : ''}`.trim()}
        />
      )}
    </span>
  )
}

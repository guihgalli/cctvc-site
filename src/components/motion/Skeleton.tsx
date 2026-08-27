import type { HTMLAttributes } from 'react'

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** forma do placeholder */
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded'
  /** largura customizada (ex.: "60%", "120px") */
  width?: string
  /** altura customizada */
  height?: string
}

const variantClass = {
  text: 'motion-skeleton--text',
  circular: 'motion-skeleton--circular',
  rectangular: 'motion-skeleton--rectangular',
  rounded: 'motion-skeleton--rounded',
}

export function Skeleton({
  variant = 'rectangular',
  width,
  height,
  className = '',
  style,
  ...props
}: SkeletonProps) {
  return (
    <div
      className={`motion-skeleton ${variantClass[variant]} ${className}`.trim()}
      style={{ width, height, ...style }}
      aria-hidden="true"
      {...props}
    />
  )
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          width={i === lines - 1 ? '70%' : '100%'}
        />
      ))}
    </div>
  )
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`motion-skeleton-card ${className}`} aria-hidden="true">
      <Skeleton variant="rounded" className="w-full aspect-[4/3] mb-3" />
      <Skeleton variant="text" width="55%" className="mb-2" />
      <Skeleton variant="text" width="85%" />
    </div>
  )
}

export function ReservationsPageSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 motion-page-enter" aria-busy="true" aria-label="Carregando reservas">
      <Skeleton variant="text" width="220px" height="28px" className="mb-6" />
      <div className="flex gap-2 mb-6">
        <Skeleton variant="rounded" width="120px" height="40px" />
        <Skeleton variant="rounded" width="160px" height="40px" />
      </div>
      <div className="flex gap-2 mb-5 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" width="76px" height="88px" className="shrink-0" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton variant="text" width="48px" height="20px" />
            <Skeleton variant="rounded" className="flex-1 h-11" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function AdminPageSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 motion-page-enter" aria-busy="true" aria-label="Carregando painel">
      <Skeleton variant="text" width="260px" height="28px" className="mb-6" />
      <div className="flex gap-2 mb-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" width="100px" height="40px" />
        ))}
      </div>
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="motion-skeleton-card p-4 flex gap-4">
            <Skeleton variant="rounded" width="96px" height="96px" className="shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton variant="text" width="40%" />
              <Skeleton variant="text" width="70%" />
              <Skeleton variant="text" width="55%" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AdminUsuariosSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando usuários" className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <Skeleton variant="text" width="200px" height="24px" />
        <Skeleton variant="rounded" width="140px" height="40px" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton variant="rounded" className="flex-1 min-w-[200px] h-10" />
        <Skeleton variant="rounded" width="120px" height="40px" />
        <Skeleton variant="rounded" width="120px" height="40px" />
        <Skeleton variant="rounded" width="100px" height="40px" />
      </div>
      <div className="motion-card border border-stone-200 overflow-hidden">
        <div className="bg-stone-50 border-b px-4 py-3 flex gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="text" width={`${60 + i * 10}px`} height="16px" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="px-4 py-3 border-b last:border-0 flex gap-4 items-center">
            <Skeleton variant="text" width="48px" height="16px" />
            <Skeleton variant="text" className="flex-1" height="16px" />
            <Skeleton variant="rounded" width="72px" height="28px" />
            <Skeleton variant="rounded" width="56px" height="28px" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function PageLoadingSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 motion-page-enter" aria-busy="true">
      <div className="motion-spinner motion-spinner--lg" aria-hidden="true" />
      <p className="text-stone-500 text-sm">Carregando...</p>
    </div>
  )
}

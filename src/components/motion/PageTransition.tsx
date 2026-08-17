import { useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

interface PageTransitionProps {
  children: ReactNode
}

export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation()
  const reducedMotion = usePrefersReducedMotion()
  const [displayLocation, setDisplayLocation] = useState(location)
  const [transitionStage, setTransitionStage] = useState<'enter' | 'idle'>('enter')

  useEffect(() => {
    if (location.pathname === displayLocation.pathname) return

    if (reducedMotion) {
      setDisplayLocation(location)
      setTransitionStage('idle')
      return
    }

    setTransitionStage('enter')
    const timer = window.setTimeout(() => {
      setDisplayLocation(location)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [location, displayLocation.pathname, reducedMotion])

  useEffect(() => {
    if (transitionStage === 'enter') {
      const frame = requestAnimationFrame(() => setTransitionStage('idle'))
      return () => cancelAnimationFrame(frame)
    }
  }, [displayLocation, transitionStage])

  const className = [
    'motion-page',
    transitionStage === 'enter' && 'motion-page--enter',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div key={displayLocation.pathname} className={className}>
      {children}
    </div>
  )
}

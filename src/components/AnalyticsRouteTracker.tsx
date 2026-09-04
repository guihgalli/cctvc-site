import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { initAnalytics, trackPageView } from '../lib/analytics'

export function AnalyticsRouteTracker() {
  const location = useLocation()

  useEffect(() => {
    initAnalytics()
  }, [])

  useEffect(() => {
    trackPageView(`${location.pathname}${location.search}${location.hash}`)
  }, [location.pathname, location.search, location.hash])

  return null
}

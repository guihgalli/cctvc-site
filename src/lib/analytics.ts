const GTM_ID = import.meta.env.VITE_GTM_CONTAINER_ID?.trim()

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[]
  }
}

let initialized = false

export function isAnalyticsEnabled(): boolean {
  return Boolean(GTM_ID)
}

/** Carrega o Google Tag Manager (compatível com a CSP do site — sem script inline). */
export function initAnalytics(): void {
  if (!isAnalyticsEnabled() || initialized) return

  window.dataLayer = window.dataLayer ?? []
  window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' })

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`
  document.head.appendChild(script)

  initialized = true
}

/** Envia page_view ao dataLayer — necessário em SPAs (React Router). */
export function trackPageView(path: string, title?: string): void {
  if (!isAnalyticsEnabled()) return

  window.dataLayer = window.dataLayer ?? []
  window.dataLayer.push({
    event: 'page_view',
    page_path: path,
    page_title: title ?? document.title,
    page_location: `${window.location.origin}${path}`,
  })
}

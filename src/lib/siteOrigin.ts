/** Origem pública do site (OAuth, links absolutos). Preferir VITE_SITE_URL em produção. */
export function getAppOrigin(): string {
  const configured = import.meta.env.VITE_SITE_URL?.replace(/\/$/, '')
  if (configured) return configured
  return window.location.origin
}

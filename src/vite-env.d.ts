/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** URL canônica do site em produção (ex.: https://www.cctvc.com.br) — usada no redirect OAuth */
  readonly VITE_SITE_URL?: string
  /** Container do Google Tag Manager (ex.: GTM-XXXXXXX). Opcional — sem valor, analytics fica desativado. */
  readonly VITE_GTM_CONTAINER_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

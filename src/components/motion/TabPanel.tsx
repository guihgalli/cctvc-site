import type { ReactNode } from 'react'

interface TabPanelProps {
  active: boolean
  children: ReactNode
  id?: string
  labelledBy?: string
}

/** Painel de aba com transição suave de entrada */
export function TabPanel({ active, children, id, labelledBy }: TabPanelProps) {
  if (!active) return null

  return (
    <div id={id} className="motion-tab-panel" role="tabpanel" aria-labelledby={labelledBy}>
      {children}
    </div>
  )
}

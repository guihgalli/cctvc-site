import type { ReactNode } from 'react'
import { Header } from './Header'

interface LayoutProps {
  children: ReactNode
  showHeader?: boolean
}

export function Layout({ children, showHeader = true }: LayoutProps) {
  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {showHeader && <Header />}
      <main className="flex-1">{children}</main>
      <footer className="bg-emerald-950 text-emerald-400 text-center py-4 text-sm">
        <p>© {new Date().getFullYear()} CCTVC - Clube de Caça e Tiro Velha Central</p>
      </footer>
    </div>
  )
}

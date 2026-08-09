import type { ReactNode } from 'react'
import { Header } from './Header'
import { WHATSAPP_ASSOCIACAO_TEXT, buildWhatsAppUrl } from '../lib/utils'

const whatsappUrl = buildWhatsAppUrl(WHATSAPP_ASSOCIACAO_TEXT)

interface LayoutProps {
  children: ReactNode
  showHeader?: boolean
}

export function Layout({ children, showHeader = true }: LayoutProps) {
  return (
    <div className="min-h-screen bg-[#f8faf8] flex flex-col">
      {showHeader && <Header />}
      <main className="flex-1">{children}</main>
      <footer className="bg-emerald-950 text-emerald-200">
        <div className="max-w-5xl mx-auto px-4 py-8 grid gap-6 md:grid-cols-[1.2fr_1fr_1fr] text-sm">
          <div>
            <p className="font-display text-emerald-50 text-base mb-2">
              CCTVC — Clube de Caça e Tiro Velha Central
            </p>
            <p className="text-emerald-300/90 leading-relaxed">
              Tradição, esporte e lazer em Blumenau desde 1º de maio de 1900.
            </p>
          </div>
          <div>
            <p className="text-emerald-50 font-medium mb-2">Contato</p>
            <p className="leading-relaxed">
              Rua dos Caçadores, 3680
              <br />
              Velha Central — Blumenau/SC
              <br />
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                WhatsApp (47) 98808-0903
              </a>
              <br />
              <a href="tel:+5547988080903" className="hover:text-white transition-colors">
                (47) 98808-0903
              </a>
            </p>
          </div>
          <div>
            <p className="text-emerald-50 font-medium mb-2">Redes e associação</p>
            <a
              href="https://www.instagram.com/cctvelhacentral/"
              target="_blank"
              rel="noopener noreferrer"
              className="block hover:text-white transition-colors"
            >
              Instagram @cctvelhacentral
            </a>
            <a href="/#associe-se" className="block mt-2 hover:text-white transition-colors">
              Como se tornar sócio
            </a>
          </div>
        </div>
        <div className="border-t border-emerald-900/80 text-center py-4 text-xs text-emerald-400">
          © {new Date().getFullYear()} CCTVC - Clube de Caça e Tiro Velha Central
        </div>
      </footer>
    </div>
  )
}

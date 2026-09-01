import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Logo } from './Logo'

const homeAnchors = [
  { href: '#departamentos', label: 'Departamentos' },
  { href: '#associe-se', label: 'Associe-se' },
  { href: '#visite', label: 'Visite' },
]

function navLinkClass(isActive: boolean): string {
  return `text-sm transition-colors ${
    isActive ? 'text-white font-medium underline underline-offset-4' : 'text-emerald-200 hover:text-white'
  }`
}

function isPathActive(pathname: string, path: string): boolean {
  if (path === '/admin') {
    return pathname === '/admin' || pathname.startsWith('/admin/')
  }
  return pathname === path
}

export function Header() {
  const { user, logout, isAdmin } = useAuth()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const isHome = location.pathname === '/'
  const reservasPath = user ? '/reservas' : '/login'
  const showMobileToggle = isHome || Boolean(user)

  function closeMenu() {
    setMenuOpen(false)
  }

  const loggedInLinks = user
    ? isAdmin
      ? [
          { to: '/admin', label: 'Painel' },
          { to: '/conta', label: 'Conta' },
        ]
      : [
          { to: '/reservas', label: 'Reservas' },
          { to: '/guia', label: 'Guia' },
          { to: '/conta', label: 'Conta' },
        ]
    : []

  return (
    <header className="bg-emerald-900 text-white shadow-lg relative z-40">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3 group shrink-0">
          <Logo size="sm" className="drop-shadow-sm transition-opacity duration-200 group-hover:opacity-90" />
          <div className="hidden sm:block">
            <p className="font-semibold text-sm leading-tight">Clube de Caça e Tiro</p>
            <p className="text-emerald-300 text-xs">Velha Central</p>
          </div>
        </Link>

        <div className="flex items-center gap-3 md:gap-4">
          {isHome && (
            <nav className="hidden md:flex items-center gap-4" aria-label="Seções da página">
              {homeAnchors.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="text-sm text-emerald-200 hover:text-white transition-colors"
                >
                  {item.label}
                </a>
              ))}
              {!user && (
                <Link
                  to={reservasPath}
                  className="text-sm text-emerald-200 hover:text-white transition-colors"
                >
                  Reservas
                </Link>
              )}
            </nav>
          )}

          {!isHome && (
            <Link to="/" className="text-sm text-emerald-200 hover:text-white transition-colors">
              Início
            </Link>
          )}

          {user ? (
            <>
              {loggedInLinks.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  className={`${navLinkClass(isPathActive(location.pathname, to))} hidden sm:inline`}
                >
                  {label}
                </Link>
              ))}
              <span className="text-sm text-emerald-300 hidden lg:inline">
                Olá, {user.nome.split(' ')[0]}
              </span>
              <button
                onClick={logout}
                className="text-sm bg-emerald-800 hover:bg-emerald-700 px-3 py-1.5 rounded motion-cta transition-colors"
              >
                Sair
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="text-sm bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded font-medium motion-cta transition-colors"
            >
              Entrar
            </Link>
          )}

          {showMobileToggle && (
            <button
              type="button"
              className="sm:hidden flex flex-col justify-center gap-1.5 w-9 h-9 rounded border border-emerald-700/80 hover:bg-emerald-800 transition-colors"
              aria-expanded={menuOpen}
              aria-controls="header-mobile-nav"
              aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span className="sr-only">{menuOpen ? 'Fechar menu' : 'Abrir menu'}</span>
              <span className="block w-4 h-0.5 bg-emerald-100 mx-auto" />
              <span className="block w-4 h-0.5 bg-emerald-100 mx-auto" />
              <span className="block w-4 h-0.5 bg-emerald-100 mx-auto" />
            </button>
          )}
        </div>
      </div>

      {showMobileToggle && menuOpen && (
        <nav
          id="header-mobile-nav"
          className="sm:hidden border-t border-emerald-800 bg-emerald-950/95 px-4 py-3 flex flex-col gap-1"
          aria-label="Menu de navegação"
        >
          {isHome &&
            homeAnchors.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm text-emerald-100 hover:text-white py-2 transition-colors"
                onClick={closeMenu}
              >
                {item.label}
              </a>
            ))}

          {user ? (
            loggedInLinks.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`text-sm py-2 transition-colors ${navLinkClass(isPathActive(location.pathname, to))}`}
                onClick={closeMenu}
              >
                {label}
              </Link>
            ))
          ) : (
            <Link
              to={reservasPath}
              className="text-sm text-emerald-100 hover:text-white py-2 transition-colors"
              onClick={closeMenu}
            >
              Reservas
            </Link>
          )}
        </nav>
      )}
    </header>
  )
}

import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Logo } from './Logo'

export function Header() {
  const { user, logout, isAdmin } = useAuth()
  const location = useLocation()

  const isHome = location.pathname === '/'

  return (
    <header className="bg-emerald-900 text-white shadow-lg">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <Logo size="sm" className="drop-shadow-sm group-hover:scale-105 transition-transform" />
          <div className="hidden sm:block">
            <p className="font-semibold text-sm leading-tight">Clube de Caça e Tiro</p>
            <p className="text-emerald-300 text-xs">Velha Central</p>
          </div>
        </Link>

        <nav className="flex items-center gap-4">
          {!isHome && (
            <Link to="/" className="text-sm text-emerald-200 hover:text-white transition-colors">
              Início
            </Link>
          )}
          {user ? (
            <>
              <Link
                to="/reservas"
                className="text-sm text-emerald-200 hover:text-white transition-colors"
              >
                Reservas
              </Link>
              {isAdmin && (
                <Link
                  to="/admin"
                  className="text-sm text-emerald-200 hover:text-white transition-colors"
                >
                  Admin
                </Link>
              )}
              <span className="text-sm text-emerald-300 hidden sm:inline">
                Olá, {user.nome.split(' ')[0]}
              </span>
              <button
                onClick={logout}
                className="text-sm bg-emerald-800 hover:bg-emerald-700 px-3 py-1.5 rounded transition-colors"
              >
                Sair
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="text-sm bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded font-medium transition-colors"
            >
              Entrar
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}

import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'

export function HomePage() {
  return (
    <Layout>
      <section className="relative bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-950 text-white">
        <div className="max-w-4xl mx-auto px-4 py-24 text-center">
          <div className="w-24 h-24 bg-emerald-700 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
            <span className="text-2xl font-bold">CCTVC</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Clube de Caça e Tiro Velha Central
          </h1>
          <p className="text-emerald-200 text-lg md:text-xl mb-8 max-w-2xl mx-auto">
            Tradição, esporte e convivência em Velha Central. Reserve suas quadras esportivas
            de forma rápida e prática.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/login"
              className="bg-white text-emerald-900 px-8 py-3 rounded-lg font-semibold hover:bg-emerald-50 transition-colors shadow-lg"
            >
              Reservar Quadra
            </Link>
            <a
              href="https://www.instagram.com/cctvelhacentral/"
              target="_blank"
              rel="noopener noreferrer"
              className="border-2 border-emerald-400 text-emerald-100 px-8 py-3 rounded-lg font-semibold hover:bg-emerald-800 transition-colors"
            >
              Instagram
            </a>
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8 text-center">
          <div className="p-6">
            <div className="text-4xl mb-3">🎾</div>
            <h3 className="font-semibold text-emerald-900 mb-2">Quadras Esportivas</h3>
            <p className="text-stone-600 text-sm">
              Tênis, futsal, vôlei e mais. Reserve o horário que preferir.
            </p>
          </div>
          <div className="p-6">
            <div className="text-4xl mb-3">📅</div>
            <h3 className="font-semibold text-emerald-900 mb-2">Agenda Online</h3>
            <p className="text-stone-600 text-sm">
              Veja disponibilidade em tempo real e faça sua reserva pelo site.
            </p>
          </div>
          <div className="p-6">
            <div className="text-4xl mb-3">🔒</div>
            <h3 className="font-semibold text-emerald-900 mb-2">Acesso Seguro</h3>
            <p className="text-stone-600 text-sm">
              Login exclusivo para sócios cadastrados do clube.
            </p>
          </div>
        </div>
      </section>
    </Layout>
  )
}

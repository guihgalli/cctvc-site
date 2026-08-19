import { useEffect, type CSSProperties } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { InstagramCarousel } from '../components/InstagramCarousel'
import { Layout } from '../components/Layout'
import { Logo } from '../components/Logo'
import { useAuth } from '../contexts/AuthContext'
import { INSTAGRAM_PROFILE_URL } from '../data/instagramPosts'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import {
  CLUBE_MAPS_EMBED_URL,
  CLUBE_MAPS_EXTERNAL_URL,
  WHATSAPP_ASSOCIACAO_TEXT,
  buildWhatsAppUrl,
} from '../lib/utils'

const CLUBE_FOUNDATION_YEAR = 1900
const HISTORY_PHOTO = '/instagram/03-DWPViKcCFVY.jpg'

const departamentos = [
  {
    title: 'Bocha',
    description: 'Esporte clássico do clube, com pistas e confraternização entre sócios de todas as idades.',
  },
  {
    title: 'Bolão',
    description: 'Tradição catarinense em evidência: competições, campeonatos e muita vibração nas pistas.',
  },
  {
    title: 'Futebol',
    description: 'Reúna a turma para jogar e viver o espírito esportivo que marca o dia a dia do CCTVC.',
  },
  {
    title: 'Tiro esportivo',
    description: 'Modalidade histórica do clube, com estande e prática responsável para atletas e associados.',
  },
  {
    title: 'Folclore',
    description: 'Grupo folclórico com categorias mirim, juvenil e adulto, mantendo viva a cultura da região.',
  },
  {
    title: 'Quadras esportivas',
    description:
      'Reserve beach tennis, vôlei, futebol e outras quadras esportivas.',
    linkToReservas: true,
  },
]

const estrutura = [
  'Salão social para bailes e confraternizações',
  'Espaço Gourmet e quiosques',
  'Cozinha industrial',
  'Amplo estacionamento e área de lazer',
]

const eventos = [
  {
    title: 'Festa de Reis',
    description: 'Competições, busca dos Reis e Rainhas, café colonial e baile com banda ao vivo.',
  },
  {
    title: 'Galetada e Festa de Agosto',
    description: 'Encontros tradicionais da família CCTVC, com gastronomia, música e convivência.',
  },
  {
    title: 'Olimpíadas e Stamm',
    description: 'Competições entre clubes e celebrações típicas que reforçam a união dos associados.',
  },
]

const passosAssociacao = [
  {
    title: 'Fale com a secretaria',
    description:
      'Entre em contato pelo WhatsApp ou telefone e conte se o interesse é social, esportivo ou cultural.',
  },
  {
    title: 'Conheça a sede',
    description:
      'Agende uma visita para conhecer a estrutura, os departamentos e o dia a dia da família CCTVC.',
  },
  {
    title: 'Finalize sua associação',
    description:
      'A secretaria orienta sobre documentação, categorias e próximos passos para você se tornar sócio.',
  },
]

const whatsappAssociacaoUrl = buildWhatsAppUrl(WHATSAPP_ASSOCIACAO_TEXT)
const anosTradicao = new Date().getFullYear() - CLUBE_FOUNDATION_YEAR

export function HomePage() {
  const { user } = useAuth()
  const location = useLocation()
  const reduceMotion = usePrefersReducedMotion()

  const reservasPath = user ? '/reservas' : '/login'
  const reservasLabel = user ? 'Ir para reservas' : 'Reservar quadra'
  const reservasPanelLabel = user ? 'Minhas reservas' : 'Acessar reservas'

  useEffect(() => {
    const hash = location.hash.replace('#', '')
    if (!hash) return

    const timer = window.setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start',
      })
    }, 80)

    return () => window.clearTimeout(timer)
  }, [location.hash, reduceMotion])

  return (
    <Layout>
      <section className="home-hero relative overflow-hidden text-white">
        <div className="home-hero__pattern" aria-hidden="true" />
        <div className="relative max-w-5xl mx-auto px-4 py-20 md:py-28 text-center">
          <Logo size="lg" className="mx-auto mb-6 drop-shadow-xl home-fade-up home-fade-up--logo" />
          <p className="font-display text-emerald-100/90 text-sm md:text-base tracking-[0.28em] uppercase mb-4 home-fade-up home-fade-up--delay-1">
            CCTVC
          </p>
          <h1 className="font-display text-4xl md:text-6xl font-semibold tracking-tight mb-5 home-fade-up home-fade-up--delay-2">
            Clube de Caça e Tiro Velha Central
          </h1>
          <p className="text-emerald-100 text-lg md:text-xl mb-10 max-w-2xl mx-auto leading-relaxed home-fade-up home-fade-up--delay-3">
            Tradição, esporte e lazer em Blumenau desde 1º de maio de 1900. Venha fazer parte da nossa família.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center home-fade-up home-fade-up--delay-4">
            <Link
              to={reservasPath}
              className="motion-cta bg-white text-emerald-950 px-8 py-3 rounded-lg font-semibold hover:bg-emerald-50"
            >
              {reservasLabel}
            </Link>
            <a
              href="#associe-se"
              className="motion-cta border border-emerald-300/80 text-emerald-50 px-8 py-3 rounded-lg font-semibold hover:bg-white/10"
            >
              Quero ser sócio
            </a>
          </div>
        </div>
      </section>

      <section className="bg-[#f3f7f4]">
        <div className="max-w-5xl mx-auto px-4 py-16 md:py-20 grid md:grid-cols-[1.1fr_0.9fr] gap-10 md:gap-14 items-center">
          <div>
            <p className="font-display text-emerald-800 text-sm tracking-[0.22em] uppercase mb-3">
              Nossa história
            </p>
            <h2 className="font-display text-3xl md:text-4xl text-emerald-950 mb-5 leading-tight">
              Mais de um século criando memórias em família
            </h2>
            <p className="text-stone-700 text-base md:text-lg leading-relaxed mb-4">
              O CCT Velha Central faz parte da história de Blumenau e, acima de tudo, da história das famílias
              que o construíram. Do estande de tiro às pistas de bolão, passando pelo café e pelos bailes, o
              objetivo é um só: reunir pessoas e criar memórias.
            </p>
            <p className="text-stone-600 leading-relaxed">
              Aqui você não apenas se associa — escolhe um estilo de vida com esporte, tradição cultural e
              convivência em um ambiente familiar.
            </p>
          </div>
          <div className="space-y-6">
            <div className="home-history-photo motion-page-enter">
              <img
                src={HISTORY_PHOTO}
                alt="Momentos de tradição e convivência no CCTVC"
                loading="lazy"
                className="home-history-photo__image"
              />
            </div>
            <div className="home-stat-panel motion-page-enter">
              <div>
                <p className="font-display text-4xl md:text-5xl text-emerald-950">{CLUBE_FOUNDATION_YEAR}</p>
                <p className="text-stone-600 mt-1">Fundação em 1º de maio</p>
              </div>
              <div className="home-stat-panel__divider" />
              <div>
                <p className="font-display text-4xl md:text-5xl text-emerald-950">+{anosTradicao}</p>
                <p className="text-stone-600 mt-1">Anos de tradição em Blumenau</p>
              </div>
              <div className="home-stat-panel__divider" />
              <div>
                <p className="font-display text-4xl md:text-5xl text-emerald-950"> família</p>
                <p className="text-stone-600 mt-1">Esporte, folclore e lazer juntos</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <InstagramCarousel />

      <section id="departamentos" className="bg-white scroll-mt-20">
        <div className="max-w-5xl mx-auto px-4 py-16 md:py-20">
          <div className="max-w-2xl mb-10 md:mb-12">
            <p className="font-display text-emerald-800 text-sm tracking-[0.22em] uppercase mb-3">
              Departamentos
            </p>
            <h2 className="font-display text-3xl md:text-4xl text-emerald-950 mb-4 leading-tight">
              Um clube, múltiplas possibilidades
            </h2>
            <p className="text-stone-600 text-lg leading-relaxed">
              Infraestrutura e departamentos para todos os gostos e idades — do esporte clássico ao folclore.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10">
            {departamentos.map((item, index) => {
              const content = (
                <>
                  <h3 className="font-display text-xl text-emerald-950 mb-2">{item.title}</h3>
                  <p className="text-stone-600 text-sm leading-relaxed">{item.description}</p>
                </>
              )

              if (item.linkToReservas) {
                return (
                  <Link
                    key={item.title}
                    to={reservasPath}
                    className="home-feature home-feature--link motion-stagger-item"
                    style={{ '--stagger-index': index } as CSSProperties}
                  >
                    {content}
                  </Link>
                )
              }

              return (
                <article
                  key={item.title}
                  className="home-feature motion-stagger-item"
                  style={{ '--stagger-index': index } as CSSProperties}
                >
                  {content}
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="bg-emerald-950 text-emerald-50">
        <div className="max-w-5xl mx-auto px-4 py-16 md:py-20 grid md:grid-cols-2 gap-10 md:gap-16">
          <div>
            <p className="font-display text-emerald-300 text-sm tracking-[0.22em] uppercase mb-3">
              Estrutura
            </p>
            <h2 className="font-display text-3xl md:text-4xl text-white mb-4 leading-tight">
              O lugar ideal para os seus melhores momentos
            </h2>
            <p className="text-emerald-100/85 leading-relaxed mb-8">
              Do esporte ao lazer, a sede oferece espaços versáteis para associados, famílias e eventos —
              com qualidade e ambiente acolhedor.
            </p>
            <ul className="space-y-3">
              {estrutura.map((item) => (
                <li key={item} className="flex gap-3 text-emerald-50/95">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="home-reserve-panel">
            <h3 className="font-display text-2xl text-white mb-3">Reserve sua quadra</h3>
            <p className="text-emerald-100/80 mb-6 leading-relaxed">
              Sócios e visitantes acessam a agenda online, escolhem data e horário e garantem a reserva com
              poucos cliques. Visitantes: a reserva fica pendente até a secretaria confirmar após o pagamento.
            </p>
            <Link
              to={reservasPath}
              className="motion-cta inline-flex bg-emerald-400 text-emerald-950 px-6 py-3 rounded-lg font-semibold hover:bg-emerald-300"
            >
              {reservasPanelLabel}
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-[#f3f7f4]">
        <div className="max-w-5xl mx-auto px-4 py-16 md:py-20">
          <div className="max-w-2xl mb-10 md:mb-12">
            <p className="font-display text-emerald-800 text-sm tracking-[0.22em] uppercase mb-3">
              Vida de clube
            </p>
            <h2 className="font-display text-3xl md:text-4xl text-emerald-950 mb-4 leading-tight">
              Eventos que mantêm a tradição viva
            </h2>
            <p className="text-stone-600 text-lg leading-relaxed">
              Bailes, competições e encontros gastronômicos fazem parte do calendário que anima a Velha Central.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 md:gap-10">
            {eventos.map((evento, index) => (
              <article
                key={evento.title}
                className="home-event motion-stagger-item"
                style={{ '--stagger-index': index } as CSSProperties}
              >
                <h3 className="font-display text-xl text-emerald-950 mb-2">{evento.title}</h3>
                <p className="text-stone-600 text-sm leading-relaxed">{evento.description}</p>
              </article>
            ))}
          </div>
          <p className="mt-10 text-stone-600">
            Acompanhe a agenda completa no Instagram{' '}
            <a
              href={INSTAGRAM_PROFILE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-800 font-medium underline underline-offset-4 hover:text-emerald-950"
            >
              @cctvelhacentral
            </a>
            .
          </p>
        </div>
      </section>

      <section id="associe-se" className="bg-white scroll-mt-20">
        <div className="max-w-5xl mx-auto px-4 py-16 md:py-20">
          <div className="max-w-2xl mb-10 md:mb-12">
            <p className="font-display text-emerald-800 text-sm tracking-[0.22em] uppercase mb-3">
              Associação
            </p>
            <h2 className="font-display text-3xl md:text-4xl text-emerald-950 mb-4 leading-tight">
              Como se tornar sócio
            </h2>
            <p className="text-stone-600 text-lg leading-relaxed">
              Quer fazer parte do CCTVC? Fale com a secretaria — o caminho é simples e começa com uma conversa.
            </p>
          </div>

          <ol className="grid md:grid-cols-3 gap-8 md:gap-10 mb-10">
            {passosAssociacao.map((passo, index) => (
              <li
                key={passo.title}
                className="home-step motion-stagger-item"
                style={{ '--stagger-index': index } as CSSProperties}
              >
                <p className="font-display text-emerald-700 text-sm tracking-[0.18em] uppercase mb-3">
                  Passo {index + 1}
                </p>
                <h3 className="font-display text-xl text-emerald-950 mb-2">{passo.title}</h3>
                <p className="text-stone-600 text-sm leading-relaxed">{passo.description}</p>
              </li>
            ))}
          </ol>

          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href={whatsappAssociacaoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="motion-cta inline-flex items-center justify-center gap-2 bg-emerald-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-emerald-600"
            >
              <WhatsAppIcon />
              Quero ser sócio no WhatsApp
            </a>
            <a
              href="tel:+5547988080903"
              className="motion-cta inline-flex items-center justify-center border border-emerald-800/20 text-emerald-900 px-6 py-3 rounded-lg font-semibold hover:bg-emerald-50"
            >
              Ligar (47) 98808-0903
            </a>
          </div>
        </div>
      </section>

      <section id="visite" className="bg-[#f3f7f4] scroll-mt-20">
        <div className="max-w-5xl mx-auto px-4 py-16 md:py-20">
          <div className="max-w-2xl mb-10">
            <p className="font-display text-emerald-800 text-sm tracking-[0.22em] uppercase mb-3">
              Visite o clube
            </p>
            <h2 className="font-display text-3xl md:text-4xl text-emerald-950 mb-4 leading-tight">
              Estamos de portas abertas na Velha Central
            </h2>
            <p className="text-stone-600 text-lg leading-relaxed">
              Venha conhecer a sede ou fale conosco pelo WhatsApp, telefone ou Instagram.
            </p>
          </div>

          <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-10 lg:gap-12 items-start">
            <div className="space-y-8">
              <div>
                <h3 className="font-display text-lg text-emerald-950 mb-2">Endereço</h3>
                <p className="text-stone-600 leading-relaxed">
                  Rua dos Caçadores, 3680
                  <br />
                  Velha Central — Blumenau/SC
                  <br />
                  CEP 89040-003
                </p>
                <a
                  href={CLUBE_MAPS_EXTERNAL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-3 text-emerald-800 font-medium underline underline-offset-4 hover:text-emerald-950"
                >
                  Abrir no Google Maps
                </a>
              </div>
              <div>
                <h3 className="font-display text-lg text-emerald-950 mb-2">Contato</h3>
                <p className="text-stone-600 leading-relaxed">
                  <a
                    href={whatsappAssociacaoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 hover:text-emerald-900 transition-colors"
                  >
                    <WhatsAppIcon className="text-emerald-700" />
                    WhatsApp (47) 98808-0903
                  </a>
                  <br />
                  <a href="tel:+5547988080903" className="hover:text-emerald-900 transition-colors">
                    (47) 98808-0903
                  </a>
                  <br />
                  <a href="tel:+554733300997" className="hover:text-emerald-900 transition-colors">
                    (47) 3330-0997
                  </a>
                </p>
              </div>
              <div>
                <h3 className="font-display text-lg text-emerald-950 mb-2">Redes</h3>
                <p className="text-stone-600 leading-relaxed">
                  <a
                    href={INSTAGRAM_PROFILE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-emerald-900 transition-colors"
                  >
                    Instagram @cctvelhacentral
                  </a>
                </p>
              </div>
            </div>

            <div className="home-map motion-page-enter">
              <iframe
                title="Mapa do CCTVC — Rua dos Caçadores, 3680, Blumenau"
                src={CLUBE_MAPS_EMBED_URL}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
                className="home-map__frame"
              />
            </div>
          </div>
        </div>
      </section>
    </Layout>
  )
}

function WhatsAppIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M20.52 3.48A11.86 11.86 0 0 0 12.04 0C5.5 0 .2 5.3.2 11.84c0 2.09.55 4.12 1.6 5.92L0 24l6.4-1.68a11.8 11.8 0 0 0 5.64 1.44h.01c6.54 0 11.84-5.3 11.84-11.84 0-3.16-1.23-6.13-3.37-8.44ZM12.05 21.5h-.01a9.67 9.67 0 0 1-4.93-1.35l-.35-.21-3.8 1 1.01-3.7-.23-.38a9.66 9.66 0 0 1-1.48-5.16c0-5.34 4.35-9.68 9.7-9.68 2.59 0 5.02 1.01 6.85 2.84a9.62 9.62 0 0 1 2.84 6.85c0 5.34-4.35 9.79-9.6 9.79Zm5.3-7.25c-.29-.15-1.72-.85-1.99-.94-.27-.1-.46-.15-.66.14-.19.29-.76.94-.93 1.14-.17.19-.34.22-.63.07-.29-.15-1.23-.45-2.34-1.44-.86-.77-1.44-1.72-1.61-2.01-.17-.29-.02-.45.13-.6.13-.13.29-.34.43-.51.15-.17.19-.29.29-.48.1-.19.05-.36-.02-.51-.07-.15-.66-1.59-.9-2.18-.24-.57-.48-.49-.66-.5h-.56c-.19 0-.51.07-.78.36-.27.29-1.03 1-1.03 2.45s1.05 2.84 1.2 3.04c.15.19 2.07 3.16 5.01 4.43.7.3 1.25.48 1.68.62.7.22 1.34.19 1.85.12.56-.08 1.72-.7 1.96-1.38.24-.68.24-1.26.17-1.38-.07-.12-.26-.19-.55-.34Z" />
    </svg>
  )
}

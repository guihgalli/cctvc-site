import { Link } from 'react-router-dom'
import { InstagramCarousel } from '../components/InstagramCarousel'
import { Layout } from '../components/Layout'
import { Logo } from '../components/Logo'

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
    description: 'Reserve tênis, futsal, vôlei e outras quadras online, com agenda em tempo real para sócios.',
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

export function HomePage() {
  return (
    <Layout>
      <section className="home-hero relative overflow-hidden text-white">
        <div className="home-hero__pattern" aria-hidden="true" />
        <div className="relative max-w-5xl mx-auto px-4 py-20 md:py-28 text-center">
          <Logo size="lg" className="mx-auto mb-6 drop-shadow-xl home-fade-up" />
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
              to="/login"
              className="bg-white text-emerald-950 px-8 py-3 rounded-lg font-semibold hover:bg-emerald-50 transition-colors"
            >
              Reservar quadra
            </Link>
            <a
              href="https://www.instagram.com/cctvelhacentral/"
              target="_blank"
              rel="noopener noreferrer"
              className="border border-emerald-300/80 text-emerald-50 px-8 py-3 rounded-lg font-semibold hover:bg-white/10 transition-colors"
            >
              Seguir no Instagram
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
          <div className="home-stat-panel">
            <div>
              <p className="font-display text-4xl md:text-5xl text-emerald-950">1900</p>
              <p className="text-stone-600 mt-1">Fundação em 1º de maio</p>
            </div>
            <div className="home-stat-panel__divider" />
            <div>
              <p className="font-display text-4xl md:text-5xl text-emerald-950">+125</p>
              <p className="text-stone-600 mt-1">Anos de tradição em Blumenau</p>
            </div>
            <div className="home-stat-panel__divider" />
            <div>
              <p className="font-display text-4xl md:text-5xl text-emerald-950">1 família</p>
              <p className="text-stone-600 mt-1">Esporte, folclore e lazer juntos</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white">
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
            {departamentos.map((item) => (
              <article key={item.title} className="home-feature">
                <h3 className="font-display text-xl text-emerald-950 mb-2">{item.title}</h3>
                <p className="text-stone-600 text-sm leading-relaxed">{item.description}</p>
              </article>
            ))}
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
              Sócios cadastrados acessam a agenda online, escolhem data e horário e garantem a reserva com
              poucos cliques.
            </p>
            <Link
              to="/login"
              className="inline-flex bg-emerald-400 text-emerald-950 px-6 py-3 rounded-lg font-semibold hover:bg-emerald-300 transition-colors"
            >
              Acessar reservas
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
            {eventos.map((evento) => (
              <article key={evento.title} className="home-event">
                <h3 className="font-display text-xl text-emerald-950 mb-2">{evento.title}</h3>
                <p className="text-stone-600 text-sm leading-relaxed">{evento.description}</p>
              </article>
            ))}
          </div>
          <p className="mt-10 text-stone-600">
            Acompanhe a agenda completa no Instagram{' '}
            <a
              href="https://www.instagram.com/cctvelhacentral/"
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

      <section className="bg-white">
        <div className="max-w-5xl mx-auto px-4 py-16 md:py-20">
          <div className="max-w-2xl mb-10">
            <p className="font-display text-emerald-800 text-sm tracking-[0.22em] uppercase mb-3">
              Visite o clube
            </p>
            <h2 className="font-display text-3xl md:text-4xl text-emerald-950 mb-4 leading-tight">
              Estamos de portas abertas na Velha Central
            </h2>
            <p className="text-stone-600 text-lg leading-relaxed">
              Quer saber como se tornar sócio ou participar de um departamento? Fale conosco.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <div>
              <h3 className="font-display text-lg text-emerald-950 mb-2">Endereço</h3>
              <p className="text-stone-600 leading-relaxed">
                Rua dos Caçadores, 3680
                <br />
                Velha Central — Blumenau/SC
                <br />
                CEP 89040-003
              </p>
            </div>
            <div>
              <h3 className="font-display text-lg text-emerald-950 mb-2">Contato</h3>
              <p className="text-stone-600 leading-relaxed">
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
                  href="https://www.instagram.com/cctvelhacentral/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-emerald-900 transition-colors"
                >
                  Instagram @cctvelhacentral
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>

      <InstagramCarousel />
    </Layout>
  )
}

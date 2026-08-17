import { useEffect, useRef, useState } from 'react'
import {
  INSTAGRAM_PROFILE_URL,
  instagramPosts,
} from '../data/instagramPosts'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { LazyImage } from './motion/LazyImage'

const AUTO_ADVANCE_MS = 4500

export function InstagramCarousel() {
  const trackRef = useRef<HTMLUListElement>(null)
  const activeIndexRef = useRef(0)
  const [activeIndex, setActiveIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const reduceMotion = usePrefersReducedMotion()

  const scrollToIndex = (index: number) => {
    const track = trackRef.current
    if (!track) return
    const clamped = (index + instagramPosts.length) % instagramPosts.length
    const slide = track.children[clamped] as HTMLElement | undefined
    if (!slide) return
    track.scrollTo({
      left: slide.offsetLeft - track.offsetLeft,
      behavior: reduceMotion ? 'auto' : 'smooth',
    })
    activeIndexRef.current = clamped
    setActiveIndex(clamped)
  }

  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    const syncActive = () => {
      const slides = Array.from(track.children) as HTMLElement[]
      if (!slides.length) return
      const center = track.scrollLeft + track.clientWidth / 2
      let closest = 0
      let closestDistance = Number.POSITIVE_INFINITY
      slides.forEach((slide, index) => {
        const slideCenter = slide.offsetLeft - track.offsetLeft + slide.clientWidth / 2
        const distance = Math.abs(center - slideCenter)
        if (distance < closestDistance) {
          closestDistance = distance
          closest = index
        }
      })
      activeIndexRef.current = closest
      setActiveIndex(closest)
    }

    track.addEventListener('scroll', syncActive, { passive: true })
    syncActive()
    return () => track.removeEventListener('scroll', syncActive)
  }, [])

  useEffect(() => {
    if (paused || reduceMotion || instagramPosts.length < 2) return
    const id = window.setInterval(() => {
      scrollToIndex(activeIndexRef.current + 1)
    }, AUTO_ADVANCE_MS)
    return () => window.clearInterval(id)
  }, [paused, reduceMotion])

  return (
    <section
      className="home-instagram"
      aria-labelledby="instagram-heading"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setPaused(false)
        }
      }}
    >
      <div className="max-w-5xl mx-auto px-4 py-16 md:py-20">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10 md:mb-12">
          <div className="max-w-2xl">
            <p className="font-display text-emerald-800 text-sm tracking-[0.22em] uppercase mb-3">
              Instagram
            </p>
            <h2
              id="instagram-heading"
              className="font-display text-3xl md:text-4xl text-emerald-950 mb-4 leading-tight"
            >
              O CCTVC em fotos
            </h2>
            <p className="text-stone-600 text-lg leading-relaxed">
              Momentos do clube no{' '}
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
          <a
            href={INSTAGRAM_PROFILE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="motion-cta inline-flex self-start md:self-auto border border-emerald-800/20 text-emerald-950 px-5 py-2.5 rounded-lg font-semibold hover:bg-emerald-950 hover:text-white transition-colors"
          >
            Ver perfil
          </a>
        </div>

        <div className="relative">
          <ul
            ref={trackRef}
            className="home-instagram__track"
            aria-label="Carrossel de fotos do Instagram"
          >
            {instagramPosts.map((post, index) => (
              <li key={post.id} className="home-instagram__slide">
                <a
                  href={post.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="home-instagram__link group"
                  aria-label={`Abrir publicação no Instagram: ${post.alt}`}
                >
                  <LazyImage
                    src={post.src}
                    alt={post.alt}
                    loading={index < 3 ? 'eager' : 'lazy'}
                    className="home-instagram__image"
                  />
                  <span className="home-instagram__overlay" aria-hidden="true">
                    Ver no Instagram
                  </span>
                </a>
              </li>
            ))}
          </ul>

          <div className="home-instagram__controls">
            <button
              type="button"
              className="home-instagram__nav"
              onClick={() => scrollToIndex(activeIndex - 1)}
              aria-label="Foto anterior"
            >
              ←
            </button>
            <div className="home-instagram__dots" role="tablist" aria-label="Selecionar foto">
              {instagramPosts.map((post, index) => (
                <button
                  key={post.id}
                  type="button"
                  role="tab"
                  aria-selected={index === activeIndex}
                  aria-label={`Ir para foto ${index + 1}`}
                  className={`home-instagram__dot${index === activeIndex ? ' is-active' : ''}`}
                  onClick={() => scrollToIndex(index)}
                />
              ))}
            </div>
            <button
              type="button"
              className="home-instagram__nav"
              onClick={() => scrollToIndex(activeIndex + 1)}
              aria-label="Próxima foto"
            >
              →
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

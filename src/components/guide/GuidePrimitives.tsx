import type { ReactNode } from 'react'

export interface GuideNavItem {
  id: string
  label: string
}

const FOCUS_LINK =
  'rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2'

export function GuideSection({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description?: string
  children: ReactNode
}) {
  const headingId = `${id}-heading`
  return (
    <section id={id} className="scroll-mt-28 guide-section" aria-labelledby={headingId}>
      <h2 id={headingId} className="font-display text-xl font-semibold text-emerald-900 mb-1 text-balance">
        {title}
      </h2>
      {description && (
        <p className="text-stone-600 text-sm mb-4 leading-relaxed max-w-prose">{description}</p>
      )}
      <div className="space-y-4">{children}</div>
    </section>
  )
}

export function GuideCard({ title, children }: { title?: string; children: ReactNode }) {
  const titleId = title ? `guide-card-${title.replace(/\s+/g, '-').toLowerCase()}` : undefined
  return (
    <div className="motion-card border border-stone-100 p-5 sm:p-6" aria-labelledby={titleId}>
      {title && (
        <h3 id={titleId} className="font-semibold text-emerald-900 mb-3">
          {title}
        </h3>
      )}
      {children}
    </div>
  )
}

export function GuideFeatureCard({
  title,
  text,
  icon,
}: {
  title: string
  text: string
  icon: ReactNode
}) {
  return (
    <div className="rounded-xl border border-stone-100 bg-white p-4 shadow-sm flex gap-3">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800"
        aria-hidden="true"
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-emerald-900 text-sm mb-1">{title}</p>
        <p className="text-stone-600 text-sm leading-relaxed">{text}</p>
      </div>
    </div>
  )
}

export function GuideSteps({ steps }: { steps: string[] }) {
  return (
    <ol className="guide-steps space-y-3">
      {steps.map((step, index) => (
        <li key={index} className="flex gap-3 text-sm text-stone-700 leading-relaxed max-w-prose">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold"
            aria-hidden="true"
          >
            {index + 1}
          </span>
          <span className="pt-1">{step}</span>
        </li>
      ))}
    </ol>
  )
}

export function GuideTable({
  caption,
  headers,
  rows,
  highlightRowIndex,
}: {
  caption?: string
  headers: string[]
  rows: string[][]
  highlightRowIndex?: number
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200">
      <table className="guide-table w-full text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="bg-emerald-50/80 text-left">
            {headers.map((header) => (
              <th
                key={header}
                scope="col"
                className="px-4 py-3 font-semibold text-emerald-900 whitespace-nowrap"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={`border-t border-stone-100 even:bg-stone-50/50 ${
                highlightRowIndex === rowIndex
                  ? 'bg-emerald-50/90 ring-1 ring-inset ring-emerald-200'
                  : ''
              }`}
              aria-current={highlightRowIndex === rowIndex ? 'true' : undefined}
            >
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-3 text-stone-700 align-top">
                  {cellIndex === 0 && highlightRowIndex === rowIndex ? (
                    <span>
                      {cell}
                      <span className="ml-2 inline-flex items-center rounded-full bg-emerald-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                        Você
                      </span>
                    </span>
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function GuideCallout({
  variant = 'info',
  title,
  children,
}: {
  variant?: 'info' | 'success' | 'warning' | 'danger'
  title?: string
  children: ReactNode
}) {
  const styles = {
    info: 'bg-blue-50 border-blue-200 text-blue-900',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
    danger: 'bg-red-50 border-red-200 text-red-900',
  }[variant]

  const role = variant === 'danger' || variant === 'warning' ? 'alert' : 'note'

  return (
    <div role={role} className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${styles}`}>
      {title && <p className="font-semibold mb-1">{title}</p>}
      <div className="max-w-prose">{children}</div>
    </div>
  )
}

export function GuideFaq({ items }: { items: { question: string; answer: string }[] }) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <details key={item.question} className="guide-faq motion-card border border-stone-100 group">
          <summary
            className={`cursor-pointer list-none px-5 py-4 min-h-11 font-medium text-emerald-900 flex items-center justify-between gap-3 ${FOCUS_LINK}`}
          >
            <span>{item.question}</span>
            <ChevronIcon />
          </summary>
          <div className="px-5 pb-4 text-sm text-stone-600 leading-relaxed border-t border-stone-100 pt-3 max-w-prose">
            {item.answer}
          </div>
        </details>
      ))}
    </div>
  )
}

export function GuideToc({ items, activeId }: { items: GuideNavItem[]; activeId?: string }) {
  return (
    <nav aria-label="Índice do guia" className="guide-toc">
      <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-3">Neste guia</p>
      <ul className="space-y-1">
        {items.map((item) => {
          const isActive = activeId === item.id
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={isActive ? 'location' : undefined}
                className={`block px-3 py-2.5 text-sm transition-colors ${FOCUS_LINK} ${
                  isActive
                    ? 'bg-emerald-100 text-emerald-900 font-medium'
                    : 'text-stone-600 hover:bg-stone-100 hover:text-emerald-900'
                }`}
              >
                {item.label}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function GuideMobileNav({
  items,
  activeId,
}: {
  items: GuideNavItem[]
  activeId?: string
}) {
  return (
    <nav
      className="lg:hidden flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory"
      aria-label="Atalhos do guia"
    >
      {items.map((item) => {
        const isActive = activeId === item.id
        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            aria-current={isActive ? 'location' : undefined}
            className={`shrink-0 snap-start rounded-full px-4 py-2.5 min-h-11 inline-flex items-center text-xs font-medium border transition-colors ${FOCUS_LINK} ${
              isActive
                ? 'bg-emerald-800 text-white border-emerald-800'
                : 'bg-white text-stone-600 border-stone-200 hover:border-emerald-300'
            }`}
          >
            {item.label}
          </a>
        )
      })}
    </nav>
  )
}

function ChevronIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="shrink-0 text-stone-400 transition-transform group-open:rotate-180 motion-safe:transition-transform"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

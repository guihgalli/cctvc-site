let lockCount = 0
let savedBodyOverflow = ''
let savedHtmlOverflow = ''

/** Impede rolagem do fundo enquanto um ou mais modais estão abertos. */
export function lockBodyScroll(): void {
  if (lockCount === 0) {
    savedBodyOverflow = document.body.style.overflow
    savedHtmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
  }
  lockCount++
}

/** Restaura a rolagem somente quando o último modal fechar. */
export function unlockBodyScroll(): void {
  if (lockCount <= 0) return
  lockCount--
  if (lockCount === 0) {
    document.body.style.overflow = savedBodyOverflow
    document.documentElement.style.overflow = savedHtmlOverflow
  }
}

/** Garante desbloqueio completo (útil em testes ou navegação). */
export function resetBodyScrollLock(): void {
  lockCount = 0
  document.body.style.overflow = savedBodyOverflow
  document.documentElement.style.overflow = savedHtmlOverflow
}

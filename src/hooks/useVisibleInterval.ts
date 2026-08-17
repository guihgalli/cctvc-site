import { useEffect, useRef } from 'react'

/**
 * Executa callback em intervalo apenas com a aba visível.
 * Ao voltar para a aba, dispara imediatamente e retoma o intervalo.
 */
export function useVisibleInterval(callback: () => void, delayMs: number, enabled = true) {
  const savedCallback = useRef(callback)

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    if (!enabled || delayMs <= 0) return

    let intervalId: number | undefined

    function tick() {
      if (document.visibilityState === 'visible') {
        savedCallback.current()
      }
    }

    function start() {
      if (intervalId !== undefined) return
      intervalId = window.setInterval(tick, delayMs)
    }

    function stop() {
      if (intervalId !== undefined) {
        window.clearInterval(intervalId)
        intervalId = undefined
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        savedCallback.current()
        start()
      } else {
        stop()
      }
    }

    if (document.visibilityState === 'visible') {
      start()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [delayMs, enabled])
}

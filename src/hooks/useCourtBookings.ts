import { useCallback, useEffect, useState } from 'react'
import { fetchBookingsByCourtAndDate } from '../services/api'
import { useVisibleInterval } from './useVisibleInterval'
import type { Reserva } from '../types'

/** Intervalo de refresh quando a aba está visível (Realtime indisponível: RLS + auth customizada). */
export const COURT_BOOKINGS_REFRESH_MS = 30_000

interface UseCourtBookingsOptions {
  enabled?: boolean
  onError?: (message: string) => void
}

export function useCourtBookings(
  quadraId: string | undefined,
  data: string | undefined,
  { enabled = true, onError }: UseCourtBookingsOptions = {}
) {
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!quadraId || !data || !enabled) return

      if (!options?.silent) setLoading(true)
      try {
        const result = await fetchBookingsByCourtAndDate(quadraId, data)
        setReservas(result)
      } catch {
        if (!options?.silent) onError?.('Erro ao carregar horários.')
      } finally {
        if (!options?.silent) setLoading(false)
      }
    },
    [quadraId, data, enabled, onError]
  )

  useEffect(() => {
    refresh()
  }, [refresh])

  useVisibleInterval(
    () => {
      refresh({ silent: true })
    },
    COURT_BOOKINGS_REFRESH_MS,
    enabled && !!quadraId && !!data
  )

  return { reservas, loading, refresh }
}

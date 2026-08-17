import { useCallback, useEffect, useState } from 'react'
import { fetchUserBookings } from '../services/api'
import type { Reserva } from '../types'

interface UseMyBookingsOptions {
  onError?: (message: string) => void
}

export function useMyBookings(userId: string | undefined, { onError }: UseMyBookingsOptions = {}) {
  const [minhasReservas, setMinhasReservas] = useState<Reserva[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!userId) {
      setMinhasReservas([])
      return
    }

    setLoading(true)
    try {
      const data = await fetchUserBookings(userId)
      setMinhasReservas(data)
    } catch {
      onError?.('Erro ao carregar suas reservas.')
    } finally {
      setLoading(false)
    }
  }, [userId, onError])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { minhasReservas, loading, refresh }
}

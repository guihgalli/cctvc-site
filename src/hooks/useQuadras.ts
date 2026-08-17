import { useCallback, useEffect, useState } from 'react'
import { fetchCourts } from '../services/api'
import { BOOKING_DATE_RANGE_DAYS, generateDateRange, todayIsoDate } from '../lib/utils'
import { diaDisponivel, proximaDataDisponivel } from '../lib/bookingSchedule'
import type { Quadra } from '../types'

interface UseQuadrasOptions {
  onError?: (message: string) => void
}

export function useQuadras({ onError }: UseQuadrasOptions = {}) {
  const [quadras, setQuadras] = useState<Quadra[]>([])
  const [quadraSelecionada, setQuadraSelecionada] = useState<Quadra | null>(null)
  const [dataSelecionada, setDataSelecionada] = useState(todayIsoDate)
  const [loading, setLoading] = useState(true)

  const datasDisponiveis = generateDateRange(BOOKING_DATE_RANGE_DAYS)

  const selecionarProximaData = useCallback(
    (quadra: Quadra | null, dataAtual: string) => {
      if (!quadra || diaDisponivel(quadra, dataAtual)) return dataAtual
      return proximaDataDisponivel(quadra, datasDisponiveis) ?? dataAtual
    },
    [datasDisponiveis]
  )

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const data = await fetchCourts()
        if (cancelled) return

        setQuadras(data)
        if (data.length > 0) {
          const primeira = data[0]
          setQuadraSelecionada(primeira)
          setDataSelecionada((atual) => selecionarProximaData(primeira, atual))
        }
      } catch {
        if (!cancelled) onError?.('Erro ao carregar quadras.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [onError, selecionarProximaData])

  useEffect(() => {
    if (!quadraSelecionada) return
    const proxima = selecionarProximaData(quadraSelecionada, dataSelecionada)
    if (proxima !== dataSelecionada) setDataSelecionada(proxima)
  }, [quadraSelecionada, dataSelecionada, selecionarProximaData])

  return {
    quadras,
    quadraSelecionada,
    setQuadraSelecionada,
    dataSelecionada,
    setDataSelecionada,
    datasDisponiveis,
    loading,
  }
}

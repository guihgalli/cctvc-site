import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchCourts } from '../services/api'
import { generateBookableDates } from '../lib/bookingRules'
import { todayIsoDate } from '../lib/utils'
import { diaDisponivel, proximaDataDisponivel } from '../lib/bookingSchedule'
import type { AuthUser, Quadra, TipoQuadra } from '../types'

interface UseQuadrasOptions {
  user?: AuthUser | null
  onError?: (message: string) => void
}

function quadraVisivelParaUsuario(quadra: Quadra, user: AuthUser | null | undefined): boolean {
  if (!user || user.perfil === 'admin') return true
  const tipo: TipoQuadra = quadra.tipo_quadra ?? 'geral'
  if (tipo === 'geral') return true
  if (user.tipo_socio === 'nao_socio') return tipo === 'locacao'
  if (user.tipo_socio === 'socio') return tipo === 'socio'
  return true
}

export function useQuadras({ user, onError }: UseQuadrasOptions = {}) {
  const [quadras, setQuadras] = useState<Quadra[]>([])
  const [quadraSelecionada, setQuadraSelecionada] = useState<Quadra | null>(null)
  const [dataSelecionada, setDataSelecionada] = useState(todayIsoDate)
  const [loading, setLoading] = useState(true)

  const datasDisponiveis = useMemo(() => generateBookableDates(14), [])

  const quadrasFiltradas = useMemo(
    () => quadras.filter((q) => quadraVisivelParaUsuario(q, user)),
    [quadras, user]
  )

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
        const visiveis = data.filter((q) => quadraVisivelParaUsuario(q, user))
        if (visiveis.length > 0) {
          const primeira = visiveis[0]
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
  }, [onError, selecionarProximaData, user])

  useEffect(() => {
    if (!quadraSelecionada) return
    const aindaVisivel = quadrasFiltradas.some((q) => q.id === quadraSelecionada.id)
    if (!aindaVisivel && quadrasFiltradas.length > 0) {
      setQuadraSelecionada(quadrasFiltradas[0])
    }
  }, [quadrasFiltradas, quadraSelecionada])

  useEffect(() => {
    if (!quadraSelecionada) return
    const proxima = selecionarProximaData(quadraSelecionada, dataSelecionada)
    if (proxima !== dataSelecionada) setDataSelecionada(proxima)
  }, [quadraSelecionada, dataSelecionada, selecionarProximaData])

  return {
    quadras: quadrasFiltradas,
    quadraSelecionada,
    setQuadraSelecionada,
    dataSelecionada,
    setDataSelecionada,
    datasDisponiveis,
    loading,
  }
}

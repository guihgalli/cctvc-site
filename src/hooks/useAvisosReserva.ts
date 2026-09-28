import { useEffect, useState } from 'react'
import { fetchAvisosReserva } from '../services/api'
import type { AvisosReserva } from '../types'

const VAZIO: AvisosReserva = { mensagem_locacao: null, promocoes: [] }

/** Falhas de carregamento caem no texto padrão sem bloquear a tela de reservas */
export function useAvisosReserva(): AvisosReserva {
  const [avisos, setAvisos] = useState<AvisosReserva>(VAZIO)

  useEffect(() => {
    let ativo = true
    fetchAvisosReserva()
      .then((data) => {
        if (ativo) setAvisos(data)
      })
      .catch(() => {
        if (ativo) setAvisos(VAZIO)
      })
    return () => {
      ativo = false
    }
  }, [])

  return avisos
}

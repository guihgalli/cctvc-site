import { useCallback, useEffect, useState } from 'react'
import { searchSocios } from '../services/api'
import type { Usuario } from '../types'
import { Modal } from './motion/Modal'
import { Button } from './motion/Button'
import { labelCategoriaSocio } from '../lib/bookingRules'

interface ParticipantesReservaModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (participanteIds: string[]) => void
  loading?: boolean
}

export function ParticipantesReservaModal({
  open,
  onClose,
  onConfirm,
  loading = false,
}: ParticipantesReservaModalProps) {
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<
    Pick<Usuario, 'id' | 'codigo_usuario' | 'nome' | 'categoria_socio'>[]
  >([])
  const [selecionados, setSelecionados] = useState<
    Pick<Usuario, 'id' | 'codigo_usuario' | 'nome' | 'categoria_socio'>[]
  >([])
  const [buscando, setBuscando] = useState(false)

  useEffect(() => {
    if (!open) {
      setBusca('')
      setResultados([])
      setSelecionados([])
    }
  }, [open])

  useEffect(() => {
    if (!open || busca.trim().length < 2) {
      setResultados([])
      return
    }

    const timer = window.setTimeout(async () => {
      setBuscando(true)
      try {
        const data = await searchSocios(busca.trim())
        setResultados(data)
      } catch {
        setResultados([])
      } finally {
        setBuscando(false)
      }
    }, 300)

    return () => window.clearTimeout(timer)
  }, [busca, open])

  const toggleParticipante = useCallback(
    (socio: Pick<Usuario, 'id' | 'codigo_usuario' | 'nome' | 'categoria_socio'>) => {
      setSelecionados((prev) => {
        if (prev.some((p) => p.id === socio.id)) {
          return prev.filter((p) => p.id !== socio.id)
        }
        return [...prev, socio]
      })
    },
    []
  )

  function handleConfirm() {
    onConfirm(selecionados.map((p) => p.id))
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="participantes-title" maxWidth="lg">
      <h2 id="participantes-title" className="text-xl font-bold text-emerald-900 mb-2">
        Quem vai jogar?
      </h2>
      <p className="text-sm text-stone-500 mb-4">
        Opcional — busque sócios titulares ou dependentes pelo nome ou matrícula.
      </p>

      <input
        type="search"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Nome ou matrícula (mín. 2 caracteres)"
        className="w-full border border-stone-300 rounded-lg px-3 py-2 mb-3 focus:ring-2 focus:ring-emerald-500 outline-none"
      />

      {selecionados.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {selecionados.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => toggleParticipante(p)}
              className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
            >
              {p.nome} ({p.codigo_usuario}) ×
            </button>
          ))}
        </div>
      )}

      <div className="max-h-48 overflow-y-auto border border-stone-200 rounded-lg mb-4">
        {buscando && <p className="p-3 text-sm text-stone-400">Buscando...</p>}
        {!buscando && busca.trim().length >= 2 && resultados.length === 0 && (
          <p className="p-3 text-sm text-stone-400">Nenhum sócio encontrado.</p>
        )}
        {resultados.map((socio) => {
          const ativo = selecionados.some((p) => p.id === socio.id)
          return (
            <button
              key={socio.id}
              type="button"
              onClick={() => toggleParticipante(socio)}
              className={`w-full text-left px-3 py-2 text-sm border-b last:border-0 hover:bg-stone-50 ${
                ativo ? 'bg-emerald-50' : ''
              }`}
            >
              <span className="font-medium">{socio.nome}</span>
              <span className="text-stone-500 ml-2 font-mono text-xs">{socio.codigo_usuario}</span>
              <span className="text-stone-400 ml-2 text-xs">
                {labelCategoriaSocio(socio.categoria_socio)}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-col-reverse sm:flex-row gap-3">
        <Button variant="ghost" size="lg" className="w-full sm:w-auto" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          size="lg"
          className="flex-1"
          loading={loading}
          loadingText="Reservando..."
          onClick={handleConfirm}
        >
          Confirmar reserva
        </Button>
      </div>
    </Modal>
  )
}

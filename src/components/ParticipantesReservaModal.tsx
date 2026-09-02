import { useCallback, useEffect, useState } from 'react'
import { fetchFamilyWeeklyBookingCount, searchParticipantesReserva } from '../services/api'
import type { Usuario } from '../types'
import { Modal } from './motion/Modal'
import { Button } from './motion/Button'
import { ReservaSlotResumo } from './ReservaSlotResumo'
import {
  descricaoUsuarioReserva,
  LIMITE_RESERVAS_FAMILIA_SEMANA,
  mensagemLimiteSemanalFamilia,
} from '../lib/bookingRules'

type ParticipanteResumo = Pick<
  Usuario,
  'id' | 'codigo_usuario' | 'nome' | 'categoria_socio' | 'tipo_socio'
> & { eh_dependente?: boolean }

interface ParticipantesReservaModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (participanteIds: string[]) => void
  loading?: boolean
  limiteAtingido?: boolean
  quadraNome?: string
  dataReserva?: string
  horaInicio?: string
  horaFim?: string
}

function ParticipanteItem({
  usuario,
  selecionado,
  onToggle,
}: {
  usuario: ParticipanteResumo
  selecionado: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full text-left px-3 py-2 text-sm border-b last:border-0 hover:bg-stone-50 ${
        selecionado ? 'bg-emerald-50' : ''
      }`}
    >
      <span className="font-medium">{usuario.nome}</span>
      {usuario.codigo_usuario && (
        <span className="text-stone-500 ml-2 font-mono text-xs">{usuario.codigo_usuario}</span>
      )}
      <span className="text-stone-400 ml-2 text-xs">{descricaoUsuarioReserva(usuario)}</span>
      {usuario.eh_dependente && (
        <span className="ml-2 text-xs text-emerald-700 font-medium">Dependente</span>
      )}
    </button>
  )
}

export function ParticipantesReservaModal({
  open,
  onClose,
  onConfirm,
  loading = false,
  limiteAtingido: limiteAtingidoProp = false,
  quadraNome,
  dataReserva,
  horaInicio,
  horaFim,
}: ParticipantesReservaModalProps) {
  const [busca, setBusca] = useState('')
  const [dependentes, setDependentes] = useState<ParticipanteResumo[]>([])
  const [resultadosBusca, setResultadosBusca] = useState<ParticipanteResumo[]>([])
  const [selecionados, setSelecionados] = useState<ParticipanteResumo[]>([])
  const [carregando, setCarregando] = useState(false)
  const [reservasFamiliaSemana, setReservasFamiliaSemana] = useState<number | null>(null)
  const [verificandoLimite, setVerificandoLimite] = useState(false)

  useEffect(() => {
    if (!open) {
      setBusca('')
      setDependentes([])
      setResultadosBusca([])
      setSelecionados([])
      setReservasFamiliaSemana(null)
    }
  }, [open])

  useEffect(() => {
    if (!open || !dataReserva) {
      setReservasFamiliaSemana(null)
      return
    }

    let cancelled = false
    setVerificandoLimite(true)

    fetchFamilyWeeklyBookingCount(dataReserva)
      .then((count) => {
        if (!cancelled) setReservasFamiliaSemana(count)
      })
      .catch(() => {
        if (!cancelled) setReservasFamiliaSemana(null)
      })
      .finally(() => {
        if (!cancelled) setVerificandoLimite(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, dataReserva])

  useEffect(() => {
    if (!open) return

    const termo = busca.trim()
    let cancelled = false

    const timer = window.setTimeout(async () => {
      setCarregando(true)
      try {
        const data = await searchParticipantesReserva(termo)
        if (cancelled) return
        if (termo.length < 2) {
          setDependentes(data)
          setResultadosBusca([])
        } else {
          setDependentes([])
          setResultadosBusca(data)
        }
      } catch {
        if (!cancelled) {
          setDependentes([])
          setResultadosBusca([])
        }
      } finally {
        if (!cancelled) setCarregando(false)
      }
    }, termo.length >= 2 ? 300 : 0)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [busca, open])

  const toggleParticipante = useCallback((usuario: ParticipanteResumo) => {
    setSelecionados((prev) => {
      if (prev.some((p) => p.id === usuario.id)) {
        return prev.filter((p) => p.id !== usuario.id)
      }
      return [...prev, usuario]
    })
  }, [])

  function handleConfirm() {
    if (limiteAtingido) return
    onConfirm(selecionados.map((p) => p.id))
  }

  const listaVisivel = busca.trim().length >= 2 ? resultadosBusca : dependentes
  const mostrandoDependentes = busca.trim().length < 2
  const limiteAtingidoLocal =
    reservasFamiliaSemana !== null && reservasFamiliaSemana >= LIMITE_RESERVAS_FAMILIA_SEMANA
  const limiteAtingido = limiteAtingidoProp || limiteAtingidoLocal

  return (
    <Modal open={open} onClose={onClose} labelledBy="participantes-title" maxWidth="lg">
      <h2 id="participantes-title" className="text-xl font-bold text-emerald-900 mb-2">
        Quem vai jogar?
      </h2>
      <p className="text-sm text-stone-500 mb-4">
        Opcional — seus dependentes aparecem primeiro. Você também pode buscar qualquer usuário
        cadastrado pelo nome, matrícula ou CPF.
      </p>

      {quadraNome && dataReserva && horaInicio && horaFim && (
        <ReservaSlotResumo
          quadraNome={quadraNome}
          dataReserva={dataReserva}
          horaInicio={horaInicio}
          horaFim={horaFim}
          className="mb-4"
        />
      )}

      {limiteAtingido && (
        <p
          role="alert"
          className="text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm mb-4"
        >
          {mensagemLimiteSemanalFamilia()}
        </p>
      )}

      <input
        type="search"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Nome, matrícula ou CPF (mín. 2 caracteres para buscar)"
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
              {p.nome}
              {p.codigo_usuario ? ` (${p.codigo_usuario})` : ''} ×
            </button>
          ))}
        </div>
      )}

      <div className="max-h-48 overflow-y-auto border border-stone-200 rounded-lg mb-4">
        {carregando && <p className="p-3 text-sm text-stone-400">Carregando...</p>}
        {!carregando && mostrandoDependentes && listaVisivel.length === 0 && (
          <p className="p-3 text-sm text-stone-400">
            Nenhum dependente cadastrado. Use a busca para encontrar outros participantes.
          </p>
        )}
        {!carregando && !mostrandoDependentes && listaVisivel.length === 0 && (
          <p className="p-3 text-sm text-stone-400">Nenhum usuário encontrado.</p>
        )}
        {mostrandoDependentes && listaVisivel.length > 0 && (
          <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-stone-500 bg-stone-50 border-b">
            Seus dependentes
          </p>
        )}
        {listaVisivel.map((usuario) => (
          <ParticipanteItem
            key={usuario.id}
            usuario={usuario}
            selecionado={selecionados.some((p) => p.id === usuario.id)}
            onToggle={() => toggleParticipante(usuario)}
          />
        ))}
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
          disabled={limiteAtingido || verificandoLimite}
          onClick={handleConfirm}
        >
          Confirmar reserva
        </Button>
      </div>
    </Modal>
  )
}
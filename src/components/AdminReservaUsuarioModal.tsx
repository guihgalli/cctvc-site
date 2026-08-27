import { useCallback, useEffect, useState } from 'react'
import { adminSearchUsers } from '../services/api'
import type { TipoSocio, Usuario } from '../types'
import { Modal } from './motion/Modal'
import { Button } from './motion/Button'
import { ReservaSlotResumo } from './ReservaSlotResumo'
import { labelCategoriaSocio } from '../lib/bookingRules'

type UsuarioResumo = Pick<
  Usuario,
  'id' | 'codigo_usuario' | 'nome' | 'categoria_socio' | 'tipo_socio' | 'ativo'
>

interface AdminReservaUsuarioModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (usuarioId: string, participanteIds: string[], nomeUsuario: string) => void
  loading?: boolean
  quadraNome?: string
  dataReserva?: string
  horaInicio?: string
  horaFim?: string
}

function labelTipoUsuario(tipo: TipoSocio | undefined): string {
  if (tipo === 'nao_socio') return 'Visitante'
  return 'Sócio'
}

function descricaoUsuario(usuario: UsuarioResumo): string {
  if (usuario.tipo_socio === 'socio') {
    return labelCategoriaSocio(usuario.categoria_socio)
  }
  return labelTipoUsuario(usuario.tipo_socio)
}

export function AdminReservaUsuarioModal({
  open,
  onClose,
  onConfirm,
  loading = false,
  quadraNome,
  dataReserva,
  horaInicio,
  horaFim,
}: AdminReservaUsuarioModalProps) {
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<UsuarioResumo[]>([])
  const [reservante, setReservante] = useState<UsuarioResumo | null>(null)
  const [participantes, setParticipantes] = useState<UsuarioResumo[]>([])
  const [buscando, setBuscando] = useState(false)

  useEffect(() => {
    if (!open) {
      setBusca('')
      setResultados([])
      setReservante(null)
      setParticipantes([])
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
        const data = await adminSearchUsers(busca.trim())
        setResultados(data)
      } catch {
        setResultados([])
      } finally {
        setBuscando(false)
      }
    }, 300)

    return () => window.clearTimeout(timer)
  }, [busca, open])

  const selecionarReservante = useCallback((usuario: UsuarioResumo) => {
    setReservante(usuario)
    setParticipantes((prev) => prev.filter((p) => p.id !== usuario.id))
  }, [])

  const toggleParticipante = useCallback(
    (usuario: UsuarioResumo) => {
      if (reservante?.id === usuario.id) return
      setParticipantes((prev) => {
        if (prev.some((p) => p.id === usuario.id)) {
          return prev.filter((p) => p.id !== usuario.id)
        }
        return [...prev, usuario]
      })
    },
    [reservante?.id]
  )

  function handleConfirm() {
    if (!reservante) return
    onConfirm(
      reservante.id,
      participantes.map((p) => p.id),
      reservante.nome
    )
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="admin-reserva-title" maxWidth="lg">
      <h2 id="admin-reserva-title" className="text-xl font-bold text-emerald-900 mb-2">
        Reserva para qual usuário?
      </h2>
      <p className="text-sm text-stone-500 mb-4">
        Busque pelo nome, matrícula ou CPF. A reserva será registrada em nome do usuário selecionado.
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

      <input
        type="search"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Nome, matrícula ou CPF (mín. 2 caracteres)"
        className="w-full border border-stone-300 rounded-lg px-3 py-2 mb-3 focus:ring-2 focus:ring-emerald-500 outline-none"
      />

      {reservante && (
        <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 mb-1">
            Reservante
          </p>
          <p className="text-sm font-medium text-emerald-900">
            {reservante.nome}
            {reservante.codigo_usuario && (
              <span className="text-stone-500 ml-2 font-mono text-xs">{reservante.codigo_usuario}</span>
            )}
            <span className="text-stone-500 ml-2 text-xs">{descricaoUsuario(reservante)}</span>
          </p>
        </div>
      )}

      {participantes.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {participantes.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => toggleParticipante(p)}
              className="text-xs px-2 py-1 rounded-full bg-stone-100 text-stone-700 hover:bg-stone-200"
            >
              {p.nome} ×
            </button>
          ))}
        </div>
      )}

      <div className="max-h-48 overflow-y-auto border border-stone-200 rounded-lg mb-4">
        {buscando && <p className="p-3 text-sm text-stone-400">Buscando...</p>}
        {!buscando && busca.trim().length >= 2 && resultados.length === 0 && (
          <p className="p-3 text-sm text-stone-400">Nenhum usuário encontrado.</p>
        )}
        {resultados.map((usuario) => {
          const ehReservante = reservante?.id === usuario.id
          const ehParticipante = participantes.some((p) => p.id === usuario.id)
          return (
            <div
              key={usuario.id}
              className={`flex items-center gap-2 px-3 py-2 text-sm border-b last:border-0 ${
                ehReservante ? 'bg-emerald-50' : ''
              }`}
            >
              <div className="flex-1 min-w-0">
                <span className="font-medium">{usuario.nome}</span>
                {usuario.codigo_usuario && (
                  <span className="text-stone-500 ml-2 font-mono text-xs">{usuario.codigo_usuario}</span>
                )}
                <span className="text-stone-400 ml-2 text-xs">{descricaoUsuario(usuario)}</span>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => selecionarReservante(usuario)}
                  className={`text-xs px-2 py-1 rounded font-medium ${
                    ehReservante
                      ? 'bg-emerald-700 text-white'
                      : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                  }`}
                >
                  {ehReservante ? 'Selecionado' : 'Reservar'}
                </button>
                {!ehReservante && (
                  <button
                    type="button"
                    onClick={() => toggleParticipante(usuario)}
                    className={`text-xs px-2 py-1 rounded font-medium ${
                      ehParticipante
                        ? 'bg-stone-600 text-white'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    {ehParticipante ? 'Participante' : '+ Participante'}
                  </button>
                )}
              </div>
            </div>
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
          disabled={!reservante}
          onClick={handleConfirm}
        >
          Confirmar reserva
        </Button>
      </div>
    </Modal>
  )
}

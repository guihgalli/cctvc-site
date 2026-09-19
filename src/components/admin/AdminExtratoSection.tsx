import { useCallback, useEffect, useState } from 'react'
import {
  addExtratoDestinatario,
  deleteExtratoDestinatario,
  dispararExtratoDiario,
  fetchExtratoDestinatarios,
  fetchExtratoEnviosLog,
  updateExtratoDestinatario,
} from '../../services/api'
import { formatDate, getErrorMessage, isValidEmail } from '../../lib/utils'
import type { ExtratoDestinatario, ExtratoEnvioLog } from '../../types'

interface AdminExtratoSectionProps {
  onMessage: (message: { type: 'success' | 'error'; text: string }) => void
}

export function AdminExtratoSection({ onMessage }: AdminExtratoSectionProps) {
  const [destinatarios, setDestinatarios] = useState<ExtratoDestinatario[]>([])
  const [logs, setLogs] = useState<ExtratoEnvioLog[]>([])
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [emailNovo, setEmailNovo] = useState('')
  const [nomeNovo, setNomeNovo] = useState('')
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [lista, historico] = await Promise.all([
        fetchExtratoDestinatarios(),
        fetchExtratoEnviosLog(15),
      ])
      setDestinatarios(lista)
      setLogs(historico)
    } catch (err) {
      onMessage({ type: 'error', text: getErrorMessage(err, 'Erro ao carregar extrato.') })
    } finally {
      setLoading(false)
    }
  }, [onMessage])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function handleAdicionar(e: React.FormEvent) {
    e.preventDefault()
    const email = emailNovo.trim()
    if (!isValidEmail(email)) {
      onMessage({ type: 'error', text: 'Informe um e-mail válido.' })
      return
    }

    setSalvando(true)
    try {
      await addExtratoDestinatario(email, nomeNovo.trim() || undefined)
      setEmailNovo('')
      setNomeNovo('')
      onMessage({ type: 'success', text: 'Destinatário adicionado.' })
      await carregar()
    } catch (err) {
      onMessage({ type: 'error', text: getErrorMessage(err, 'Erro ao adicionar destinatário.') })
    } finally {
      setSalvando(false)
    }
  }

  async function toggleAtivo(item: ExtratoDestinatario) {
    try {
      await updateExtratoDestinatario(item.id, { ativo: !item.ativo })
      await carregar()
    } catch (err) {
      onMessage({ type: 'error', text: getErrorMessage(err, 'Erro ao atualizar destinatário.') })
    }
  }

  async function handleExcluir(item: ExtratoDestinatario) {
    if (!window.confirm(`Remover ${item.email} da lista de extrato?`)) return
    try {
      await deleteExtratoDestinatario(item.id)
      onMessage({ type: 'success', text: 'Destinatário removido.' })
      await carregar()
    } catch (err) {
      onMessage({ type: 'error', text: getErrorMessage(err, 'Erro ao excluir destinatário.') })
    }
  }

  async function handleEnviarAgora() {
    setEnviando(true)
    try {
      const result = await dispararExtratoDiario()
      if (result.skipped) {
        onMessage({
          type: 'error',
          text: result.reason || 'Nenhum destinatário ativo para envio.',
        })
      } else {
        onMessage({
          type: 'success',
          text: `Extrato enviado para ${result.destinatarios ?? 0} destinatário(s) (${result.reservas ?? 0} reserva(s) no período).`,
        })
      }
      await carregar()
    } catch (err) {
      onMessage({ type: 'error', text: getErrorMessage(err, 'Erro ao enviar extrato.') })
    } finally {
      setEnviando(false)
    }
  }

  if (loading) {
    return (
      <div className="motion-card border border-stone-200 p-8 text-center text-stone-500">
        Carregando extrato…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm leading-relaxed">
        <strong>Extrato diário por e-mail.</strong> Todos os dias às{' '}
        <strong>08:00</strong> (horário de Brasília), o sistema envia a lista de reservas{' '}
        <strong>pendentes e confirmadas</strong> para os próximos <strong>3 dias</strong> (hoje + 2
        dias). Cadastre abaixo quem deve receber.
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-stone-700">Destinatários</h2>
        <button
          type="button"
          onClick={handleEnviarAgora}
          disabled={enviando}
          className="bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-800 disabled:opacity-60 min-h-[44px]"
        >
          {enviando ? 'Enviando…' : 'Enviar agora (teste)'}
        </button>
      </div>

      <form
        onSubmit={handleAdicionar}
        className="motion-card border border-stone-200 p-4 grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end"
      >
        <div>
          <label htmlFor="extrato-email" className="block text-sm font-medium mb-1">
            E-mail
          </label>
          <input
            id="extrato-email"
            type="email"
            value={emailNovo}
            onChange={(e) => setEmailNovo(e.target.value)}
            className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm"
            placeholder="secretaria@exemplo.com"
            required
          />
        </div>
        <div>
          <label htmlFor="extrato-nome" className="block text-sm font-medium mb-1">
            Nome (opcional)
          </label>
          <input
            id="extrato-nome"
            type="text"
            value={nomeNovo}
            onChange={(e) => setNomeNovo(e.target.value)}
            className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Secretaria"
          />
        </div>
        <button
          type="submit"
          disabled={salvando}
          className="bg-stone-800 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-stone-900 disabled:opacity-60 min-h-[44px]"
        >
          {salvando ? 'Salvando…' : 'Adicionar'}
        </button>
      </form>

      {destinatarios.length === 0 ? (
        <div className="motion-card border border-stone-200 p-6 text-stone-500 text-sm">
          Nenhum destinatário cadastrado. O envio automático ficará inativo até incluir pelo menos um
          e-mail ativo.
        </div>
      ) : (
        <div className="motion-card border border-stone-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-stone-600">
              <tr>
                <th className="text-left px-4 py-2 font-medium">E-mail</th>
                <th className="text-left px-4 py-2 font-medium hidden sm:table-cell">Nome</th>
                <th className="text-left px-4 py-2 font-medium">Ativo</th>
                <th className="text-right px-4 py-2 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {destinatarios.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-3">{d.email}</td>
                  <td className="px-4 py-3 hidden sm:table-cell text-stone-500">{d.nome || '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleAtivo(d)}
                      className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        d.ativo
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-stone-100 text-stone-500'
                      }`}
                    >
                      {d.ativo ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleExcluir(d)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div>
        <h3 className="font-semibold text-stone-700 mb-3">Últimos envios</h3>
        {logs.length === 0 ? (
          <p className="text-sm text-stone-500">Ainda não há registros de envio.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {logs.map((log) => (
              <li
                key={log.id}
                className={`motion-card border px-4 py-3 ${
                  log.ok ? 'border-stone-200' : 'border-red-200 bg-red-50/50'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <span className="font-medium text-stone-800">
                    {new Date(log.enviado_em).toLocaleString('pt-BR', {
                      timeZone: 'America/Sao_Paulo',
                    })}
                  </span>
                  <span className={log.ok ? 'text-emerald-700' : 'text-red-700'}>
                    {log.ok ? 'OK' : 'Falha'}
                  </span>
                </div>
                <p className="text-stone-600 mt-1">
                  {log.qtd_reservas} reserva(s) · {log.destinatarios?.length ?? 0} destinatário(s)
                  {log.periodo_inicio && log.periodo_fim && (
                    <>
                      {' '}
                      · {formatDate(log.periodo_inicio)} a {formatDate(log.periodo_fim)}
                    </>
                  )}
                </p>
                {!log.ok && log.erro && (
                  <p className="text-red-700 text-xs mt-1 break-words">{log.erro}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

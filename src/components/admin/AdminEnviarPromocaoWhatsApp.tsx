import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react'
import { fetchUsers } from '../../services/api'
import {
  buildMensagemPromocaoWhatsApp,
  filtrarContatosWhatsApp,
  formatarTelefoneContato,
  LABEL_FILTRO_PUBLICO,
  listarContatosWhatsApp,
  type ContatoWhatsApp,
  type FiltroPublicoContato,
} from '../../lib/promocaoWhatsApp'
import { buildWhatsAppUrlToNumber, getErrorMessage } from '../../lib/utils'
import type { Promocao, Quadra } from '../../types'

interface AdminEnviarPromocaoWhatsAppProps {
  promocoes: Promocao[]
  quadras: Quadra[]
  promocaoInicialId?: string | null
  onMessage: (message: { type: 'success' | 'error'; text: string }) => void
}

const inputClass =
  'w-full border border-stone-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:border-emerald-500'

function WhatsAppIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.52 3.48A11.86 11.86 0 0 0 12.04 0C5.5 0 .2 5.3.2 11.84c0 2.09.55 4.12 1.6 5.92L0 24l6.4-1.68a11.8 11.8 0 0 0 5.64 1.44h.01c6.54 0 11.84-5.3 11.84-11.84 0-3.16-1.23-6.13-3.37-8.44ZM12.05 21.5h-.01a9.67 9.67 0 0 1-4.93-1.35l-.35-.21-3.8 1 1.01-3.7-.23-.38a9.66 9.66 0 0 1-1.48-5.16c0-5.34 4.35-9.68 9.7-9.68 2.59 0 5.02 1.01 6.85 2.84a9.62 9.62 0 0 1 2.84 6.85c0 5.34-4.35 9.79-9.6 9.79Zm5.3-7.25c-.29-.15-1.72-.85-1.99-.94-.27-.1-.46-.15-.66.14-.19.29-.76.94-.93 1.14-.17.19-.34.22-.63.07-.29-.15-1.23-.45-2.34-1.44-.86-.77-1.44-1.72-1.61-2.01-.17-.29-.02-.45.13-.6.13-.13.29-.34.43-.51.15-.17.19-.29.29-.48.1-.19.05-.36-.02-.51-.07-.15-.66-1.59-.9-2.18-.24-.57-.48-.49-.66-.5h-.56c-.19 0-.51.07-.78.36-.27.29-1.03 1-1.03 2.45s1.05 2.84 1.2 3.04c.15.19 2.07 3.16 5.01 4.43.7.3 1.25.48 1.68.62.7.22 1.34.19 1.85.12.56-.08 1.72-.7 1.96-1.38.24-.68.24-1.26.17-1.38-.07-.12-.26-.19-.55-.34Z" />
    </svg>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`cursor-pointer min-h-[40px] px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors duration-200 ${
        active
          ? 'bg-emerald-700 text-white border-emerald-700'
          : 'bg-white text-stone-700 border-stone-300 hover:border-emerald-400 hover:bg-emerald-50'
      }`}
    >
      {children}
    </button>
  )
}

export function AdminEnviarPromocaoWhatsApp({
  promocoes,
  quadras,
  promocaoInicialId = null,
  onMessage,
}: AdminEnviarPromocaoWhatsAppProps) {
  const promocoesAtivas = useMemo(
    () => promocoes.filter((p) => p.ativo),
    [promocoes]
  )

  const [promocaoId, setPromocaoId] = useState(
    () => promocaoInicialId ?? promocoesAtivas[0]?.id ?? ''
  )
  const [publico, setPublico] = useState<FiltroPublicoContato>('todos')
  const [busca, setBusca] = useState('')
  const buscaDeferred = useDeferredValue(busca)
  const [mensagem, setMensagem] = useState('')
  const [mensagemEditada, setMensagemEditada] = useState(false)
  const [contatos, setContatos] = useState<ContatoWhatsApp[]>([])
  const [loadingContatos, setLoadingContatos] = useState(true)
  const [selecionados, setSelecionados] = useState<Set<string>>(() => new Set())
  const [filaIds, setFilaIds] = useState<string[]>([])
  const [indiceFila, setIndiceFila] = useState(0)
  const [copiado, setCopiado] = useState(false)

  const promocao = useMemo(
    () => promocoes.find((p) => p.id === promocaoId) ?? null,
    [promocoes, promocaoId]
  )

  const nomeQuadra = useMemo(() => {
    if (!promocao?.quadra_id) return null
    return quadras.find((q) => q.id === promocao.quadra_id)?.nome ?? 'Quadra removida'
  }, [promocao, quadras])

  useEffect(() => {
    if (promocaoInicialId && promocoes.some((p) => p.id === promocaoInicialId)) {
      setPromocaoId(promocaoInicialId)
    }
  }, [promocaoInicialId, promocoes])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadingContatos(true)
      try {
        const usuarios = await fetchUsers()
        if (!cancelled) setContatos(listarContatosWhatsApp(usuarios))
      } catch (err) {
        if (!cancelled) {
          onMessage({
            type: 'error',
            text: getErrorMessage(err, 'Erro ao carregar contatos com WhatsApp.'),
          })
        }
      } finally {
        if (!cancelled) setLoadingContatos(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [onMessage])

  useEffect(() => {
    if (!promocao || mensagemEditada) return
    setMensagem(buildMensagemPromocaoWhatsApp(promocao, { nomeQuadra }))
  }, [promocao, nomeQuadra, mensagemEditada])

  useEffect(() => {
    if (!promocao) return
    setPublico(promocao.publico)
    setMensagemEditada(false)
    setSelecionados(new Set())
    setFilaIds([])
    setIndiceFila(0)
  }, [promocao?.id])

  const filtrados = useMemo(
    () => filtrarContatosWhatsApp(contatos, { publico, busca: buscaDeferred }),
    [contatos, publico, buscaDeferred]
  )

  const idsFiltrados = useMemo(() => filtrados.map((c) => c.id), [filtrados])
  const todosFiltradosSelecionados =
    idsFiltrados.length > 0 && idsFiltrados.every((id) => selecionados.has(id))
  const qtdSelecionados = selecionados.size

  const contatoPorId = useMemo(() => {
    const map = new Map<string, ContatoWhatsApp>()
    for (const c of contatos) map.set(c.id, c)
    return map
  }, [contatos])

  function toggleUm(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleTodosFiltrados() {
    setSelecionados((prev) => {
      const next = new Set(prev)
      if (todosFiltradosSelecionados) {
        for (const id of idsFiltrados) next.delete(id)
      } else {
        for (const id of idsFiltrados) next.add(id)
      }
      return next
    })
  }

  function mensagemParaContato(contato?: ContatoWhatsApp | null): string {
    if (!promocao) return mensagem
    if (mensagemEditada) {
      if (!contato) return mensagem
      return mensagem.replace(/^Olá(?:,\s*[^!]*)?!/m, `Olá, ${contato.nome.split(/\s+/)[0]}!`)
    }
    return buildMensagemPromocaoWhatsApp(promocao, {
      nomeContato: contato?.nome,
      nomeQuadra,
    })
  }

  function abrirWhatsApp(contato: ContatoWhatsApp, texto: string) {
    const url = buildWhatsAppUrlToNumber(contato.telefone, texto)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function enviarUm(contato: ContatoWhatsApp) {
    if (!promocao) {
      onMessage({ type: 'error', text: 'Selecione uma promoção.' })
      return
    }
    abrirWhatsApp(contato, mensagemParaContato(contato))
  }

  function iniciarFila() {
    if (!promocao) {
      onMessage({ type: 'error', text: 'Selecione uma promoção.' })
      return
    }
    if (qtdSelecionados === 0) {
      onMessage({ type: 'error', text: 'Selecione ao menos um contato.' })
      return
    }
    const ids = filtrados.filter((c) => selecionados.has(c.id)).map((c) => c.id)
    const extras = [...selecionados].filter((id) => !ids.includes(id))
    const ordem = [...ids, ...extras]
    setFilaIds(ordem)
    setIndiceFila(0)
    const primeiro = contatoPorId.get(ordem[0])
    if (primeiro) abrirWhatsApp(primeiro, mensagemParaContato(primeiro))
  }

  function abrirProximoDaFila() {
    const nextIndex = indiceFila + 1
    if (nextIndex >= filaIds.length) {
      setFilaIds([])
      setIndiceFila(0)
      onMessage({ type: 'success', text: 'Fila de envios concluída.' })
      return
    }
    setIndiceFila(nextIndex)
    const contato = contatoPorId.get(filaIds[nextIndex])
    if (contato) abrirWhatsApp(contato, mensagemParaContato(contato))
  }

  async function copiarMensagem() {
    const texto = mensagemParaContato(null)
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      onMessage({
        type: 'success',
        text: 'Mensagem copiada. Cole no grupo ou conversa do WhatsApp.',
      })
      window.setTimeout(() => setCopiado(false), 2000)
    } catch {
      onMessage({ type: 'error', text: 'Não foi possível copiar. Selecione o texto e copie manualmente.' })
    }
  }

  function regenerarMensagem() {
    if (!promocao) return
    setMensagemEditada(false)
    setMensagem(buildMensagemPromocaoWhatsApp(promocao, { nomeQuadra }))
  }

  if (promocoesAtivas.length === 0) {
    return (
      <section
        id="painel-envio-whatsapp"
        className="motion-card border border-dashed border-stone-300 bg-stone-50/80 p-6 space-y-2 scroll-mt-4"
      >
        <div className="flex items-center gap-2 text-stone-700">
          <WhatsAppIcon />
          <h2 className="font-semibold">Enviar promoção no WhatsApp</h2>
        </div>
        <p className="text-sm text-stone-500">
          Cadastre e ative ao menos uma promoção para montar o envio aos contatos.
        </p>
      </section>
    )
  }

  const filaAtiva = filaIds.length > 0
  const contatoAtualFila = filaAtiva ? contatoPorId.get(filaIds[indiceFila]) : null

  return (
    <section id="painel-envio-whatsapp" className="space-y-4 scroll-mt-4">
      <div>
        <div className="flex items-center gap-2 text-stone-800">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#25D366]/10 text-[#128C7E]">
            <WhatsAppIcon size={20} />
          </span>
          <div>
            <h2 className="font-semibold">Enviar promoção no WhatsApp</h2>
            <p className="text-sm text-stone-500">
              Filtre contatos com WhatsApp cadastrado, revise a mensagem e envie um a um ou em fila.
              Para grupo, copie a mensagem e cole no WhatsApp.
            </p>
          </div>
        </div>
      </div>

      <div className="motion-card border border-stone-200 overflow-hidden">
        <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] divide-y lg:divide-y-0 lg:divide-x divide-stone-200">
          {/* Coluna: promoção + mensagem */}
          <div className="p-4 sm:p-5 space-y-4 bg-gradient-to-br from-emerald-50/40 via-white to-stone-50">
            <div>
              <label htmlFor="envio-promo" className="block text-sm font-medium text-stone-700 mb-1">
                Promoção
              </label>
              <select
                id="envio-promo"
                value={promocaoId}
                onChange={(e) => {
                  setPromocaoId(e.target.value)
                  setMensagemEditada(false)
                }}
                className={inputClass}
              >
                {promocoesAtivas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.titulo}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label htmlFor="envio-mensagem" className="block text-sm font-medium text-stone-700">
                  Mensagem
                </label>
                <button
                  type="button"
                  onClick={regenerarMensagem}
                  className="cursor-pointer text-xs font-medium text-emerald-700 hover:text-emerald-900 min-h-[32px] px-2"
                >
                  Regenerar do cadastro
                </button>
              </div>
              <textarea
                id="envio-mensagem"
                value={mensagem}
                onChange={(e) => {
                  setMensagem(e.target.value)
                  setMensagemEditada(true)
                }}
                rows={10}
                className={`${inputClass} font-mono text-[13px] leading-relaxed`}
              />
              <p className="text-xs text-stone-500 mt-1.5">
                No envio individual, o nome do contato é ajustado na saudação quando possível.
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-stone-500 mb-1.5">Pré-visualização</p>
              <div
                className="rounded-2xl rounded-tl-md bg-[#DCF8C6] border border-emerald-200/80 px-4 py-3 text-sm text-stone-800 whitespace-pre-wrap leading-relaxed shadow-sm"
                aria-live="polite"
              >
                {mensagem || '—'}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={copiarMensagem}
                className="cursor-pointer min-h-[44px] px-4 rounded-lg text-sm font-semibold border border-stone-300 text-stone-800 hover:bg-white bg-white/80 transition-colors duration-200"
              >
                {copiado ? 'Copiada!' : 'Copiar para grupo'}
              </button>
            </div>
          </div>

          {/* Coluna: filtros + lista */}
          <div className="p-4 sm:p-5 space-y-4 bg-white">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-stone-700">Público</legend>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filtro de público">
                {(Object.keys(LABEL_FILTRO_PUBLICO) as FiltroPublicoContato[]).map((key) => (
                  <Chip key={key} active={publico === key} onClick={() => setPublico(key)}>
                    {LABEL_FILTRO_PUBLICO[key]}
                  </Chip>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="envio-busca" className="block text-sm font-medium text-stone-700 mb-1">
                Buscar por nome ou telefone
              </label>
              <input
                id="envio-busca"
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Ex.: Maria ou 98808"
                className={inputClass}
                autoComplete="off"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <p className="text-stone-500" aria-live="polite">
                {loadingContatos
                  ? 'Carregando contatos…'
                  : `${filtrados.length} contato${filtrados.length === 1 ? '' : 's'} · ${qtdSelecionados} selecionado${qtdSelecionados === 1 ? '' : 's'}`}
              </p>
              <button
                type="button"
                onClick={toggleTodosFiltrados}
                disabled={loadingContatos || filtrados.length === 0}
                className="cursor-pointer text-emerald-700 font-medium hover:text-emerald-900 disabled:opacity-50 disabled:cursor-not-allowed min-h-[40px] px-2"
              >
                {todosFiltradosSelecionados ? 'Limpar filtrados' : 'Selecionar filtrados'}
              </button>
            </div>

            <div
              className="border border-stone-200 rounded-lg max-h-[22rem] overflow-y-auto divide-y divide-stone-100"
              role="listbox"
              aria-multiselectable="true"
              aria-label="Contatos com WhatsApp"
            >
              {loadingContatos ? (
                <p className="p-4 text-sm text-stone-500">Carregando…</p>
              ) : filtrados.length === 0 ? (
                <p className="p-4 text-sm text-stone-500">
                  Nenhum contato com WhatsApp neste filtro. Cadastre o telefone em Usuários ou Conta.
                </p>
              ) : (
                filtrados.map((c) => {
                  const checked = selecionados.has(c.id)
                  return (
                    <div
                      key={c.id}
                      role="option"
                      aria-selected={checked}
                      className={`flex items-stretch gap-0 transition-colors duration-150 ${
                        checked ? 'bg-emerald-50/70' : 'bg-white hover:bg-stone-50'
                      }`}
                    >
                      <label className="flex flex-1 items-center gap-3 px-3 py-2.5 cursor-pointer min-h-[48px]">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleUm(c.id)}
                          className="h-4 w-4 rounded border-stone-300 text-emerald-700 focus:ring-emerald-500"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-stone-800 truncate">
                            {c.nome}
                          </span>
                          <span className="block text-xs text-stone-500">
                            {formatarTelefoneContato(c.telefone)} ·{' '}
                            {c.tipo_socio === 'socio' ? 'Sócio' : 'Visitante'}
                          </span>
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={() => enviarUm(c)}
                        className="cursor-pointer shrink-0 px-3 text-[#128C7E] hover:bg-emerald-100/80 transition-colors duration-150 min-w-[48px] inline-flex items-center justify-center"
                        aria-label={`Abrir WhatsApp de ${c.nome}`}
                        title="Abrir WhatsApp"
                      >
                        <WhatsAppIcon />
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Barra de ações em massa */}
        <div className="border-t border-stone-200 bg-stone-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          {filaAtiva ? (
            <>
              <p className="text-sm text-stone-700" aria-live="polite">
                Fila: {indiceFila + 1} de {filaIds.length}
                {contatoAtualFila ? ` — ${contatoAtualFila.nome}` : ''}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFilaIds([])
                    setIndiceFila(0)
                  }}
                  className="cursor-pointer min-h-[44px] px-4 rounded-lg text-sm font-semibold border border-stone-300 text-stone-700 hover:bg-white transition-colors duration-200"
                >
                  Cancelar fila
                </button>
                <button
                  type="button"
                  onClick={abrirProximoDaFila}
                  className="cursor-pointer min-h-[44px] px-4 rounded-lg text-sm font-semibold bg-[#25D366] text-white hover:bg-[#1ebe57] inline-flex items-center gap-2 transition-colors duration-200"
                >
                  <WhatsAppIcon size={16} />
                  {indiceFila + 1 >= filaIds.length ? 'Concluir' : 'Abrir próximo'}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-stone-500">
                O WhatsApp abre com a mensagem pronta; confirme o envio no app.
              </p>
              <button
                type="button"
                onClick={iniciarFila}
                disabled={qtdSelecionados === 0 || !promocao}
                className="cursor-pointer min-h-[44px] px-4 rounded-lg text-sm font-semibold bg-[#25D366] text-white hover:bg-[#1ebe57] disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 transition-colors duration-200"
              >
                <WhatsAppIcon size={16} />
                Enviar selecionados ({qtdSelecionados})
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

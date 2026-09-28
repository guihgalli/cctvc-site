import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  deletePromocao,
  fetchAllCourts,
  fetchAvisosReservaAdmin,
  saveMensagemLocacao,
  savePromocao,
} from '../../services/api'
import { formatDate, getErrorMessage } from '../../lib/utils'
import {
  aplicarValorMensagem,
  LABEL_PUBLICO,
  MENSAGEM_LOCACAO_PADRAO,
  PLACEHOLDER_VALOR,
} from '../../lib/avisosReserva'
import { quadraRequerPagamento } from '../../lib/bookingRules'
import { TextoFormatado } from '../TextoFormatado'
import type { Promocao, PublicoPromocao, Quadra } from '../../types'

interface AdminPromocoesSectionProps {
  onMessage: (message: { type: 'success' | 'error'; text: string }) => void
}

interface PromocaoForm {
  titulo: string
  mensagem: string
  quadra_id: string
  publico: PublicoPromocao
  data_inicio: string
  data_fim: string
  ativo: boolean
}

const FORM_VAZIO: PromocaoForm = {
  titulo: '',
  mensagem: '',
  quadra_id: '',
  publico: 'todos',
  data_inicio: '',
  data_fim: '',
  ativo: true,
}

const inputClass = 'w-full border border-stone-300 rounded-lg px-3 py-2 text-sm'

function periodoPromocao(p: Promocao): string {
  if (p.data_inicio && p.data_fim) return `${formatDate(p.data_inicio)} a ${formatDate(p.data_fim)}`
  if (p.data_inicio) return `A partir de ${formatDate(p.data_inicio)}`
  if (p.data_fim) return `Até ${formatDate(p.data_fim)}`
  return 'Sem prazo'
}

export function AdminPromocoesSection({ onMessage }: AdminPromocoesSectionProps) {
  const [loading, setLoading] = useState(true)
  const [quadras, setQuadras] = useState<Quadra[]>([])
  const [promocoes, setPromocoes] = useState<Promocao[]>([])
  const [mensagemSalva, setMensagemSalva] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState('')
  const [salvandoMensagem, setSalvandoMensagem] = useState(false)
  const [form, setForm] = useState<PromocaoForm>(FORM_VAZIO)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [salvandoPromo, setSalvandoPromo] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [avisos, listaQuadras] = await Promise.all([fetchAvisosReservaAdmin(), fetchAllCourts()])
      setPromocoes(avisos.promocoes)
      setMensagemSalva(avisos.mensagem_locacao)
      setMensagem(avisos.mensagem_locacao ?? MENSAGEM_LOCACAO_PADRAO)
      setQuadras(listaQuadras)
    } catch (err) {
      onMessage({ type: 'error', text: getErrorMessage(err, 'Erro ao carregar promoções.') })
    } finally {
      setLoading(false)
    }
  }, [onMessage])

  useEffect(() => {
    carregar()
  }, [carregar])

  const valorExemplo = useMemo(() => {
    const locacao = quadras.find(
      (q) => quadraRequerPagamento(q.tipo_quadra) && q.valor_visitante != null
    )
    return locacao?.valor_visitante ?? 100
  }, [quadras])

  const nomeQuadra = useCallback(
    (id: string | null) => (id ? quadras.find((q) => q.id === id)?.nome ?? 'Quadra removida' : 'Todas as quadras'),
    [quadras]
  )

  async function handleSalvarMensagem(e: React.FormEvent) {
    e.preventDefault()
    setSalvandoMensagem(true)
    try {
      const texto = mensagem.trim() === MENSAGEM_LOCACAO_PADRAO ? '' : mensagem
      await saveMensagemLocacao(texto)
      onMessage({ type: 'success', text: 'Mensagem da quadra de locação salva.' })
      await carregar()
    } catch (err) {
      onMessage({ type: 'error', text: getErrorMessage(err, 'Erro ao salvar mensagem.') })
    } finally {
      setSalvandoMensagem(false)
    }
  }

  async function handleRestaurarPadrao() {
    if (!window.confirm('Restaurar o texto padrão da quadra de locação?')) return
    setSalvandoMensagem(true)
    try {
      await saveMensagemLocacao('')
      onMessage({ type: 'success', text: 'Texto padrão restaurado.' })
      await carregar()
    } catch (err) {
      onMessage({ type: 'error', text: getErrorMessage(err, 'Erro ao restaurar mensagem.') })
    } finally {
      setSalvandoMensagem(false)
    }
  }

  function editar(p: Promocao) {
    setEditandoId(p.id)
    setForm({
      titulo: p.titulo,
      mensagem: p.mensagem ?? '',
      quadra_id: p.quadra_id ?? '',
      publico: p.publico,
      data_inicio: p.data_inicio ?? '',
      data_fim: p.data_fim ?? '',
      ativo: p.ativo,
    })
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setForm(FORM_VAZIO)
  }

  async function handleSalvarPromocao(e: React.FormEvent) {
    e.preventDefault()
    if (!form.titulo.trim()) {
      onMessage({ type: 'error', text: 'Informe o título da promoção.' })
      return
    }
    if (form.data_inicio && form.data_fim && form.data_fim < form.data_inicio) {
      onMessage({ type: 'error', text: 'A data final deve ser igual ou posterior à data inicial.' })
      return
    }

    setSalvandoPromo(true)
    try {
      await savePromocao(editandoId, form)
      onMessage({ type: 'success', text: editandoId ? 'Promoção atualizada.' : 'Promoção criada.' })
      cancelarEdicao()
      await carregar()
    } catch (err) {
      onMessage({ type: 'error', text: getErrorMessage(err, 'Erro ao salvar promoção.') })
    } finally {
      setSalvandoPromo(false)
    }
  }

  async function toggleAtivo(p: Promocao) {
    try {
      await savePromocao(p.id, { ...p, ativo: !p.ativo })
      await carregar()
    } catch (err) {
      onMessage({ type: 'error', text: getErrorMessage(err, 'Erro ao atualizar promoção.') })
    }
  }

  async function handleExcluir(p: Promocao) {
    if (!window.confirm(`Excluir a promoção "${p.titulo}"?`)) return
    try {
      await deletePromocao(p.id)
      if (editandoId === p.id) cancelarEdicao()
      onMessage({ type: 'success', text: 'Promoção excluída.' })
      await carregar()
    } catch (err) {
      onMessage({ type: 'error', text: getErrorMessage(err, 'Erro ao excluir promoção.') })
    }
  }

  if (loading) {
    return (
      <div className="motion-card border border-stone-200 p-8 text-center text-stone-500">
        Carregando promoções…
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <h2 className="font-semibold text-stone-700">Mensagem da quadra de locação</h2>
          <p className="text-sm text-stone-500 mt-1">
            Exibida ao selecionar uma quadra de locação na tela de reservas. Use{' '}
            <code className="bg-stone-100 px-1 rounded">{PLACEHOLDER_VALOR}</code> para mostrar o valor
            da quadra e <code className="bg-stone-100 px-1 rounded">**texto**</code> para negrito.
          </p>
        </div>

        <form onSubmit={handleSalvarMensagem} className="motion-card border border-stone-200 p-4 space-y-3">
          <label htmlFor="mensagem-locacao" className="block text-sm font-medium">
            Texto
          </label>
          <textarea
            id="mensagem-locacao"
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            rows={4}
            maxLength={2000}
            className={inputClass}
          />

          <div>
            <p className="text-xs font-medium text-stone-500 mb-1">Pré-visualização</p>
            <div className="text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm leading-relaxed">
              <TextoFormatado
                texto={aplicarValorMensagem(mensagem.trim() || MENSAGEM_LOCACAO_PADRAO, valorExemplo)}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            {mensagemSalva && (
              <button
                type="button"
                onClick={handleRestaurarPadrao}
                disabled={salvandoMensagem}
                className="px-4 py-2 rounded-lg text-sm font-semibold border border-stone-300 text-stone-700 hover:bg-stone-50 disabled:opacity-60 min-h-[44px]"
              >
                Restaurar padrão
              </button>
            )}
            <button
              type="submit"
              disabled={salvandoMensagem}
              className="bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-800 disabled:opacity-60 min-h-[44px]"
            >
              {salvandoMensagem ? 'Salvando…' : 'Salvar mensagem'}
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-semibold text-stone-700">Promoções</h2>
          <p className="text-sm text-stone-500 mt-1">
            Aparecem em destaque acima dos horários, durante o período informado. Deixe as datas em
            branco para exibir sem prazo.
          </p>
        </div>

        <form
          onSubmit={handleSalvarPromocao}
          className="motion-card border border-stone-200 p-4 grid gap-3 sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <label htmlFor="promo-titulo" className="block text-sm font-medium mb-1">
              Título
            </label>
            <input
              id="promo-titulo"
              type="text"
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              className={inputClass}
              placeholder="Ex.: Promoção de inverno — 20% off às terças"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="promo-mensagem" className="block text-sm font-medium mb-1">
              Descrição (opcional)
            </label>
            <textarea
              id="promo-mensagem"
              value={form.mensagem}
              onChange={(e) => setForm({ ...form, mensagem: e.target.value })}
              rows={3}
              className={inputClass}
              placeholder="Detalhes da promoção. Use **texto** para negrito."
            />
          </div>
          <div>
            <label htmlFor="promo-quadra" className="block text-sm font-medium mb-1">
              Quadra
            </label>
            <select
              id="promo-quadra"
              value={form.quadra_id}
              onChange={(e) => setForm({ ...form, quadra_id: e.target.value })}
              className={inputClass}
            >
              <option value="">Todas as quadras</option>
              {quadras.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="promo-publico" className="block text-sm font-medium mb-1">
              Público
            </label>
            <select
              id="promo-publico"
              value={form.publico}
              onChange={(e) => setForm({ ...form, publico: e.target.value as PublicoPromocao })}
              className={inputClass}
            >
              {(Object.keys(LABEL_PUBLICO) as PublicoPromocao[]).map((k) => (
                <option key={k} value={k}>
                  {LABEL_PUBLICO[k]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="promo-inicio" className="block text-sm font-medium mb-1">
              Início (opcional)
            </label>
            <input
              id="promo-inicio"
              type="date"
              value={form.data_inicio}
              onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="promo-fim" className="block text-sm font-medium mb-1">
              Fim (opcional)
            </label>
            <input
              id="promo-fim"
              type="date"
              value={form.data_fim}
              onChange={(e) => setForm({ ...form, data_fim: e.target.value })}
              className={inputClass}
            />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
            />
            Ativa
          </label>
          <div className="sm:col-span-2 flex flex-wrap gap-2 justify-end">
            {editandoId && (
              <button
                type="button"
                onClick={cancelarEdicao}
                className="px-4 py-2 rounded-lg text-sm font-semibold border border-stone-300 text-stone-700 hover:bg-stone-50 min-h-[44px]"
              >
                Cancelar edição
              </button>
            )}
            <button
              type="submit"
              disabled={salvandoPromo}
              className="bg-stone-800 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-stone-900 disabled:opacity-60 min-h-[44px]"
            >
              {salvandoPromo ? 'Salvando…' : editandoId ? 'Salvar alterações' : 'Adicionar promoção'}
            </button>
          </div>
        </form>

        {promocoes.length === 0 ? (
          <div className="motion-card border border-stone-200 p-6 text-stone-500 text-sm">
            Nenhuma promoção cadastrada.
          </div>
        ) : (
          <ul className="space-y-2">
            {promocoes.map((p) => (
              <li
                key={p.id}
                className={`motion-card border px-4 py-3 ${
                  editandoId === p.id ? 'border-emerald-400' : 'border-stone-200'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-stone-800">{p.titulo}</p>
                    {p.mensagem && (
                      <p className="text-sm text-stone-600 mt-1">
                        <TextoFormatado texto={p.mensagem} />
                      </p>
                    )}
                    <p className="text-xs text-stone-500 mt-2">
                      {nomeQuadra(p.quadra_id)} · {LABEL_PUBLICO[p.publico]} · {periodoPromocao(p)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleAtivo(p)}
                      className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        p.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-500'
                      }`}
                    >
                      {p.ativo ? 'Ativa' : 'Inativa'}
                    </button>
                    <button
                      type="button"
                      onClick={() => editar(p)}
                      className="text-emerald-700 hover:text-emerald-900 text-sm font-medium"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExcluir(p)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

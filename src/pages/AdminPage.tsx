import { useState, useEffect, type FormEvent } from 'react'
import { Layout } from '../components/Layout'
import {
  fetchAllCourts,
  createCourt,
  updateCourt,
  deleteCourt,
  uploadCourtPhoto,
  replaceCourtSchedules,
  fetchAllBookings,
  fetchUsers,
  createUser,
  updateUser,
} from '../services/api'
import { CourtScheduleEditor, resumirHorarios } from '../components/CourtScheduleEditor'
import {
  formatDate,
  formatTime,
  formatCpf,
  cleanCpf,
  cpfToPassword,
  getErrorMessage,
  prepareCourtPhoto,
} from '../lib/utils'
import type { CourtScheduleInput, Quadra, Reserva, Usuario } from '../types'

type AbaAdmin = 'quadras' | 'agenda' | 'usuarios'

export function AdminPage() {
  const [aba, setAba] = useState<AbaAdmin>('quadras')
  const [quadras, setQuadras] = useState<Quadra[]>([])
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [mostrarFormQuadra, setMostrarFormQuadra] = useState(false)
  const [editandoQuadraId, setEditandoQuadraId] = useState<string | null>(null)
  const [nomeQuadra, setNomeQuadra] = useState('')
  const [descricaoQuadra, setDescricaoQuadra] = useState('')
  const [tipoEsporte, setTipoEsporte] = useState('')
  const [arquivoFoto, setArquivoFoto] = useState<File | null>(null)
  const [fotoAtualUrl, setFotoAtualUrl] = useState<string | null>(null)
  const [previewFotoUrl, setPreviewFotoUrl] = useState<string | null>(null)
  const [salvandoQuadra, setSalvandoQuadra] = useState(false)
  const [horariosQuadraId, setHorariosQuadraId] = useState<string | null>(null)
  const [salvandoHorarios, setSalvandoHorarios] = useState(false)

  const [mostrarFormUsuario, setMostrarFormUsuario] = useState(false)
  const [codigoUsuario, setCodigoUsuario] = useState('')
  const [cpfUsuario, setCpfUsuario] = useState('')
  const [nomeUsuario, setNomeUsuario] = useState('')
  const [perfilUsuario, setPerfilUsuario] = useState<'usuario' | 'admin'>('usuario')

  const [filtroQuadra, setFiltroQuadra] = useState('')
  const [filtroData, setFiltroData] = useState('')

  useEffect(() => {
    carregarDados()
  }, [aba, filtroQuadra, filtroData])

  async function carregarDados() {
    setLoading(true)
    try {
      if (aba === 'quadras') {
        setQuadras(await fetchAllCourts())
      } else if (aba === 'agenda') {
        setReservas(
          await fetchAllBookings({
            courtId: filtroQuadra || undefined,
            date: filtroData || undefined,
          })
        )
        if (quadras.length === 0) setQuadras(await fetchAllCourts())
      } else if (aba === 'usuarios') {
        setUsuarios(await fetchUsers())
      }
    } catch {
      setMessage({ type: 'error', text: 'Erro ao carregar dados.' })
    } finally {
      setLoading(false)
    }
  }

  function resetCamposQuadra() {
    if (previewFotoUrl) URL.revokeObjectURL(previewFotoUrl)
    setNomeQuadra('')
    setDescricaoQuadra('')
    setTipoEsporte('')
    setArquivoFoto(null)
    setFotoAtualUrl(null)
    setPreviewFotoUrl(null)
    setEditandoQuadraId(null)
  }

  function limparFormQuadra() {
    resetCamposQuadra()
    setMostrarFormQuadra(false)
  }

  function handleSelecionarFoto(file: File | null) {
    if (previewFotoUrl) URL.revokeObjectURL(previewFotoUrl)
    setArquivoFoto(file)
    setPreviewFotoUrl(file ? URL.createObjectURL(file) : null)
  }

  function handleEditarQuadra(quadra: Quadra) {
    const foto = quadra.fotos_quadras?.find((f) => f.principal) || quadra.fotos_quadras?.[0]
    if (previewFotoUrl) URL.revokeObjectURL(previewFotoUrl)
    setEditandoQuadraId(quadra.id)
    setNomeQuadra(quadra.nome)
    setDescricaoQuadra(quadra.descricao || '')
    setTipoEsporte(quadra.tipo_esporte || '')
    setArquivoFoto(null)
    setPreviewFotoUrl(null)
    setFotoAtualUrl(foto?.url || null)
    setMostrarFormQuadra(true)
    setMessage(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSalvarQuadra(e: FormEvent) {
    e.preventDefault()
    setSalvandoQuadra(true)
    setMessage(null)
    const editando = Boolean(editandoQuadraId)
    try {
      let quadraId = editandoQuadraId

      try {
        if (editandoQuadraId) {
          await updateCourt(editandoQuadraId, {
            nome: nomeQuadra,
            descricao: descricaoQuadra || '',
            tipo_esporte: tipoEsporte || '',
          })
        } else {
          const criada = await createCourt({
            nome: nomeQuadra,
            descricao: descricaoQuadra || undefined,
            tipo_esporte: tipoEsporte || undefined,
          })
          quadraId = criada.id
        }
      } catch (err) {
        throw new Error(
          `Falha ao ${editando ? 'atualizar' : 'cadastrar'} a quadra: ${getErrorMessage(err)}`
        )
      }

      if (arquivoFoto && quadraId) {
        try {
          const fotoPronta = await prepareCourtPhoto(arquivoFoto)
          await uploadCourtPhoto(quadraId, fotoPronta, true)
        } catch (err) {
          throw new Error(
            `Quadra salva, mas a foto falhou: ${getErrorMessage(err)}. Tente outra imagem JPG/PNG.`
          )
        }
      }

      setMessage({
        type: 'success',
        text: editando ? 'Quadra atualizada!' : 'Quadra cadastrada!',
      })
      limparFormQuadra()
      await carregarDados()
    } catch (err) {
      setMessage({
        type: 'error',
        text: getErrorMessage(
          err,
          editando ? 'Erro ao atualizar quadra ou enviar foto.' : 'Erro ao cadastrar quadra ou enviar foto.'
        ),
      })
    } finally {
      setSalvandoQuadra(false)
    }
  }

  async function handleExcluirQuadra(quadra: Quadra) {
    if (
      !confirm(
        `Excluir a quadra "${quadra.nome}"? Esta ação remove também as fotos e reservas vinculadas.`
      )
    ) {
      return
    }
    try {
      await deleteCourt(quadra.id)
      setMessage({ type: 'success', text: 'Quadra excluída!' })
      if (editandoQuadraId === quadra.id) limparFormQuadra()
      carregarDados()
    } catch {
      setMessage({ type: 'error', text: 'Erro ao excluir quadra.' })
    }
  }

  async function handleAlternarQuadra(quadra: Quadra) {
    try {
      await updateCourt(quadra.id, { ativo: !quadra.ativo })
      carregarDados()
    } catch {
      setMessage({ type: 'error', text: 'Erro ao atualizar quadra.' })
    }
  }

  async function handleSalvarHorarios(quadraId: string, schedules: CourtScheduleInput[]) {
    setSalvandoHorarios(true)
    try {
      await replaceCourtSchedules(quadraId, schedules)
      setMessage({ type: 'success', text: 'Horários da quadra salvos!' })
      setHorariosQuadraId(null)
      await carregarDados()
    } catch {
      setMessage({ type: 'error', text: 'Erro ao salvar horários. Execute a migration no Supabase.' })
    } finally {
      setSalvandoHorarios(false)
    }
  }

  async function handleCriarUsuario(e: FormEvent) {
    e.preventDefault()
    const cpf = cleanCpf(cpfUsuario)
    if (cpf.length !== 11) {
      setMessage({ type: 'error', text: 'CPF deve ter 11 dígitos.' })
      return
    }
    try {
      await createUser({
        codigo_usuario: codigoUsuario,
        cpf,
        nome: nomeUsuario,
        perfil: perfilUsuario,
      })
      setMessage({
        type: 'success',
        text: `Usuário cadastrado! Senha inicial: ${cpfToPassword(cpf)}`,
      })
      setCodigoUsuario('')
      setCpfUsuario('')
      setNomeUsuario('')
      setPerfilUsuario('usuario')
      setMostrarFormUsuario(false)
      carregarDados()
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erro ao cadastrar usuário.',
      })
    }
  }

  async function handleAlternarUsuario(usuario: Usuario) {
    try {
      await updateUser(usuario.id, { ativo: !usuario.ativo })
      carregarDados()
    } catch {
      setMessage({ type: 'error', text: 'Erro ao atualizar usuário.' })
    }
  }

  const abas: { id: AbaAdmin; label: string }[] = [
    { id: 'quadras', label: 'Quadras' },
    { id: 'agenda', label: 'Agenda' },
    { id: 'usuarios', label: 'Usuários' },
  ]

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-emerald-900 mb-6">Painel Administrativo</h1>

        <div className="flex gap-2 mb-6 flex-wrap">
          {abas.map((t) => (
            <button
              key={t.id}
              onClick={() => setAba(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                aba === t.id
                  ? 'bg-emerald-700 text-white'
                  : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {message && (
          <div
            className={`mb-4 px-4 py-3 rounded-lg text-sm ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-emerald-700">Carregando...</div>
        ) : aba === 'quadras' ? (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-stone-700">Quadras Cadastradas</h2>
              <button
                onClick={() => {
                  if (mostrarFormQuadra) {
                    limparFormQuadra()
                  } else {
                    resetCamposQuadra()
                    setMostrarFormQuadra(true)
                  }
                }}
                className="bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-600"
              >
                {mostrarFormQuadra ? 'Cancelar' : '+ Nova Quadra'}
              </button>
            </div>

            {mostrarFormQuadra && (
              <form
                onSubmit={handleSalvarQuadra}
                className="bg-white rounded-xl p-6 border border-stone-200 mb-6 space-y-4"
              >
                <h3 className="font-medium text-stone-700">
                  {editandoQuadraId ? 'Editar Quadra' : 'Nova Quadra'}
                </h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Nome *</label>
                    <input
                      value={nomeQuadra}
                      onChange={(e) => setNomeQuadra(e.target.value)}
                      required
                      className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Tipo de Esporte</label>
                    <input
                      value={tipoEsporte}
                      onChange={(e) => setTipoEsporte(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="Tênis, Futsal..."
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Descrição</label>
                  <textarea
                    value={descricaoQuadra}
                    onChange={(e) => setDescricaoQuadra(e.target.value)}
                    rows={2}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Foto da quadra</label>
                  <div className="flex flex-col sm:flex-row gap-3 sm:items-start">
                    <div className="w-28 h-28 rounded-lg border border-stone-200 bg-stone-50 overflow-hidden shrink-0 flex items-center justify-center">
                      {previewFotoUrl || fotoAtualUrl ? (
                        <img
                          src={previewFotoUrl || fotoAtualUrl || ''}
                          alt="Pré-visualização"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs text-stone-400 px-2 text-center">Sem foto</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleSelecionarFoto(e.target.files?.[0] || null)}
                        className="block w-full text-sm text-stone-600 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-emerald-800 hover:file:bg-emerald-100"
                      />
                      <p className="text-xs text-stone-500">
                        {editandoQuadraId
                          ? 'Selecione uma imagem para substituir a foto atual (opcional).'
                          : 'Opcional. A foto aparece na listagem e na reserva.'}{' '}
                        No celular, preferir foto da galeria; o app converte automaticamente para JPG.
                      </p>
                      {arquivoFoto && (
                        <button
                          type="button"
                          onClick={() => handleSelecionarFoto(null)}
                          className="text-xs text-stone-600 underline"
                        >
                          Remover arquivo selecionado
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={salvandoQuadra}
                  className="bg-emerald-700 text-white px-6 py-2 rounded-lg text-sm hover:bg-emerald-600 disabled:opacity-60"
                >
                  {salvandoQuadra
                    ? 'Salvando...'
                    : editandoQuadraId
                      ? 'Salvar alterações'
                      : 'Cadastrar'}
                </button>
              </form>
            )}

            <div className="space-y-4">
              {quadras.map((quadra) => {
                const foto = quadra.fotos_quadras?.find((f) => f.principal) || quadra.fotos_quadras?.[0]
                return (
                  <div
                    key={quadra.id}
                    className={`bg-white rounded-xl border p-4 space-y-3 min-w-0 overflow-hidden ${
                      quadra.ativo ? 'border-stone-200' : 'border-stone-200 opacity-60'
                    }`}
                  >
                    <div className="flex gap-4 items-start min-w-0">
                      {foto ? (
                        <img src={foto.url} alt={quadra.nome} className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-lg shrink-0" />
                      ) : (
                        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-stone-100 rounded-lg flex items-center justify-center text-stone-400 text-xs shrink-0">
                          Sem foto
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-emerald-900 truncate">{quadra.nome}</p>
                            {quadra.tipo_esporte && (
                              <p className="text-stone-500 text-sm">{quadra.tipo_esporte}</p>
                            )}
                            {quadra.descricao && (
                              <p className="text-stone-600 text-sm mt-1">{quadra.descricao}</p>
                            )}
                          </div>
                          <button
                            onClick={() => handleAlternarQuadra(quadra)}
                            className={`text-xs px-2 py-1 rounded shrink-0 ${
                              quadra.ativo
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-stone-100 text-stone-500'
                            }`}
                          >
                            {quadra.ativo ? 'Ativa' : 'Inativa'}
                          </button>
                        </div>
                        <p className="mt-2 text-xs text-stone-500 line-clamp-2">
                          {resumirHorarios(quadra.horarios_quadra)}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditarQuadra(quadra)}
                            className="text-xs border border-stone-300 text-stone-700 px-3 py-1 rounded hover:bg-stone-50"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExcluirQuadra(quadra)}
                            className="text-xs border border-red-200 text-red-700 px-3 py-1 rounded hover:bg-red-50"
                          >
                            Excluir
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setHorariosQuadraId((id) => (id === quadra.id ? null : quadra.id))
                            }
                            className="text-xs border border-stone-300 text-stone-700 px-3 py-1 rounded hover:bg-stone-50"
                          >
                            {horariosQuadraId === quadra.id ? 'Fechar horários' : 'Dias e horários'}
                          </button>
                        </div>
                      </div>
                    </div>
                    {horariosQuadraId === quadra.id && (
                      <CourtScheduleEditor
                        horarios={quadra.horarios_quadra}
                        saving={salvandoHorarios}
                        onSave={(schedules) => handleSalvarHorarios(quadra.id, schedules)}
                        onCancel={() => setHorariosQuadraId(null)}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ) : aba === 'agenda' ? (
          <div>
            <div className="flex gap-4 mb-4 flex-wrap">
              <select
                value={filtroQuadra}
                onChange={(e) => setFiltroQuadra(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Todas as quadras</option>
                {quadras.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.nome}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={filtroData}
                onChange={(e) => setFiltroData(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              />
            </div>

            {reservas.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center text-stone-500">
                Nenhuma reserva encontrada.
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-stone-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-stone-600">Data</th>
                      <th className="text-left px-4 py-3 font-medium text-stone-600">Horário</th>
                      <th className="text-left px-4 py-3 font-medium text-stone-600">Quadra</th>
                      <th className="text-left px-4 py-3 font-medium text-stone-600">Usuário</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservas.map((r) => (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-stone-50">
                        <td className="px-4 py-3">{formatDate(r.data_reserva)}</td>
                        <td className="px-4 py-3">
                          {formatTime(r.hora_inicio)} – {formatTime(r.hora_fim)}
                        </td>
                        <td className="px-4 py-3">{r.quadras?.nome}</td>
                        <td className="px-4 py-3">
                          {r.usuarios?.nome}{' '}
                          <span className="text-stone-400">({r.usuarios?.codigo_usuario})</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-stone-700">Usuários Cadastrados</h2>
              <button
                onClick={() => setMostrarFormUsuario(!mostrarFormUsuario)}
                className="bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-600"
              >
                {mostrarFormUsuario ? 'Cancelar' : '+ Novo Usuário'}
              </button>
            </div>

            {mostrarFormUsuario && (
              <form
                onSubmit={handleCriarUsuario}
                className="bg-white rounded-xl p-6 border border-stone-200 mb-6 space-y-4"
              >
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Código (6 dígitos) *</label>
                    <input
                      value={codigoUsuario}
                      onChange={(e) => setCodigoUsuario(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                      pattern="\d{6}"
                      className="w-full border rounded-lg px-3 py-2 font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">CPF *</label>
                    <input
                      value={cpfUsuario}
                      onChange={(e) => setCpfUsuario(e.target.value.replace(/\D/g, '').slice(0, 11))}
                      required
                      className="w-full border rounded-lg px-3 py-2 font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Nome *</label>
                    <input
                      value={nomeUsuario}
                      onChange={(e) => setNomeUsuario(e.target.value)}
                      required
                      className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Perfil</label>
                    <select
                      value={perfilUsuario}
                      onChange={(e) => setPerfilUsuario(e.target.value as 'usuario' | 'admin')}
                      className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="usuario">Usuário</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                </div>
                <p className="text-stone-500 text-xs">
                  A senha inicial será os 3 primeiros dígitos do CPF. O sócio pode alterá-la depois
                  em Conta.
                </p>
                <button
                  type="submit"
                  className="bg-emerald-700 text-white px-6 py-2 rounded-lg text-sm hover:bg-emerald-600"
                >
                  Cadastrar
                </button>
              </form>
            )}

            <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-stone-600">Código</th>
                    <th className="text-left px-4 py-3 font-medium text-stone-600">Nome</th>
                    <th className="text-left px-4 py-3 font-medium text-stone-600">CPF</th>
                    <th className="text-left px-4 py-3 font-medium text-stone-600">Perfil</th>
                    <th className="text-left px-4 py-3 font-medium text-stone-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-stone-50">
                      <td className="px-4 py-3 font-mono">{u.codigo_usuario}</td>
                      <td className="px-4 py-3">{u.nome}</td>
                      <td className="px-4 py-3 font-mono text-stone-500">{formatCpf(u.cpf)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            u.perfil === 'admin'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-stone-100 text-stone-600'
                          }`}
                        >
                          {u.perfil === 'admin' ? 'Admin' : 'Usuário'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleAlternarUsuario(u)}
                          className={`text-xs px-2 py-1 rounded ${
                            u.ativo
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-red-100 text-red-600'
                          }`}
                        >
                          {u.ativo ? 'Ativo' : 'Inativo'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '../motion/Button'
import {
  FILTROS_USUARIO_VAZIOS,
  ITENS_POR_PAGINA_OPCOES,
  contarUsuariosPendentes,
  filtrarUsuarios,
  ordenarUsuarios,
  paginarUsuarios,
  proximaOrdenacao,
  temFiltrosUsuariosAtivos,
  totalPaginas,
  type FiltrosUsuario,
  type ItensPorPagina,
  type UsuarioSort,
  type UsuarioSortCol,
} from '../../lib/adminUsuarios'
import { formatTitularVinculo, labelCategoriaSocio, resolveTitularUsuario } from '../../lib/bookingRules'
import type { CamposPlanilhaUsuario } from '../../lib/usuarioPlanilha'
import { labelCategoriaClube } from '../../lib/usuarioPlanilha'
import { formatCpf, formatDate, formatPhone, maskPhoneInput } from '../../lib/utils'
import { exportUsuariosExcel } from '../../lib/exportUsuariosExcel'
import type { Usuario } from '../../types'
import { UsuarioPlanilhaFields, resumoCamposPlanilha } from './UsuarioPlanilhaFields'

const BTN_ACAO =
  'text-sm min-h-9 px-3 py-1.5 rounded inline-flex items-center justify-center'

const TH_STICKY = 'sticky top-0 z-20 bg-stone-50'
const TD_STICKY_RIGHT =
  'sticky right-0 z-[5] bg-white group-hover:bg-stone-50 shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.12)]'
const TH_STICKY_RIGHT = `${TH_STICKY} shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.08)]`

interface CampoErros {
  cpf?: string
  email?: string
  telefone?: string
}

export interface AdminUsuariosSectionProps {
  usuarios: Usuario[]
  adminUserId: string | undefined
  mostrarFormUsuario: boolean
  setMostrarFormUsuario: (v: boolean) => void
  codigoUsuario: string
  setCodigoUsuario: (v: string) => void
  cpfUsuario: string
  setCpfUsuario: (v: string) => void
  nomeUsuario: string
  setNomeUsuario: (v: string) => void
  emailUsuario: string
  setEmailUsuario: (v: string) => void
  telefoneUsuario: string
  setTelefoneUsuario: (v: string) => void
  tipoSocioUsuario: 'socio' | 'nao_socio'
  setTipoSocioUsuario: (v: 'socio' | 'nao_socio') => void
  perfilUsuario: 'usuario' | 'admin'
  setPerfilUsuario: (v: 'usuario' | 'admin') => void
  criandoUsuario: boolean
  campoErros: CampoErros
  onBlurValidarCampo: (campo: keyof CampoErros) => void
  onCriarUsuario: (e: FormEvent) => void
  onToggleStatus: (usuario: Usuario) => void
  onEditar: (usuario: Usuario) => void
  onExcluir: (usuario: Usuario) => void
  camposPlanilha: CamposPlanilhaUsuario
  setCamposPlanilha: (v: CamposPlanilhaUsuario) => void
}

function SortHeader({
  col,
  sort,
  onSort,
  children,
}: {
  col: UsuarioSortCol
  sort: UsuarioSort
  onSort: (col: UsuarioSortCol) => void
  children: ReactNode
}) {
  const ativo = sort.col === col
  const seta = ativo ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''
  return (
    <th className={`text-left px-3 py-3 font-medium text-stone-600 whitespace-nowrap ${TH_STICKY}`}>
      <button
        type="button"
        onClick={() => onSort(col)}
        className="inline-flex items-center gap-0.5 hover:text-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
        aria-sort={ativo ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        {children}
        <span className="text-emerald-600 text-xs" aria-hidden="true">
          {seta}
        </span>
      </button>
    </th>
  )
}

function UsuarioBadges({ u }: { u: Usuario }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <span
        className={`text-xs px-2 py-0.5 rounded font-medium ${
          u.tipo_socio === 'socio'
            ? 'bg-emerald-100 text-emerald-800'
            : 'bg-amber-100 text-amber-800'
        }`}
      >
        {u.tipo_socio === 'socio' ? labelCategoriaSocio(u.categoria_socio) : 'Visitante'}
      </span>
      <span
        className={`text-xs px-2 py-0.5 rounded ${
          u.perfil === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-stone-100 text-stone-600'
        }`}
      >
        {u.perfil === 'admin' ? 'Admin' : 'Usuário'}
      </span>
    </div>
  )
}

function UsuarioAcoesCelula({
  u,
  adminUserId,
  onToggleStatus,
  onEditar,
  onExcluir,
}: {
  u: Usuario
  adminUserId: string | undefined
  onToggleStatus: (usuario: Usuario) => void
  onEditar: (usuario: Usuario) => void
  onExcluir: (usuario: Usuario) => void
}) {
  return (
    <div className="flex flex-col gap-1.5 min-w-[9.5rem]">
      <button
        type="button"
        onClick={() => onToggleStatus(u)}
        className={`${BTN_ACAO} w-full ${
          u.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
        }`}
        aria-label={u.ativo ? `Desativar ${u.nome}` : `Ativar ${u.nome}`}
      >
        {u.ativo ? 'Ativo' : 'Inativo'}
      </button>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => onEditar(u)}
          className={`${BTN_ACAO} flex-1 bg-stone-100 text-stone-700 hover:bg-stone-200`}
        >
          Editar
        </button>
        <button
          type="button"
          onClick={() => onExcluir(u)}
          disabled={u.id === adminUserId}
          className={`${BTN_ACAO} flex-1 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed`}
          title={
            u.id === adminUserId
              ? 'Você não pode excluir sua própria conta'
              : 'Excluir usuário permanentemente'
          }
        >
          Excluir
        </button>
      </div>
    </div>
  )
}

function UsuarioAcoesLinha({
  u,
  adminUserId,
  onEditar,
  onExcluir,
}: {
  u: Usuario
  adminUserId: string | undefined
  onEditar: (usuario: Usuario) => void
  onExcluir: (usuario: Usuario) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onEditar(u)}
        className={`${BTN_ACAO} bg-stone-100 text-stone-700 hover:bg-stone-200`}
      >
        Editar
      </button>
      <button
        type="button"
        onClick={() => onExcluir(u)}
        disabled={u.id === adminUserId}
        className={`${BTN_ACAO} bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed`}
        title={
          u.id === adminUserId ? 'Você não pode excluir sua própria conta' : 'Excluir usuário permanentemente'
        }
      >
        Excluir
      </button>
    </div>
  )
}

function UsuarioAcoesMobile({
  u,
  adminUserId,
  onToggleStatus,
  onEditar,
  onExcluir,
}: {
  u: Usuario
  adminUserId: string | undefined
  onToggleStatus: (usuario: Usuario) => void
  onEditar: (usuario: Usuario) => void
  onExcluir: (usuario: Usuario) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onToggleStatus(u)}
        className={`${BTN_ACAO} ${
          u.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
        }`}
        aria-label={u.ativo ? `Desativar ${u.nome}` : `Ativar ${u.nome}`}
      >
        {u.ativo ? 'Ativo' : 'Inativo'}
      </button>
      <UsuarioAcoesLinha u={u} adminUserId={adminUserId} onEditar={onEditar} onExcluir={onExcluir} />
    </div>
  )
}

export function AdminUsuariosSection({
  usuarios,
  adminUserId,
  mostrarFormUsuario,
  setMostrarFormUsuario,
  codigoUsuario,
  setCodigoUsuario,
  cpfUsuario,
  setCpfUsuario,
  nomeUsuario,
  setNomeUsuario,
  emailUsuario,
  setEmailUsuario,
  telefoneUsuario,
  setTelefoneUsuario,
  tipoSocioUsuario,
  setTipoSocioUsuario,
  perfilUsuario,
  setPerfilUsuario,
  criandoUsuario,
  campoErros,
  onBlurValidarCampo,
  onCriarUsuario,
  onToggleStatus,
  onEditar,
  onExcluir,
  camposPlanilha,
  setCamposPlanilha,
}: AdminUsuariosSectionProps) {
  const [filtros, setFiltros] = useState<FiltrosUsuario>(FILTROS_USUARIO_VAZIOS)
  const [sort, setSort] = useState<UsuarioSort>({ col: 'nome', dir: 'asc' })
  const [pagina, setPagina] = useState(1)
  const [itensPorPagina, setItensPorPagina] = useState<ItensPorPagina>(25)

  const pendentesAprovacao = useMemo(() => contarUsuariosPendentes(usuarios), [usuarios])

  const usuariosFiltrados = useMemo(
    () => ordenarUsuarios(filtrarUsuarios(usuarios, filtros), sort),
    [usuarios, filtros, sort]
  )

  const totalFiltrados = usuariosFiltrados.length
  const paginas = totalPaginas(totalFiltrados, itensPorPagina)

  const usuariosPagina = useMemo(
    () => paginarUsuarios(usuariosFiltrados, pagina, itensPorPagina),
    [usuariosFiltrados, pagina, itensPorPagina]
  )

  useEffect(() => {
    setPagina(1)
  }, [filtros, itensPorPagina])

  useEffect(() => {
    if (pagina > paginas) setPagina(paginas)
  }, [pagina, paginas])

  function limparFiltros() {
    setFiltros(FILTROS_USUARIO_VAZIOS)
  }

  function alterarOrdenacao(col: UsuarioSortCol) {
    setSort((atual) => proximaOrdenacao(atual, col))
  }

  function atualizarFiltro<K extends keyof FiltrosUsuario>(chave: K, valor: FiltrosUsuario[K]) {
    setFiltros((prev) => ({ ...prev, [chave]: valor }))
  }

  const chips: { label: string; onRemove: () => void }[] = []
  if (filtros.busca.trim()) {
    chips.push({ label: `Busca: "${filtros.busca.trim()}"`, onRemove: () => atualizarFiltro('busca', '') })
  }
  if (filtros.tipoSocio === 'socio') {
    chips.push({ label: 'Sócios', onRemove: () => atualizarFiltro('tipoSocio', '') })
  }
  if (filtros.tipoSocio === 'nao_socio') {
    chips.push({ label: 'Visitantes', onRemove: () => atualizarFiltro('tipoSocio', '') })
  }
  if (filtros.categoria === 'titular') {
    chips.push({ label: 'Titulares', onRemove: () => atualizarFiltro('categoria', '') })
  }
  if (filtros.categoria === 'dependente') {
    chips.push({ label: 'Dependentes', onRemove: () => atualizarFiltro('categoria', '') })
  }
  if (filtros.perfil === 'admin') {
    chips.push({ label: 'Administradores', onRemove: () => atualizarFiltro('perfil', '') })
  }
  if (filtros.ativo === 'ativo') {
    chips.push({ label: 'Ativos', onRemove: () => atualizarFiltro('ativo', '') })
  }
  if (filtros.ativo === 'inativo') {
    chips.push({ label: 'Inativos', onRemove: () => atualizarFiltro('ativo', '') })
  }

  const listaVazia = usuarios.length === 0
  const buscaSemResultado = !listaVazia && totalFiltrados === 0

  function titularLabel(u: Usuario): string | null {
    if (u.categoria_socio !== 'dependente') return null
    return formatTitularVinculo(resolveTitularUsuario(u, usuarios))
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
        <div>
          <h2 className="font-semibold text-stone-700">Usuários Cadastrados</h2>
          {!listaVazia && (
            <p className="text-xs text-stone-500 mt-0.5">
              Mostrando {usuariosPagina.length} de {totalFiltrados} usuário
              {totalFiltrados !== 1 ? 's' : ''}
              {temFiltrosUsuariosAtivos(filtros) && ` (${usuarios.length} no total)`}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          {!listaVazia && (
            <button
              type="button"
              onClick={() => exportUsuariosExcel(usuariosFiltrados)}
              className="border border-emerald-700 text-emerald-800 px-4 py-2 min-h-11 rounded-lg text-sm hover:bg-emerald-50"
              title={`Exportar ${totalFiltrados} usuário(s) filtrados para Excel`}
            >
              Exportar Excel
            </button>
          )}
          <button
            type="button"
            onClick={() => setMostrarFormUsuario(!mostrarFormUsuario)}
            className="bg-emerald-700 text-white px-4 py-2 min-h-11 rounded-lg text-sm hover:bg-emerald-600"
          >
            {mostrarFormUsuario ? 'Cancelar' : '+ Novo Usuário'}
          </button>
        </div>
      </div>

      {pendentesAprovacao > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {pendentesAprovacao} visitante{pendentesAprovacao !== 1 ? 's' : ''} aguardando aprovação.{' '}
          <button
            type="button"
            onClick={() =>
              setFiltros({
                ...FILTROS_USUARIO_VAZIOS,
                tipoSocio: 'nao_socio',
                ativo: 'inativo',
              })
            }
            className="underline font-medium hover:text-amber-950"
          >
            Ver pendentes
          </button>
        </div>
      )}

      {mostrarFormUsuario && (
        <form
          onSubmit={onCriarUsuario}
          className="motion-card border border-stone-200 p-6 mb-6 space-y-4 motion-page-enter"
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="novo-codigo" className="block text-sm font-medium mb-1">
                Código (4 dígitos) *
              </label>
              <input
                id="novo-codigo"
                value={codigoUsuario}
                onChange={(e) => setCodigoUsuario(e.target.value.replace(/\D/g, '').slice(0, 4))}
                required
                pattern="\d{4}"
                placeholder="1660 titular, 1661 dep."
                className="w-full border rounded-lg px-3 py-2 font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div>
              <label htmlFor="novo-cpf" className="block text-sm font-medium mb-1">
                CPF *
              </label>
              <input
                id="novo-cpf"
                value={cpfUsuario}
                onChange={(e) => setCpfUsuario(e.target.value.replace(/\D/g, '').slice(0, 11))}
                onBlur={() => onBlurValidarCampo('cpf')}
                required
                aria-invalid={Boolean(campoErros.cpf)}
                aria-describedby={campoErros.cpf ? 'novo-cpf-erro' : undefined}
                className="w-full border rounded-lg px-3 py-2 font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              {campoErros.cpf && (
                <p id="novo-cpf-erro" className="text-red-600 text-xs mt-1">
                  {campoErros.cpf}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="novo-nome" className="block text-sm font-medium mb-1">
                Nome *
              </label>
              <input
                id="novo-nome"
                value={nomeUsuario}
                onChange={(e) => setNomeUsuario(e.target.value)}
                required
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div>
              <label htmlFor="novo-email" className="block text-sm font-medium mb-1">
                E-mail *
              </label>
              <input
                id="novo-email"
                type="email"
                value={emailUsuario}
                onChange={(e) => setEmailUsuario(e.target.value)}
                onBlur={() => onBlurValidarCampo('email')}
                required
                aria-invalid={Boolean(campoErros.email)}
                aria-describedby={campoErros.email ? 'novo-email-erro' : undefined}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              {campoErros.email && (
                <p id="novo-email-erro" className="text-red-600 text-xs mt-1">
                  {campoErros.email}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="novo-telefone" className="block text-sm font-medium mb-1">
                Telefone *
              </label>
              <input
                id="novo-telefone"
                type="tel"
                value={telefoneUsuario}
                onChange={(e) => setTelefoneUsuario(maskPhoneInput(e.target.value))}
                onBlur={() => onBlurValidarCampo('telefone')}
                required
                inputMode="numeric"
                placeholder="(47) 99999-9999"
                aria-invalid={Boolean(campoErros.telefone)}
                aria-describedby={campoErros.telefone ? 'novo-telefone-erro' : undefined}
                className="w-full border rounded-lg px-3 py-2 font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              {campoErros.telefone && (
                <p id="novo-telefone-erro" className="text-red-600 text-xs mt-1">
                  {campoErros.telefone}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="novo-tipo" className="block text-sm font-medium mb-1">
                Tipo
              </label>
              <select
                id="novo-tipo"
                value={tipoSocioUsuario}
                onChange={(e) => setTipoSocioUsuario(e.target.value as 'socio' | 'nao_socio')}
                className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="socio">Sócio (aprovação imediata)</option>
                <option value="nao_socio">Não-sócio (aprovação manual)</option>
              </select>
            </div>
            <div>
              <label htmlFor="novo-perfil" className="block text-sm font-medium mb-1">
                Perfil
              </label>
              <select
                id="novo-perfil"
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
            A senha inicial será os 6 primeiros dígitos do CPF. Último dígito 0 = titular; 1–9 =
            dependente. O sócio pode alterá-la depois em Conta.
          </p>
          <UsuarioPlanilhaFields
            idPrefix="novo-usuario"
            codigoUsuario={codigoUsuario}
            campos={camposPlanilha}
            onChange={(patch) => setCamposPlanilha({ ...camposPlanilha, ...patch })}
          />
          <Button type="submit" variant="primary" loading={criandoUsuario} loadingText="Cadastrando...">
            Cadastrar
          </Button>
        </form>
      )}

      {!listaVazia && (
        <div className="mb-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <input
              type="search"
              value={filtros.busca}
              onChange={(e) => atualizarFiltro('busca', e.target.value)}
              placeholder="Buscar por nome, código, e-mail ou CPF…"
              aria-label="Buscar usuários"
              className="flex-1 min-w-[200px] border rounded-lg px-3 py-2 text-sm min-h-10 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
            <select
              value={filtros.tipoSocio}
              onChange={(e) => atualizarFiltro('tipoSocio', e.target.value as FiltrosUsuario['tipoSocio'])}
              aria-label="Filtrar por tipo"
              className="border rounded-lg px-3 py-2 text-sm min-h-10"
            >
              <option value="">Todos os tipos</option>
              <option value="socio">Sócios</option>
              <option value="nao_socio">Visitantes</option>
            </select>
            <select
              value={filtros.categoria}
              onChange={(e) => atualizarFiltro('categoria', e.target.value as FiltrosUsuario['categoria'])}
              aria-label="Filtrar por categoria"
              className="border rounded-lg px-3 py-2 text-sm min-h-10"
            >
              <option value="">Titular / dependente</option>
              <option value="titular">Titulares</option>
              <option value="dependente">Dependentes</option>
            </select>
            <select
              value={filtros.perfil}
              onChange={(e) => atualizarFiltro('perfil', e.target.value as FiltrosUsuario['perfil'])}
              aria-label="Filtrar por perfil"
              className="border rounded-lg px-3 py-2 text-sm min-h-10"
            >
              <option value="">Todos os perfis</option>
              <option value="usuario">Usuário</option>
              <option value="admin">Administrador</option>
            </select>
            <select
              value={filtros.ativo}
              onChange={(e) => atualizarFiltro('ativo', e.target.value as FiltrosUsuario['ativo'])}
              aria-label="Filtrar por status"
              className="border rounded-lg px-3 py-2 text-sm min-h-10"
            >
              <option value="">Ativo / inativo</option>
              <option value="ativo">Ativos</option>
              <option value="inativo">Inativos</option>
            </select>
          </div>

          {chips.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              {chips.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={chip.onRemove}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-stone-100 text-stone-700 hover:bg-stone-200 min-h-9"
                >
                  {chip.label}
                  <span aria-hidden="true">×</span>
                </button>
              ))}
              <button
                type="button"
                onClick={limparFiltros}
                className="text-xs text-emerald-700 underline min-h-9 px-2"
              >
                Limpar filtros
              </button>
            </div>
          )}
        </div>
      )}

      {listaVazia ? (
        <div className="motion-card p-8 text-center text-stone-500 space-y-4">
          <p>Nenhum usuário cadastrado ainda.</p>
          {!mostrarFormUsuario && (
            <button
              type="button"
              onClick={() => setMostrarFormUsuario(true)}
              className="bg-emerald-700 text-white px-4 py-2 min-h-11 rounded-lg text-sm hover:bg-emerald-600"
            >
              + Cadastrar primeiro usuário
            </button>
          )}
        </div>
      ) : buscaSemResultado ? (
        <div className="motion-card p-8 text-center text-stone-500 space-y-3">
          <p>Nenhum usuário encontrado com os filtros atuais.</p>
          <p className="text-xs">Tente outro nome, código ou remova algum filtro.</p>
          <button
            type="button"
            onClick={limparFiltros}
            className="text-emerald-700 underline text-sm min-h-9 px-3"
          >
            Limpar filtros
          </button>
        </div>
      ) : (
        <>
          <div className="md:hidden space-y-3 mb-4">
            {usuariosPagina.map((u) => {
              const vinculo = titularLabel(u)
              return (
                <div key={u.id} className="motion-card border border-stone-200 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-emerald-900">{u.nome}</p>
                      <p className="text-xs font-mono text-stone-500 mt-0.5">
                        Cód. {u.codigo_usuario ?? '—'}
                      </p>
                      {vinculo && (
                        <p className="text-xs text-stone-500 mt-0.5">Dependente de {vinculo}</p>
                      )}
                    </div>
                    <UsuarioBadges u={u} />
                  </div>
                  <div className="text-sm text-stone-600 space-y-0.5">
                    {u.email && <p>{u.email}</p>}
                    {u.telefone && <p className="font-mono">{formatPhone(u.telefone)}</p>}
                    {u.cpf && <p className="font-mono text-xs text-stone-400">{formatCpf(u.cpf)}</p>}
                    {resumoCamposPlanilha(u).length > 0 && (
                      <p className="text-xs text-stone-500">{resumoCamposPlanilha(u).join(' · ')}</p>
                    )}
                    {u.data_nascimento && (
                      <p className="text-xs text-stone-500">Nasc. {formatDate(u.data_nascimento)}</p>
                    )}
                    {u.data_admissao && (
                      <p className="text-xs text-stone-500">Admissão {formatDate(u.data_admissao)}</p>
                    )}
                  </div>
                  <UsuarioAcoesMobile
                    u={u}
                    adminUserId={adminUserId}
                    onToggleStatus={onToggleStatus}
                    onEditar={onEditar}
                    onExcluir={onExcluir}
                  />
                </div>
              )
            })}
          </div>

          <p className="text-xs text-stone-400 mb-2 hidden md:block">
            Ações fixas à direita. Role horizontalmente para ver e-mail, telefone e CPF.
          </p>

          <div className="motion-card border border-stone-200 hidden md:flex md:flex-col min-h-[520px] max-h-[calc(100vh-11rem)]">
            <div className="flex-1 overflow-auto overscroll-contain">
              <table className="w-full text-sm border-collapse min-w-[1100px]">
                <thead className="border-b">
                  <tr>
                    <SortHeader col="codigo" sort={sort} onSort={alterarOrdenacao}>
                      Usuário
                    </SortHeader>
                    <th className={`text-left px-3 py-3 font-medium text-stone-600 ${TH_STICKY}`}>
                      Matrícula
                    </th>
                    <SortHeader col="nome" sort={sort} onSort={alterarOrdenacao}>
                      Nome
                    </SortHeader>
                    <th className={`text-left px-3 py-3 font-medium text-stone-600 ${TH_STICKY}`}>
                      Tipo
                    </th>
                    <th className={`text-left px-3 py-3 font-medium text-stone-600 ${TH_STICKY}`}>
                      Categoria
                    </th>
                    <th className={`text-left px-3 py-3 font-medium text-stone-600 ${TH_STICKY}`}>
                      Admissão
                    </th>
                    <th className={`text-left px-3 py-3 font-medium text-stone-600 ${TH_STICKY}`}>
                      Nascimento
                    </th>
                    <th className={`text-left px-3 py-3 font-medium text-stone-600 ${TH_STICKY}`}>
                      Parentesco
                    </th>
                    <th className={`text-left px-3 py-3 font-medium text-stone-600 ${TH_STICKY}`}>
                      Sexo
                    </th>
                    <th className={`text-left px-3 py-3 font-medium text-stone-600 ${TH_STICKY}`}>
                      E-mail
                    </th>
                    <th className={`text-left px-3 py-3 font-medium text-stone-600 ${TH_STICKY}`}>
                      Telefone
                    </th>
                    <th className={`text-left px-3 py-3 font-medium text-stone-600 ${TH_STICKY}`}>
                      CPF
                    </th>
                    <th className={`text-left px-3 py-3 font-medium text-stone-600 ${TH_STICKY}`}>
                      Perfil
                    </th>
                    <th
                      className={`text-left px-3 py-3 font-medium text-stone-600 min-w-[10.5rem] ${TH_STICKY_RIGHT}`}
                    >
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosPagina.map((u) => {
                    const vinculo = titularLabel(u)
                    return (
                      <tr key={u.id} className="group border-b last:border-0 hover:bg-stone-50">
                        <td className="px-3 py-2.5 font-mono whitespace-nowrap">
                          {u.codigo_usuario ?? '—'}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-stone-600 whitespace-nowrap">
                          {u.matricula ?? '—'}
                        </td>
                        <td className="px-3 py-2.5 min-w-[12rem] max-w-[16rem]">
                          <div className="line-clamp-2 font-medium text-stone-800">{u.nome}</div>
                          {vinculo && (
                            <div className="text-xs text-stone-500 mt-0.5 line-clamp-2">
                              Dependente de {vinculo}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span
                            className={`text-xs px-2 py-0.5 rounded font-medium ${
                              u.tipo_socio === 'socio'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {u.tipo_socio === 'socio'
                              ? labelCategoriaSocio(u.categoria_socio)
                              : 'Visitante'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-stone-600 text-xs whitespace-nowrap">
                          {labelCategoriaClube(u.categoria_clube)}
                        </td>
                        <td className="px-3 py-2.5 text-stone-500 whitespace-nowrap text-xs">
                          {u.data_admissao ? formatDate(u.data_admissao) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-stone-500 whitespace-nowrap text-xs">
                          {u.data_nascimento ? formatDate(u.data_nascimento) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-stone-600 text-xs whitespace-nowrap">
                          {u.parentesco ?? '—'}
                          {u.numero_dependente != null && (
                            <span className="text-stone-400"> · Dep {u.numero_dependente}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-stone-600 text-xs">{u.sexo ?? '—'}</td>
                        <td className="px-3 py-2.5 text-stone-500 max-w-[11rem] truncate">
                          {u.email || '—'}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-stone-500 whitespace-nowrap text-xs">
                          {u.telefone ? formatPhone(u.telefone) : '—'}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-stone-500 whitespace-nowrap text-xs">
                          {formatCpf(u.cpf)}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
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
                        <td className={`px-3 py-2.5 ${TD_STICKY_RIGHT}`}>
                          <UsuarioAcoesCelula
                            u={u}
                            adminUserId={adminUserId}
                            onToggleStatus={onToggleStatus}
                            onEditar={onEditar}
                            onExcluir={onExcluir}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {(paginas > 1 || totalFiltrados > ITENS_POR_PAGINA_OPCOES[0]) && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
              <div className="flex items-center gap-2 text-sm text-stone-600">
                <label htmlFor="itens-por-pagina" className="whitespace-nowrap">
                  Por página:
                </label>
                <select
                  id="itens-por-pagina"
                  value={itensPorPagina}
                  onChange={(e) => setItensPorPagina(Number(e.target.value) as ItensPorPagina)}
                  className="border rounded-lg px-2 py-1.5 min-h-9"
                >
                  {ITENS_POR_PAGINA_OPCOES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              {paginas > 1 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    disabled={pagina <= 1}
                    onClick={() => setPagina((p) => p - 1)}
                    className={`${BTN_ACAO} bg-stone-100 text-stone-700 hover:bg-stone-200 disabled:opacity-40`}
                  >
                    Anterior
                  </button>
                  <span className="text-sm text-stone-600 px-2">
                    Página {pagina} de {paginas}
                  </span>
                  <button
                    type="button"
                    disabled={pagina >= paginas}
                    onClick={() => setPagina((p) => p + 1)}
                    className={`${BTN_ACAO} bg-stone-100 text-stone-700 hover:bg-stone-200 disabled:opacity-40`}
                  >
                    Próxima
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export { contarUsuariosPendentes }

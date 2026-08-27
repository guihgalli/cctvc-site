import { useState, useEffect, useCallback, useMemo, type FormEvent, type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useAuth } from '../contexts/AuthContext'
import { FeedbackMessage } from '../components/motion/FeedbackMessage'
import { TabPanel } from '../components/motion/TabPanel'
import { Button } from '../components/motion/Button'
import { LazyImage } from '../components/motion/LazyImage'
import { AdminPageSkeleton, AdminUsuariosSkeleton } from '../components/motion/Skeleton'
import { AdminUsuariosSection, contarUsuariosPendentes } from '../components/admin/AdminUsuariosSection'
import { CAMPOS_PLANILHA_VAZIOS, type CamposPlanilhaUsuario } from '../lib/usuarioPlanilha'
import { ConfirmDialog } from '../components/motion/ConfirmDialog'
import { Modal } from '../components/motion/Modal'
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
  deleteUser,
  approveBooking,
  rejectBooking,
  adminLiberarQuadraSocio,
  adminListarLiberacoes,
  adminRevogarLiberacao,
  adminResetUserPassword,
  type LiberacaoQuadra,
} from '../services/api'
import { CourtScheduleEditor, resumirHorarios } from '../components/CourtScheduleEditor'
import { EditUsuarioModal, type UsuarioEditForm } from '../components/EditUsuarioModal'
import {
  formatDate,
  formatTime,
  formatPhone,
  cleanCpf,
  cleanPhone,
  cpfToPassword,
  isValidEmail,
  isValidPhone,
  getErrorMessage,
  prepareCourtPhoto,
  buildWhatsAppReservaConfirmadaUrl,
  formatExpiracaoMinutos,
  formatExpiracaoReserva,
  formatMoney,
} from '../lib/utils'
import { adminTabPath, parseAdminTab, type AdminTab } from '../lib/authRoutes'
import type { CourtScheduleInput, Quadra, Reserva, StatusReserva, TipoQuadra, Usuario } from '../types'
import { labelTipoQuadra, resolveTitularUsuario } from '../lib/bookingRules'

type AbaAdmin = AdminTab

type ConfirmAction =
  | { kind: 'deleteCourt'; quadra: Quadra }
  | { kind: 'deleteUser'; usuario: Usuario }
  | { kind: 'toggleUserStatus'; usuario: Usuario }
  | { kind: 'approve'; reserva: Reserva }
  | null

const STATUS_RESERVA_LABEL: Record<StatusReserva, string> = {
  pendente: 'Pendente',
  confirmada: 'Confirmada',
  recusada: 'Recusada',
  cancelada: 'Cancelada',
}

function statusReservaClass(status: StatusReserva): string {
  switch (status) {
    case 'pendente':
      return 'bg-amber-100 text-amber-800'
    case 'confirmada':
      return 'bg-emerald-100 text-emerald-800'
    case 'recusada':
      return 'bg-red-100 text-red-700'
    case 'cancelada':
      return 'bg-stone-100 text-stone-600'
  }
}

export function AdminPage() {
  const { user: adminUser } = useAuth()
  const navigate = useNavigate()
  const { aba: abaParam } = useParams<{ aba?: string }>()
  const [aba, setAba] = useState<AbaAdmin>('quadras')
  const [abaInicializada, setAbaInicializada] = useState(false)
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
  const [expiracaoPendenteMinutos, setExpiracaoPendenteMinutos] = useState('60')
  const [valorVisitante, setValorVisitante] = useState('')
  const [tipoQuadra, setTipoQuadra] = useState<TipoQuadra>('geral')
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
  const [emailUsuario, setEmailUsuario] = useState('')
  const [telefoneUsuario, setTelefoneUsuario] = useState('')
  const [perfilUsuario, setPerfilUsuario] = useState<'usuario' | 'admin'>('usuario')

  const [filtroQuadra, setFiltroQuadra] = useState('')
  const [filtroData, setFiltroData] = useState('')
  const [filtroPendentes, setFiltroPendentes] = useState(false)
  const [tipoSocioUsuario, setTipoSocioUsuario] = useState<'socio' | 'nao_socio'>('socio')
  const [usuarioEditando, setUsuarioEditando] = useState<Usuario | null>(null)
  const [salvandoUsuario, setSalvandoUsuario] = useState(false)
  const [criandoUsuario, setCriandoUsuario] = useState(false)
  const [campoErrosUsuario, setCampoErrosUsuario] = useState<{
    cpf?: string
    email?: string
    telefone?: string
  }>({})
  const [camposPlanilhaUsuario, setCamposPlanilhaUsuario] =
    useState<CamposPlanilhaUsuario>(CAMPOS_PLANILHA_VAZIOS)

  const [filtroStatus, setFiltroStatus] = useState<'' | StatusReserva>('')
  const [resumo, setResumo] = useState({
    pendentes: 0,
    quadrasInativas: 0,
    totalQuadras: 0,
    totalUsuarios: 0,
  })
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [rejectReservaId, setRejectReservaId] = useState<string | null>(null)
  const [rejectMotivo, setRejectMotivo] = useState('')
  const [rejectLoading, setRejectLoading] = useState(false)
  const [liberacoes, setLiberacoes] = useState<LiberacaoQuadra[]>([])
  const [liberacaoQuadraId, setLiberacaoQuadraId] = useState('')
  const [liberacaoData, setLiberacaoData] = useState('')
  const [liberando, setLiberando] = useState(false)

  const atualizarResumo = useCallback(async () => {
    try {
      const [pendentes, courts, users] = await Promise.all([
        fetchAllBookings({ apenasPendentes: true }),
        fetchAllCourts(),
        fetchUsers(),
      ])
      setResumo({
        pendentes: pendentes.length,
        quadrasInativas: courts.filter((q) => !q.ativo).length,
        totalQuadras: courts.length,
        totalUsuarios: users.length,
      })
    } catch {
      /* resumo opcional */
    }
  }, [])

  useEffect(() => {
    const parsed = parseAdminTab(abaParam)
    if (parsed) {
      setAba(parsed)
      setAbaInicializada(true)
      return
    }
    if (abaParam) {
      navigate('/admin', { replace: true })
    }
  }, [abaParam, navigate])

  useEffect(() => {
    if (abaParam || abaInicializada) return

    let cancelled = false
    async function definirAbaInicial() {
      try {
        const pendentes = await fetchAllBookings({ apenasPendentes: true })
        if (cancelled) return
        const defaultTab: AbaAdmin = pendentes.length > 0 ? 'agenda' : 'quadras'
        setAba(defaultTab)
        navigate(adminTabPath(defaultTab), { replace: true })
      } catch {
        if (!cancelled) setAba('quadras')
      } finally {
        if (!cancelled) setAbaInicializada(true)
      }
    }

    void definirAbaInicial()
    return () => {
      cancelled = true
    }
  }, [abaParam, abaInicializada, navigate])

  useEffect(() => {
    void atualizarResumo()
  }, [atualizarResumo])

  useEffect(() => {
    if (!abaInicializada && !abaParam) return
    carregarDados()
  }, [aba, filtroQuadra, filtroData, filtroPendentes, abaInicializada, abaParam])

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
            apenasPendentes: filtroPendentes,
          })
        )
        if (quadras.length === 0) setQuadras(await fetchAllCourts())
        setLiberacoes(await adminListarLiberacoes())
      } else if (aba === 'usuarios') {
        setUsuarios(await fetchUsers())
      }
    } catch {
      setMessage({ type: 'error', text: 'Erro ao carregar dados.' })
    } finally {
      setLoading(false)
      void atualizarResumo()
    }
  }

  function irParaAba(tab: AbaAdmin) {
    setAba(tab)
    navigate(adminTabPath(tab))
  }

  function resetCamposQuadra() {
    if (previewFotoUrl) URL.revokeObjectURL(previewFotoUrl)
    setNomeQuadra('')
    setDescricaoQuadra('')
    setTipoEsporte('')
    setExpiracaoPendenteMinutos('60')
    setValorVisitante('')
    setTipoQuadra('geral')
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
    setExpiracaoPendenteMinutos(String(quadra.expiracao_pendente_minutos ?? 60))
    setValorVisitante(
      quadra.valor_visitante != null ? String(quadra.valor_visitante) : ''
    )
    setTipoQuadra(quadra.tipo_quadra ?? 'geral')
    setArquivoFoto(null)
    setPreviewFotoUrl(null)
    setFotoAtualUrl(foto?.url || null)
    setMostrarFormQuadra(true)
    setMessage(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSalvarQuadra(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    const editando = Boolean(editandoQuadraId)
    const expiracaoMinutos = Number(expiracaoPendenteMinutos)
    if (!Number.isInteger(expiracaoMinutos) || expiracaoMinutos < 5 || expiracaoMinutos > 10080) {
      setMessage({
        type: 'error',
        text: 'Expiração de reserva pendente deve ser entre 5 minutos e 7 dias (10080 min).',
      })
      return
    }
    const valorVisitanteNum =
      valorVisitante.trim() === '' ? null : Number(valorVisitante.replace(',', '.'))
    if (
      valorVisitanteNum != null &&
      (!Number.isFinite(valorVisitanteNum) || valorVisitanteNum < 0)
    ) {
      setMessage({ type: 'error', text: 'Informe um valor válido para visitantes (>= 0).' })
      return
    }
    setSalvandoQuadra(true)
    try {
      let quadraId = editandoQuadraId

      try {
        if (editandoQuadraId) {
          await updateCourt(editandoQuadraId, {
            nome: nomeQuadra,
            descricao: descricaoQuadra || '',
            tipo_esporte: tipoEsporte || '',
            expiracao_pendente_minutos: expiracaoMinutos,
            valor_visitante: valorVisitanteNum,
            tipo_quadra: tipoQuadra,
          })
        } else {
          const criada = await createCourt({
            nome: nomeQuadra,
            descricao: descricaoQuadra || undefined,
            tipo_esporte: tipoEsporte || undefined,
            expiracao_pendente_minutos: expiracaoMinutos,
            valor_visitante: valorVisitanteNum,
            tipo_quadra: tipoQuadra,
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

  async function executarConfirmacao() {
    if (!confirmAction) return
    setConfirmLoading(true)
    try {
      if (confirmAction.kind === 'deleteCourt') {
        const { quadra } = confirmAction
        await deleteCourt(quadra.id)
        setMessage({ type: 'success', text: 'Quadra excluída!' })
        if (editandoQuadraId === quadra.id) limparFormQuadra()
        await carregarDados()
      } else if (confirmAction.kind === 'deleteUser') {
        await deleteUser(confirmAction.usuario.id)
        setMessage({ type: 'success', text: 'Usuário excluído.' })
        await carregarDados()
      } else if (confirmAction.kind === 'toggleUserStatus') {
        await updateUser(confirmAction.usuario.id, { ativo: false })
        setMessage({ type: 'success', text: `${confirmAction.usuario.nome} foi desativado.` })
        await carregarDados()
      } else if (confirmAction.kind === 'approve') {
        const { reserva } = confirmAction
        const result = await approveBooking(reserva.id)
        setMessage({ type: 'success', text: 'Reserva aprovada!' })
        if (result.telefone) {
          const url = buildWhatsAppReservaConfirmadaUrl(
            result.telefone,
            result.nome,
            result.quadra,
            reserva.data_reserva,
            reserva.hora_inicio,
            reserva.hora_fim
          )
          window.open(url, '_blank', 'noopener,noreferrer')
        } else {
          setMessage({
            type: 'error',
            text: 'Reserva aprovada, mas o usuário não tem WhatsApp cadastrado.',
          })
        }
        await carregarDados()
      }
      setConfirmAction(null)
    } catch (err) {
      if (confirmAction.kind === 'deleteUser') {
        setMessage({
          type: 'error',
          text: err instanceof Error ? err.message : 'Erro ao excluir usuário.',
        })
      } else if (confirmAction.kind === 'toggleUserStatus') {
        setMessage({ type: 'error', text: 'Erro ao desativar usuário.' })
      } else if (confirmAction.kind === 'approve') {
        setMessage({ type: 'error', text: getErrorMessage(err, 'Erro ao aprovar reserva.') })
      } else {
        setMessage({ type: 'error', text: 'Erro ao excluir quadra.' })
      }
    } finally {
      setConfirmLoading(false)
    }
  }

  function handleExcluirQuadra(quadra: Quadra) {
    setConfirmAction({ kind: 'deleteCourt', quadra })
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
    const telefone = cleanPhone(telefoneUsuario)
    const email = emailUsuario.trim().toLowerCase()
    if (cpf.length !== 11) {
      setMessage({ type: 'error', text: 'CPF deve ter 11 dígitos.' })
      return
    }
    if (!isValidEmail(email)) {
      setMessage({ type: 'error', text: 'Informe um e-mail válido.' })
      return
    }
    if (!isValidPhone(telefone)) {
      setMessage({ type: 'error', text: 'Telefone deve ter 10 ou 11 dígitos (com DDD).' })
      return
    }
    setCriandoUsuario(true)
    try {
      await createUser({
        codigo_usuario: codigoUsuario,
        cpf,
        nome: nomeUsuario,
        email,
        telefone,
        perfil: perfilUsuario,
        tipo_socio: tipoSocioUsuario,
        ...camposPlanilhaUsuario,
      })
      setMessage({
        type: 'success',
        text: `Usuário cadastrado! Senha inicial: ${cpfToPassword(cpf)}`,
      })
      setCodigoUsuario('')
      setCpfUsuario('')
      setNomeUsuario('')
      setEmailUsuario('')
      setTelefoneUsuario('')
      setPerfilUsuario('usuario')
      setTipoSocioUsuario('socio')
      setCamposPlanilhaUsuario(CAMPOS_PLANILHA_VAZIOS)
      setCampoErrosUsuario({})
      setMostrarFormUsuario(false)
      carregarDados()
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erro ao cadastrar usuário.',
      })
    } finally {
      setCriandoUsuario(false)
    }
  }

  function validarCampoUsuario(campo: 'cpf' | 'email' | 'telefone') {
    if (campo === 'cpf') {
      const cpf = cleanCpf(cpfUsuario)
      setCampoErrosUsuario((prev) => ({
        ...prev,
        cpf: cpf.length > 0 && cpf.length !== 11 ? 'CPF deve ter 11 dígitos.' : undefined,
      }))
    }
    if (campo === 'email') {
      const email = emailUsuario.trim()
      setCampoErrosUsuario((prev) => ({
        ...prev,
        email: email.length > 0 && !isValidEmail(email) ? 'Informe um e-mail válido.' : undefined,
      }))
    }
    if (campo === 'telefone') {
      const telefone = cleanPhone(telefoneUsuario)
      setCampoErrosUsuario((prev) => ({
        ...prev,
        telefone:
          telefone.length > 0 && !isValidPhone(telefone)
            ? 'Telefone deve ter 10 ou 11 dígitos (com DDD).'
            : undefined,
      }))
    }
  }

  function solicitarToggleStatusUsuario(usuario: Usuario) {
    if (usuario.ativo) {
      setConfirmAction({ kind: 'toggleUserStatus', usuario })
      return
    }
    void handleAlternarUsuario(usuario)
  }

  async function handleAlternarUsuario(usuario: Usuario) {
    try {
      await updateUser(usuario.id, { ativo: !usuario.ativo })
      carregarDados()
    } catch {
      setMessage({ type: 'error', text: 'Erro ao atualizar usuário.' })
    }
  }

  async function handleSalvarUsuarioEditado(id: string, data: UsuarioEditForm) {
    setSalvandoUsuario(true)
    try {
      await updateUser(id, {
        nome: data.nome,
        cpf: data.cpf || undefined,
        email: data.email || undefined,
        telefone: data.telefone || undefined,
        perfil: data.perfil,
        tipo_socio: data.tipo_socio,
        ativo: data.ativo,
        matricula: data.matricula ?? null,
        categoria_clube: data.categoria_clube ?? null,
        data_nascimento: data.data_nascimento ?? null,
        data_admissao: data.data_admissao ?? null,
        parentesco: data.parentesco ?? null,
        sexo: data.sexo ?? null,
        numero_dependente: data.numero_dependente ?? null,
      })
      setUsuarioEditando(null)
      setMessage({ type: 'success', text: 'Usuário atualizado.' })
      await carregarDados()
    } finally {
      setSalvandoUsuario(false)
    }
  }

  async function handleResetPasswordUsuario(id: string, senha: string) {
    await adminResetUserPassword(id, senha)
    setMessage({ type: 'success', text: 'Senha redefinida com sucesso.' })
  }

  async function handleLiberarQuadraSocio(e: FormEvent) {
    e.preventDefault()
    if (!liberacaoQuadraId || !liberacaoData) {
      setMessage({ type: 'error', text: 'Selecione quadra de locação e data.' })
      return
    }
    setLiberando(true)
    try {
      await adminLiberarQuadraSocio(liberacaoQuadraId, liberacaoData)
      setMessage({ type: 'success', text: 'Quadra de locação liberada para sócios nesta data.' })
      setLiberacaoData('')
      setLiberacoes(await adminListarLiberacoes())
    } catch (err) {
      setMessage({ type: 'error', text: getErrorMessage(err, 'Erro ao liberar quadra.') })
    } finally {
      setLiberando(false)
    }
  }

  async function handleRevogarLiberacao(id: string) {
    try {
      await adminRevogarLiberacao(id)
      setLiberacoes(await adminListarLiberacoes())
      setMessage({ type: 'success', text: 'Liberação revogada.' })
    } catch {
      setMessage({ type: 'error', text: 'Erro ao revogar liberação.' })
    }
  }

  function handleExcluirUsuario(usuario: Usuario) {
    if (usuario.id === adminUser?.id) {
      setMessage({ type: 'error', text: 'Você não pode excluir sua própria conta.' })
      return
    }
    setConfirmAction({ kind: 'deleteUser', usuario })
  }

  function handleAprovarReserva(reserva: Reserva) {
    setConfirmAction({ kind: 'approve', reserva })
  }

  function abrirRecusaReserva(reservaId: string) {
    setRejectMotivo('')
    setRejectReservaId(reservaId)
  }

  async function confirmarRecusaReserva() {
    if (!rejectReservaId) return
    setRejectLoading(true)
    try {
      await rejectBooking(rejectReservaId, rejectMotivo.trim() || undefined)
      setMessage({ type: 'success', text: 'Reserva recusada.' })
      setRejectReservaId(null)
      await carregarDados()
    } catch (err) {
      setMessage({ type: 'error', text: getErrorMessage(err, 'Erro ao recusar reserva.') })
    } finally {
      setRejectLoading(false)
    }
  }

  function confirmDialogProps(): {
    title: string
    message: string
    confirmLabel: string
    confirmVariant: 'primary' | 'danger'
    loadingText: string
  } | null {
    if (!confirmAction) return null
    if (confirmAction.kind === 'deleteCourt') {
      return {
        title: 'Excluir quadra',
        message: `Excluir a quadra "${confirmAction.quadra.nome}"? Esta ação remove também as fotos e reservas vinculadas.`,
        confirmLabel: 'Excluir quadra',
        confirmVariant: 'danger',
        loadingText: 'Excluindo...',
      }
    }
    if (confirmAction.kind === 'deleteUser') {
      const tipo = confirmAction.usuario.tipo_socio === 'socio' ? 'sócio' : 'visitante'
      return {
        title: 'Excluir usuário',
        message: `Excluir permanentemente ${confirmAction.usuario.nome} (${tipo})? As reservas deste usuário também serão removidas.`,
        confirmLabel: 'Excluir usuário',
        confirmVariant: 'danger',
        loadingText: 'Excluindo...',
      }
    }
    if (confirmAction.kind === 'toggleUserStatus') {
      return {
        title: 'Desativar usuário',
        message: `Desativar ${confirmAction.usuario.nome}? O usuário não poderá fazer login até ser reativado.`,
        confirmLabel: 'Desativar',
        confirmVariant: 'danger',
        loadingText: 'Desativando...',
      }
    }
    return {
      title: 'Aprovar reserva',
      message: 'Confirmar pagamento e aprovar esta reserva? Um link de WhatsApp será aberto para avisar o usuário.',
      confirmLabel: 'Aprovar + WhatsApp',
      confirmVariant: 'primary',
      loadingText: 'Aprovando...',
    }
  }

  const reservasFiltradas = filtroStatus
    ? reservas.filter((r) => r.status === filtroStatus)
    : reservas

  const usuariosPendentes = useMemo(() => contarUsuariosPendentes(usuarios), [usuarios])

  const dialogProps = confirmDialogProps()

  const abas: { id: AbaAdmin; label: string }[] = [
    { id: 'quadras', label: 'Quadras' },
    { id: 'agenda', label: 'Agenda' },
    { id: 'usuarios', label: 'Usuários' },
  ]

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-emerald-900 mb-2">Painel Administrativo</h1>
        <p className="text-stone-500 text-sm mb-6">
          Gerencie quadras, aprove reservas e administre usuários do clube.
        </p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <button
            type="button"
            onClick={() => irParaAba('agenda')}
            className="motion-card border border-stone-200 p-4 text-left hover:border-amber-300 transition-colors"
          >
            <p className="text-2xl font-bold text-amber-700">{resumo.pendentes}</p>
            <p className="text-xs text-stone-500 mt-1">Reservas pendentes</p>
          </button>
          <button
            type="button"
            onClick={() => irParaAba('quadras')}
            className="motion-card border border-stone-200 p-4 text-left hover:border-emerald-300 transition-colors"
          >
            <p className="text-2xl font-bold text-emerald-800">{resumo.totalQuadras}</p>
            <p className="text-xs text-stone-500 mt-1">Quadras cadastradas</p>
          </button>
          <button
            type="button"
            onClick={() => irParaAba('quadras')}
            className="motion-card border border-stone-200 p-4 text-left hover:border-stone-400 transition-colors"
          >
            <p className="text-2xl font-bold text-stone-700">{resumo.quadrasInativas}</p>
            <p className="text-xs text-stone-500 mt-1">Quadras inativas</p>
          </button>
          <button
            type="button"
            onClick={() => irParaAba('usuarios')}
            className="motion-card border border-stone-200 p-4 text-left hover:border-purple-300 transition-colors"
          >
            <p className="text-2xl font-bold text-purple-700">{resumo.totalUsuarios}</p>
            <p className="text-xs text-stone-500 mt-1">Usuários cadastrados</p>
          </button>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap" role="tablist">
          {abas.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={aba === t.id}
              onClick={() => irParaAba(t.id)}
              className={`motion-tab ${aba === t.id ? 'motion-tab--active' : 'motion-tab--inactive'}`}
            >
              {t.label}
              {t.id === 'agenda' && resumo.pendentes > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-amber-500 text-white text-xs font-bold">
                  {resumo.pendentes}
                </span>
              )}
              {t.id === 'usuarios' && usuariosPendentes > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-purple-500 text-white text-xs font-bold">
                  {usuariosPendentes}
                </span>
              )}
            </button>
          ))}
        </div>

        {message && (
          <FeedbackMessage
            type={message.type === 'success' ? 'success' : 'error'}
            className="mb-4"
            onDismiss={() => setMessage(null)}
            autoHideMs={message.type === 'success' ? 5000 : 0}
          >
            {message.text}
          </FeedbackMessage>
        )}

        {loading ? (
          aba === 'usuarios' ? <AdminUsuariosSkeleton /> : <AdminPageSkeleton />
        ) : (
          <>
        <TabPanel active={aba === 'quadras'}>
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
                className="motion-card border border-stone-200 p-6 mb-6 space-y-4 motion-page-enter"
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
                  <label className="block text-sm font-medium mb-1">
                    Expiração de reserva pendente (minutos)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={10080}
                    step={5}
                    value={expiracaoPendenteMinutos}
                    onChange={(e) => setExpiracaoPendenteMinutos(e.target.value)}
                    className="w-full sm:max-w-xs border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                  <p className="text-xs text-stone-500 mt-1">
                    Reservas de visitantes não confirmadas são canceladas após{' '}
                    {formatExpiracaoMinutos(Number(expiracaoPendenteMinutos) || 60)} e o horário
                    volta a ficar disponível.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Valor para visitantes (R$)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={valorVisitante}
                    onChange={(e) => setValorVisitante(e.target.value)}
                    className="w-full sm:max-w-xs border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Ex.: 80.00"
                  />
                  <p className="text-xs text-stone-500 mt-1">
                    Valor cobrado por reserva de não-sócio nesta quadra. Exibido no modal de
                    confirmação.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Tipo de quadra</label>
                  <select
                    value={tipoQuadra}
                    onChange={(e) => setTipoQuadra(e.target.value as TipoQuadra)}
                    className="w-full sm:max-w-xs border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="socio">Sócios</option>
                    <option value="locacao">Locação (visitantes)</option>
                    <option value="geral">Geral (ambos)</option>
                  </select>
                  <p className="text-xs text-stone-500 mt-1">
                    Configure uma quadra para sócios e outra para locação/visitantes.
                  </p>
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
                  className="motion-btn motion-btn--primary motion-btn--md"
                >
                  {salvandoQuadra ? (
                    <>
                      <span className="motion-spinner motion-spinner--btn" />
                      Salvando...
                    </>
                  ) : editandoQuadraId ? (
                    'Salvar alterações'
                  ) : (
                    'Cadastrar'
                  )}
                </button>
              </form>
            )}

            <div className="space-y-4">
              {quadras.map((quadra, index) => {
                const foto = quadra.fotos_quadras?.find((f) => f.principal) || quadra.fotos_quadras?.[0]
                return (
                  <div
                    key={quadra.id}
                    className={`motion-card border p-4 space-y-3 min-w-0 overflow-hidden motion-stagger-item ${
                      quadra.ativo ? 'border-stone-200' : 'border-stone-200 opacity-60'
                    }`}
                    style={{ '--stagger-index': index } as CSSProperties}
                  >
                    <div className="flex gap-4 items-start min-w-0">
                      {foto ? (
                        <LazyImage
                          src={foto.url}
                          alt={quadra.nome}
                          className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg shrink-0"
                        />
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
                            {quadra.tipo_quadra && quadra.tipo_quadra !== 'geral' && (
                              <p className="text-xs text-emerald-700">
                                {labelTipoQuadra(quadra.tipo_quadra)}
                              </p>
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
                        <p className="mt-1 text-xs text-amber-700">
                          Reserva pendente expira em{' '}
                          {formatExpiracaoMinutos(quadra.expiracao_pendente_minutos ?? 60)}
                          {quadra.valor_visitante != null &&
                            ` · Visitante: ${formatMoney(Number(quadra.valor_visitante))}`}
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
        </TabPanel>

        <TabPanel active={aba === 'agenda'}>
          <div>
            <form
              onSubmit={handleLiberarQuadraSocio}
              className="motion-card border border-emerald-200 bg-emerald-50/50 p-4 mb-4 flex flex-wrap gap-3 items-end"
            >
              <div>
                <p className="text-sm font-medium text-emerald-900 mb-1">
                  Liberar quadra de locação para sócios
                </p>
                <p className="text-xs text-stone-500 mb-2">
                  Quando a quadra de sócios estiver cheia, libere horários na quadra de locação.
                </p>
              </div>
              <select
                value={liberacaoQuadraId}
                onChange={(e) => setLiberacaoQuadraId(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm min-w-[180px]"
                required
              >
                <option value="">Quadra locação...</option>
                {quadras
                  .filter((q) => q.tipo_quadra === 'locacao')
                  .map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.nome}
                    </option>
                  ))}
              </select>
              <input
                type="date"
                value={liberacaoData}
                onChange={(e) => setLiberacaoData(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
                required
              />
              <Button type="submit" variant="primary" loading={liberando} loadingText="Liberando...">
                Liberar dia inteiro
              </Button>
            </form>

            {liberacoes.length > 0 && (
              <div className="mb-4 text-sm">
                <p className="font-medium text-stone-700 mb-2">Liberações ativas</p>
                <ul className="space-y-1">
                  {liberacoes.map((l) => (
                    <li key={l.id} className="flex items-center gap-2 text-stone-600">
                      <span>
                        {l.quadra_nome ?? 'Quadra'} — {formatDate(l.data_reserva)}
                        {l.hora_inicio ? ` ${formatTime(l.hora_inicio)}` : ' (dia inteiro)'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRevogarLiberacao(l.id)}
                        className="text-xs text-red-600 underline"
                      >
                        Revogar
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

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
              <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filtroPendentes}
                  onChange={(e) => {
                    setFiltroPendentes(e.target.checked)
                    if (e.target.checked) setFiltroStatus('')
                  }}
                  className="rounded border-stone-300"
                />
                Apenas pendentes (aguardando pagamento)
              </label>
              {!filtroPendentes && (
                <select
                  value={filtroStatus}
                  onChange={(e) => setFiltroStatus(e.target.value as '' | StatusReserva)}
                  className="border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Todos os status</option>
                  <option value="pendente">Pendente</option>
                  <option value="confirmada">Confirmada</option>
                  <option value="recusada">Recusada</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              )}
            </div>

            {reservasFiltradas.length === 0 ? (
              <div className="motion-card p-8 text-center text-stone-500">
                Nenhuma reserva encontrada.
              </div>
            ) : (
              <>
                <div className="md:hidden space-y-3">
                  {reservasFiltradas.map((r) => (
                    <div key={r.id} className="motion-card border border-stone-200 p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-medium ${statusReservaClass(r.status)}`}
                        >
                          {STATUS_RESERVA_LABEL[r.status]}
                        </span>
                        <span className="text-xs text-stone-500">{formatDate(r.data_reserva)}</span>
                      </div>
                      <div>
                        <p className="font-medium text-emerald-900">{r.quadras?.nome}</p>
                        <p className="text-sm text-stone-600">
                          {formatTime(r.hora_inicio)} – {formatTime(r.hora_fim)}
                        </p>
                      </div>
                      <div className="text-sm">
                        <p>{r.usuarios?.nome}</p>
                        <p className="text-stone-400 text-xs">
                          {r.usuarios?.tipo_socio === 'nao_socio' ? 'Visitante' : 'Sócio'}
                          {r.usuarios?.telefone && ` · ${formatPhone(r.usuarios.telefone)}`}
                        </p>
                        {r.status === 'pendente' && r.criado_em && (
                          <p className="text-amber-700 text-xs mt-1">
                            Expira em{' '}
                            {formatExpiracaoReserva(
                              r.criado_em,
                              r.quadras?.expiracao_pendente_minutos ?? 60
                            )}
                          </p>
                        )}
                      </div>
                      {r.status === 'pendente' && (
                        <div className="flex gap-2 flex-wrap pt-1">
                          <button
                            onClick={() => handleAprovarReserva(r)}
                            className="text-xs bg-emerald-700 text-white px-3 py-1.5 rounded hover:bg-emerald-600"
                          >
                            Aprovar + WhatsApp
                          </button>
                          <button
                            onClick={() => abrirRecusaReserva(r.id)}
                            className="text-xs border border-red-200 text-red-700 px-3 py-1.5 rounded hover:bg-red-50"
                          >
                            Recusar
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="hidden md:block motion-card border border-stone-200 overflow-x-auto">
                  <table className="w-full text-sm min-w-[720px]">
                    <thead className="bg-stone-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-stone-600">Status</th>
                        <th className="text-left px-4 py-3 font-medium text-stone-600">Data</th>
                        <th className="text-left px-4 py-3 font-medium text-stone-600">Horário</th>
                        <th className="text-left px-4 py-3 font-medium text-stone-600">Quadra</th>
                        <th className="text-left px-4 py-3 font-medium text-stone-600">Usuário</th>
                        <th className="text-left px-4 py-3 font-medium text-stone-600">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reservasFiltradas.map((r) => (
                        <tr key={r.id} className="border-b last:border-0 hover:bg-stone-50">
                          <td className="px-4 py-3">
                            <span
                              className={`text-xs px-2 py-0.5 rounded font-medium ${statusReservaClass(r.status)}`}
                            >
                              {STATUS_RESERVA_LABEL[r.status]}
                            </span>
                          </td>
                          <td className="px-4 py-3">{formatDate(r.data_reserva)}</td>
                          <td className="px-4 py-3">
                            {formatTime(r.hora_inicio)} – {formatTime(r.hora_fim)}
                          </td>
                          <td className="px-4 py-3">{r.quadras?.nome}</td>
                          <td className="px-4 py-3">
                            <div>{r.usuarios?.nome}</div>
                            <div className="text-stone-400 text-xs">
                              {r.usuarios?.tipo_socio === 'nao_socio' ? 'Visitante' : 'Sócio'}
                              {r.usuarios?.telefone && ` · ${formatPhone(r.usuarios.telefone)}`}
                            </div>
                            {r.status === 'pendente' && r.criado_em && (
                              <div className="text-amber-700 text-xs mt-1">
                                Expira em{' '}
                                {formatExpiracaoReserva(
                                  r.criado_em,
                                  r.quadras?.expiracao_pendente_minutos ?? 60
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {r.status === 'pendente' ? (
                              <div className="flex gap-2 flex-wrap">
                                <button
                                  onClick={() => handleAprovarReserva(r)}
                                  className="text-xs bg-emerald-700 text-white px-2 py-1 rounded hover:bg-emerald-600"
                                >
                                  Aprovar + WhatsApp
                                </button>
                                <button
                                  onClick={() => abrirRecusaReserva(r.id)}
                                  className="text-xs border border-red-200 text-red-700 px-2 py-1 rounded hover:bg-red-50"
                                >
                                  Recusar
                                </button>
                              </div>
                            ) : (
                              <span className="text-stone-400 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </TabPanel>

        <TabPanel active={aba === 'usuarios'}>
          <AdminUsuariosSection
            usuarios={usuarios}
            adminUserId={adminUser?.id}
            mostrarFormUsuario={mostrarFormUsuario}
            setMostrarFormUsuario={setMostrarFormUsuario}
            codigoUsuario={codigoUsuario}
            setCodigoUsuario={setCodigoUsuario}
            cpfUsuario={cpfUsuario}
            setCpfUsuario={setCpfUsuario}
            nomeUsuario={nomeUsuario}
            setNomeUsuario={setNomeUsuario}
            emailUsuario={emailUsuario}
            setEmailUsuario={setEmailUsuario}
            telefoneUsuario={telefoneUsuario}
            setTelefoneUsuario={setTelefoneUsuario}
            tipoSocioUsuario={tipoSocioUsuario}
            setTipoSocioUsuario={setTipoSocioUsuario}
            perfilUsuario={perfilUsuario}
            setPerfilUsuario={setPerfilUsuario}
            criandoUsuario={criandoUsuario}
            campoErros={campoErrosUsuario}
            onBlurValidarCampo={validarCampoUsuario}
            onCriarUsuario={handleCriarUsuario}
            onToggleStatus={solicitarToggleStatusUsuario}
            onEditar={setUsuarioEditando}
            onExcluir={handleExcluirUsuario}
            camposPlanilha={camposPlanilhaUsuario}
            setCamposPlanilha={setCamposPlanilhaUsuario}
          />
        </TabPanel>
          </>
        )}
      </div>

      {dialogProps && (
        <ConfirmDialog
          open={Boolean(confirmAction)}
          title={dialogProps.title}
          message={dialogProps.message}
          confirmLabel={dialogProps.confirmLabel}
          confirmVariant={dialogProps.confirmVariant}
          loading={confirmLoading}
          loadingText={dialogProps.loadingText}
          onConfirm={executarConfirmacao}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      <Modal
        open={Boolean(rejectReservaId)}
        onClose={() => setRejectReservaId(null)}
        labelledBy="reject-booking-title"
        initialFocus
        maxWidth="sm"
      >
        <h2 id="reject-booking-title" className="text-lg font-bold text-emerald-900 mb-2">
          Recusar reserva
        </h2>
        <p className="text-stone-600 text-sm leading-relaxed mb-4">
          Informe um motivo opcional para a recusa. O usuário não será notificado automaticamente.
        </p>
        <textarea
          value={rejectMotivo}
          onChange={(e) => setRejectMotivo(e.target.value)}
          rows={3}
          placeholder="Motivo da recusa (opcional)"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none mb-4"
        />
        <div className="flex flex-col-reverse sm:flex-row gap-3">
          <Button
            variant="ghost"
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => setRejectReservaId(null)}
            disabled={rejectLoading}
          >
            Voltar
          </Button>
          <Button
            variant="danger"
            size="lg"
            className="w-full flex-1"
            loading={rejectLoading}
            loadingText="Recusando..."
            onClick={confirmarRecusaReserva}
          >
            Recusar reserva
          </Button>
        </div>
      </Modal>

      <EditUsuarioModal
        usuario={usuarioEditando}
        titular={
          usuarioEditando
            ? resolveTitularUsuario(usuarioEditando, usuarios)
            : null
        }
        isSelf={usuarioEditando?.id === adminUser?.id}
        saving={salvandoUsuario}
        onClose={() => setUsuarioEditando(null)}
        onSave={handleSalvarUsuarioEditado}
        onResetPassword={handleResetPasswordUsuario}
      />
    </Layout>
  )
}

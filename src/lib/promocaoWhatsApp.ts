import { formatDate, formatPhone, isValidPhone, cleanPhone } from './utils'
import { LABEL_PUBLICO } from './avisosReserva'
import type { Promocao, PublicoPromocao, Usuario } from '../types'

export type FiltroPublicoContato = PublicoPromocao

export interface ContatoWhatsApp {
  id: string
  nome: string
  telefone: string
  tipo_socio: Usuario['tipo_socio']
  ativo: boolean
}

/** Converte **negrito** do site para *negrito* do WhatsApp */
export function markdownSiteParaWhatsApp(texto: string): string {
  return texto.replace(/\*\*([^*]+)\*\*/g, '*$1*')
}

export function periodoPromocaoTexto(p: Promocao): string | null {
  if (p.data_inicio && p.data_fim) return `${formatDate(p.data_inicio)} a ${formatDate(p.data_fim)}`
  if (p.data_inicio) return `A partir de ${formatDate(p.data_inicio)}`
  if (p.data_fim) return `Até ${formatDate(p.data_fim)}`
  return null
}

/** Monta texto pronto para WhatsApp a partir da promoção cadastrada */
export function buildMensagemPromocaoWhatsApp(
  promocao: Promocao,
  opts?: { nomeContato?: string; nomeQuadra?: string | null }
): string {
  const primeiroNome = opts?.nomeContato?.trim().split(/\s+/)[0]
  const saudacao = primeiroNome ? `Olá, ${primeiroNome}!` : 'Olá!'
  const periodo = periodoPromocaoTexto(promocao)
  const quadra =
    opts?.nomeQuadra && opts.nomeQuadra !== 'Todas as quadras'
      ? opts.nomeQuadra
      : null

  const linhas = [
    saudacao,
    '',
    `*${markdownSiteParaWhatsApp(promocao.titulo)}* — promoção CCTVC`,
  ]

  if (promocao.mensagem?.trim()) {
    linhas.push('', markdownSiteParaWhatsApp(promocao.mensagem.trim()))
  }

  const meta: string[] = []
  if (quadra) meta.push(`Local: ${quadra}`)
  if (periodo) meta.push(`Período: ${periodo}`)
  meta.push(`Público: ${LABEL_PUBLICO[promocao.publico]}`)
  if (meta.length) {
    linhas.push('', meta.join('\n'))
  }

  linhas.push('', 'Mais informações: https://www.cctvc.com.br')
  return linhas.join('\n')
}

export function usuarioParaContatoWhatsApp(u: Usuario): ContatoWhatsApp | null {
  if (!u.ativo) return null
  const telefone = cleanPhone(u.telefone)
  if (!telefone || !isValidPhone(telefone)) return null
  return {
    id: u.id,
    nome: u.nome,
    telefone,
    tipo_socio: u.tipo_socio,
    ativo: u.ativo,
  }
}

export function listarContatosWhatsApp(usuarios: Usuario[]): ContatoWhatsApp[] {
  return usuarios
    .map(usuarioParaContatoWhatsApp)
    .filter((c): c is ContatoWhatsApp => c != null)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export function filtrarContatosWhatsApp(
  contatos: ContatoWhatsApp[],
  opts: { publico: FiltroPublicoContato; busca: string }
): ContatoWhatsApp[] {
  const q = opts.busca.trim().toLowerCase()
  const digitosBusca = cleanPhone(opts.busca)

  return contatos.filter((c) => {
    if (opts.publico === 'socios' && c.tipo_socio !== 'socio') return false
    if (opts.publico === 'visitantes' && c.tipo_socio !== 'nao_socio') return false
    if (!q && !digitosBusca) return true
    const nomeOk = c.nome.toLowerCase().includes(q)
    const foneOk = digitosBusca.length >= 3 && cleanPhone(c.telefone).includes(digitosBusca)
    return nomeOk || foneOk
  })
}

export function formatarTelefoneContato(telefone: string): string {
  return formatPhone(telefone)
}

export const LABEL_FILTRO_PUBLICO: Record<FiltroPublicoContato, string> = {
  todos: 'Todos com WhatsApp',
  socios: 'Sócios',
  visitantes: 'Visitantes',
}

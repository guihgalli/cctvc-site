import { formatMoney } from './utils'
import type { Promocao, PublicoPromocao } from '../types'

export const MENSAGEM_LOCACAO_PADRAO =
  '**Quadra de locação.** A reserva só será confirmada após o pagamento via PIX de **{valor}**. ' +
  'Envie o comprovante pelo WhatsApp dentro do prazo da quadra.'

export const PLACEHOLDER_VALOR = '{valor}'

/** Substitui {valor} pelo valor da quadra; sem valor, remove o trecho "de **{valor}**" */
export function aplicarValorMensagem(template: string, valor: number | null | undefined): string {
  if (valor != null && !Number.isNaN(Number(valor))) {
    return template.split(PLACEHOLDER_VALOR).join(formatMoney(Number(valor)))
  }
  return template
    .replace(/\s+de\s+\*\*\{valor\}\*\*/g, '')
    .split(PLACEHOLDER_VALOR)
    .join('valor informado pela secretaria')
}

export const LABEL_PUBLICO: Record<PublicoPromocao, string> = {
  todos: 'Todos',
  socios: 'Somente sócios',
  visitantes: 'Somente visitantes',
}

export function promocoesVisiveis(
  promocoes: Promocao[],
  quadraId: string | undefined,
  isSocio: boolean
): Promocao[] {
  return promocoes.filter((p) => {
    if (p.quadra_id && p.quadra_id !== quadraId) return false
    if (p.publico === 'socios' && !isSocio) return false
    if (p.publico === 'visitantes' && isSocio) return false
    return true
  })
}

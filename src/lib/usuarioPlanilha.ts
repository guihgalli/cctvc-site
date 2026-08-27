/** Valores e rótulos alinhados à planilha Relatorio_Associados_e_Dependentes.xlsx */

export const CATEGORIA_CLUBE_OPCOES = ['CONTRIBUINTE', 'SOCIO', 'REMIDO'] as const
export type CategoriaClube = (typeof CATEGORIA_CLUBE_OPCOES)[number]

export const PARENTESCO_OPCOES = [
  'ESPOSA(O)',
  'FILHO(A)',
  'COMPANHEIRO(A)',
  'ENTEADO(A)',
  'NOIVO(A)',
] as const

export const SEXO_OPCOES = ['F', 'M'] as const
export type SexoUsuario = (typeof SEXO_OPCOES)[number]

export function labelCategoriaClube(categoria: string | null | undefined): string {
  if (!categoria) return '—'
  return categoria
}

export function labelSexo(sexo: string | null | undefined): string {
  if (sexo === 'F') return 'Feminino'
  if (sexo === 'M') return 'Masculino'
  return '—'
}

export interface CamposPlanilhaUsuario {
  matricula?: number | null
  categoria_clube?: string | null
  data_nascimento?: string | null
  data_admissao?: string | null
  parentesco?: string | null
  sexo?: SexoUsuario | string | null
  numero_dependente?: number | null
}

export const CAMPOS_PLANILHA_VAZIOS: CamposPlanilhaUsuario = {
  matricula: null,
  categoria_clube: null,
  data_nascimento: null,
  data_admissao: null,
  parentesco: null,
  sexo: null,
  numero_dependente: null,
}

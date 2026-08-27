import { labelCategoriaSocio } from './bookingRules'
import { labelCategoriaClube, labelSexo } from './usuarioPlanilha'
import { formatCpf, formatDate, formatPhone } from './utils'
import type { Usuario } from '../types'

function escapeCsvCell(value: string): string {
  if (/[";\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function usuarioToRow(u: Usuario): string[] {
  const titular =
    u.categoria_socio === 'dependente' && u.titular?.nome
      ? `${u.titular.nome}${u.titular.codigo_usuario ? ` (${u.titular.codigo_usuario})` : ''}`
      : ''

  return [
    u.codigo_usuario ?? '',
    u.matricula != null ? String(u.matricula) : '',
    u.nome,
    u.tipo_socio === 'socio' ? labelCategoriaSocio(u.categoria_socio) : 'Visitante',
    labelCategoriaClube(u.categoria_clube),
    u.data_admissao ? formatDate(u.data_admissao) : '',
    u.data_nascimento ? formatDate(u.data_nascimento) : '',
    u.parentesco ?? '',
    u.sexo ? labelSexo(u.sexo) : '',
    u.numero_dependente != null ? String(u.numero_dependente) : '',
    titular,
    u.email ?? '',
    u.telefone ? formatPhone(u.telefone) : '',
    u.cpf ? formatCpf(u.cpf) : '',
    u.perfil === 'admin' ? 'Administrador' : 'Usuário',
    u.ativo ? 'Ativo' : 'Inativo',
  ]
}

const EXPORT_HEADERS = [
  'Usuário',
  'Matrícula',
  'Nome',
  'Tipo',
  'Categoria clube',
  'Admissão',
  'Nascimento',
  'Parentesco',
  'Sexo',
  'Nº dependente',
  'Titular',
  'E-mail',
  'Telefone',
  'CPF',
  'Perfil',
  'Status',
]

/** Excel no Windows abre UTF-16 LE com BOM corretamente; UTF-8 em .xls gera mojibake (UsuÃ¡rio). */
function toExcelCsvBlob(text: string): Blob {
  const bom = new Uint8Array([0xff, 0xfe])
  const bytes = new Uint8Array(text.length * 2)
  const view = new DataView(bytes.buffer)
  for (let i = 0; i < text.length; i++) {
    view.setUint16(i * 2, text.charCodeAt(i), true)
  }
  const combined = new Uint8Array(bom.length + bytes.length)
  combined.set(bom, 0)
  combined.set(bytes, bom.length)
  return new Blob([combined], { type: 'text/csv;charset=utf-16le' })
}

/** Exporta lista filtrada para CSV (;) compatível com Excel no Windows. */
export function exportUsuariosExcel(usuarios: Usuario[], filenamePrefix = 'usuarios-cctvc'): void {
  if (usuarios.length === 0) return

  const sep = ';'
  const linhas = [
    `sep=${sep}`,
    EXPORT_HEADERS.map(escapeCsvCell).join(sep),
    ...usuarios.map((u) => usuarioToRow(u).map(escapeCsvCell).join(sep)),
  ]

  const blob = toExcelCsvBlob(linhas.join('\r\n'))

  const data = new Date()
  const stamp = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filenamePrefix}-${stamp}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

import type { CamposPlanilhaUsuario } from '../../lib/usuarioPlanilha'
import {
  CATEGORIA_CLUBE_OPCOES,
  PARENTESCO_OPCOES,
  SEXO_OPCOES,
} from '../../lib/usuarioPlanilha'

interface UsuarioPlanilhaFieldsProps {
  idPrefix: string
  codigoUsuario?: string
  campos: CamposPlanilhaUsuario
  onChange: (patch: Partial<CamposPlanilhaUsuario>) => void
  disabled?: boolean
}

export function UsuarioPlanilhaFields({
  idPrefix,
  codigoUsuario = '',
  campos,
  onChange,
  disabled = false,
}: UsuarioPlanilhaFieldsProps) {
  const isDependente = /^\d{4}$/.test(codigoUsuario) && !codigoUsuario.endsWith('0')
  const isTitular = /^\d{4}$/.test(codigoUsuario) && codigoUsuario.endsWith('0')

  return (
    <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-stone-100">
      <div>
        <label htmlFor={`${idPrefix}-matricula`} className="block text-sm font-medium mb-1">
          Matrícula
        </label>
        <input
          id={`${idPrefix}-matricula`}
          type="number"
          min={1}
          value={campos.matricula ?? ''}
          onChange={(e) =>
            onChange({
              matricula: e.target.value ? Number(e.target.value) : null,
            })
          }
          disabled={disabled}
          className="w-full border rounded-lg px-3 py-2 font-mono focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-stone-100"
        />
      </div>

      {(isTitular || !codigoUsuario) && (
        <>
          <div>
            <label htmlFor={`${idPrefix}-categoria-clube`} className="block text-sm font-medium mb-1">
              Categoria titular
            </label>
            <select
              id={`${idPrefix}-categoria-clube`}
              value={campos.categoria_clube ?? ''}
              onChange={(e) => onChange({ categoria_clube: e.target.value || null })}
              disabled={disabled}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-stone-100"
            >
              <option value="">—</option>
              {CATEGORIA_CLUBE_OPCOES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${idPrefix}-data-admissao`} className="block text-sm font-medium mb-1">
              Admissão
            </label>
            <input
              id={`${idPrefix}-data-admissao`}
              type="date"
              value={campos.data_admissao ?? ''}
              onChange={(e) => onChange({ data_admissao: e.target.value || null })}
              disabled={disabled}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-stone-100"
            />
          </div>
        </>
      )}

      <div>
        <label htmlFor={`${idPrefix}-data-nascimento`} className="block text-sm font-medium mb-1">
          {isDependente ? 'Nascimento dependente' : 'Nascimento'}
        </label>
        <input
          id={`${idPrefix}-data-nascimento`}
          type="date"
          value={campos.data_nascimento ?? ''}
          onChange={(e) => onChange({ data_nascimento: e.target.value || null })}
          disabled={disabled}
          className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-stone-100"
        />
      </div>

      {(isDependente || !codigoUsuario) && (
        <>
          <div>
            <label htmlFor={`${idPrefix}-parentesco`} className="block text-sm font-medium mb-1">
              Parentesco
            </label>
            <select
              id={`${idPrefix}-parentesco`}
              value={campos.parentesco ?? ''}
              onChange={(e) => onChange({ parentesco: e.target.value || null })}
              disabled={disabled}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-stone-100"
            >
              <option value="">—</option>
              {PARENTESCO_OPCOES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${idPrefix}-sexo`} className="block text-sm font-medium mb-1">
              Sexo
            </label>
            <select
              id={`${idPrefix}-sexo`}
              value={campos.sexo ?? ''}
              onChange={(e) => onChange({ sexo: e.target.value || null })}
              disabled={disabled}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-stone-100"
            >
              <option value="">—</option>
              {SEXO_OPCOES.map((s) => (
                <option key={s} value={s}>
                  {s === 'F' ? 'Feminino' : 'Masculino'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${idPrefix}-numero-dep`} className="block text-sm font-medium mb-1">
              Nº dependente (Dep)
            </label>
            <input
              id={`${idPrefix}-numero-dep`}
              type="number"
              min={1}
              max={9}
              value={campos.numero_dependente ?? ''}
              onChange={(e) =>
                onChange({
                  numero_dependente: e.target.value ? Number(e.target.value) : null,
                })
              }
              disabled={disabled}
              className="w-full border rounded-lg px-3 py-2 font-mono focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-stone-100"
            />
          </div>
        </>
      )}
    </div>
  )
}

export function resumoCamposPlanilha(u: {
  matricula?: number | null
  categoria_clube?: string | null
  data_nascimento?: string | null
  data_admissao?: string | null
  parentesco?: string | null
  sexo?: string | null
  numero_dependente?: number | null
}): string[] {
  const linhas: string[] = []
  if (u.matricula != null) linhas.push(`Matrícula ${u.matricula}`)
  if (u.categoria_clube) linhas.push(u.categoria_clube)
  if (u.parentesco) linhas.push(u.parentesco)
  if (u.sexo) linhas.push(u.sexo === 'F' ? 'Feminino' : 'Masculino')
  if (u.numero_dependente != null) linhas.push(`Dep. ${u.numero_dependente}`)
  return linhas
}

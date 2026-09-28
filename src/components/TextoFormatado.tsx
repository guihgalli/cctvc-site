import { Fragment } from 'react'

/** Renderiza texto simples com **negrito** e quebras de linha (sem HTML) */
export function TextoFormatado({ texto }: { texto: string }) {
  const linhas = texto.split(/\r?\n/)
  return (
    <>
      {linhas.map((linha, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {linha.split(/(\*\*[^*]+\*\*)/g).map((parte, j) =>
            parte.startsWith('**') && parte.endsWith('**') && parte.length > 4 ? (
              <strong key={j}>{parte.slice(2, -2)}</strong>
            ) : (
              <Fragment key={j}>{parte}</Fragment>
            )
          )}
        </Fragment>
      ))}
    </>
  )
}

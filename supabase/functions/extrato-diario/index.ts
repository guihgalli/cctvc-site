import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const BRAZIL_TZ = 'America/Sao_Paulo'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

type ReservaExtrato = {
  id: string
  data_reserva: string
  hora_inicio: string
  hora_fim: string
  status: string
  quadra_nome: string
  usuario_nome: string
  codigo_usuario: string | null
  telefone: string | null
  tipo_socio: string | null
}

type Destinatario = { email: string; nome: string | null }

function brazilIsoDate(date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BRAZIL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(date)
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

function formatDateBr(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function formatTime(t: string): string {
  return t.slice(0, 5)
}

function weekdayShortPt(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString('pt-BR', { weekday: 'short', timeZone: BRAZIL_TZ })
}

function labelStatus(status: string): string {
  if (status === 'pendente') return 'Pendente'
  if (status === 'confirmada') return 'Confirmada'
  return status
}

function labelUsuario(r: ReservaExtrato): string {
  const matricula = r.codigo_usuario ? ` · matr. ${r.codigo_usuario}` : ''
  const tipo = r.tipo_socio === 'nao_socio' ? ' · Visitante' : ''
  return `${r.usuario_nome}${matricula}${tipo}`
}

function buildExtratoContent(
  inicio: string,
  fim: string,
  reservas: ReservaExtrato[]
): { subject: string; text: string; html: string } {
  const subject = `Extrato CCTVC — ${formatDateBr(inicio)} a ${formatDateBr(fim)}`

  const byDate = new Map<string, ReservaExtrato[]>()
  for (let d = inicio; d <= fim; d = addDays(d, 1)) {
    byDate.set(d, [])
  }
  for (const r of reservas) {
    const list = byDate.get(r.data_reserva) ?? []
    list.push(r)
    byDate.set(r.data_reserva, list)
  }

  const textLines: string[] = [`Extrato de reservas — ${formatDateBr(inicio)} a ${formatDateBr(fim)}`, '']

  const htmlParts: string[] = [
    `<h1 style="font-family:sans-serif;color:#064e3b;">Extrato de reservas</h1>`,
    `<p style="font-family:sans-serif;color:#444;">Período: <strong>${formatDateBr(inicio)}</strong> a <strong>${formatDateBr(fim)}</strong></p>`,
  ]

  for (const [data, items] of byDate.entries()) {
    const diaLabel = `${formatDateBr(data)} (${weekdayShortPt(data)})`
    textLines.push(diaLabel)

    htmlParts.push(
      `<h2 style="font-family:sans-serif;color:#065f46;margin-top:1.25em;">${diaLabel}</h2>`
    )

    if (items.length === 0) {
      textLines.push('  (sem reservas)', '')
      htmlParts.push(`<p style="font-family:sans-serif;color:#78716c;">Sem reservas</p>`)
      continue
    }

    const byQuadra = new Map<string, ReservaExtrato[]>()
    for (const r of items) {
      const q = r.quadra_nome
      const list = byQuadra.get(q) ?? []
      list.push(r)
      byQuadra.set(q, list)
    }

    for (const [quadra, slots] of [...byQuadra.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      textLines.push(`  ${quadra}`)
      htmlParts.push(`<p style="font-family:sans-serif;font-weight:600;margin:0.5em 0 0.25em;">${quadra}</p>`)
      htmlParts.push('<ul style="font-family:sans-serif;margin-top:0;">')

      for (const r of slots.sort((a, b) => formatTime(a.hora_inicio).localeCompare(formatTime(b.hora_inicio)))) {
        const line = `    ${formatTime(r.hora_inicio)}–${formatTime(r.hora_fim)} | ${labelUsuario(r)} | ${labelStatus(r.status)}`
        textLines.push(line)
        htmlParts.push(
          `<li>${formatTime(r.hora_inicio)}–${formatTime(r.hora_fim)} · ${labelUsuario(r)} · <strong>${labelStatus(r.status)}</strong></li>`
        )
      }
      htmlParts.push('</ul>')
    }
    textLines.push('')
  }

  textLines.push('—', 'Clube de Caça e Tiro Velha Central (CCTVC)')

  htmlParts.push(
    `<hr style="margin-top:2em;border:none;border-top:1px solid #e7e5e4;" />`,
    `<p style="font-family:sans-serif;font-size:12px;color:#78716c;">Clube de Caça e Tiro Velha Central (CCTVC)</p>`
  )

  return { subject, text: textLines.join('\n'), html: htmlParts.join('\n') }
}

async function sendViaResend(
  apiKey: string,
  from: string,
  to: string[],
  subject: string,
  text: string,
  html: string
): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, text, html }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend ${res.status}: ${body}`)
  }
}

async function isAuthorized(req: Request, pToken?: string): Promise<boolean> {
  const cronSecret = Deno.env.get('CRON_SECRET')
  const auth = req.headers.get('Authorization')
  const cronHeader = req.headers.get('x-cron-secret')

  if (cronSecret && (auth === `Bearer ${cronSecret}` || cronHeader === cronSecret)) {
    return true
  }

  if (!pToken?.trim()) return false

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) return false

  const supabase = createClient(url, serviceKey)
  const { error } = await supabase.rpc('app_require_admin', { p_token: pToken.trim() })
  return !error
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: { p_token?: string } = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const authorized = await isAuthorized(req, body.p_token)
  if (!authorized) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const resendFrom = Deno.env.get('RESEND_FROM')

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Supabase não configurado na function' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!resendKey || !resendFrom) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY ou RESEND_FROM não configurados' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const hoje = brazilIsoDate()
  const fim = addDays(hoje, 2)

  const { data: destData, error: destErr } = await supabase.rpc('listar_extrato_destinatarios_ativos')
  if (destErr) {
    return new Response(JSON.stringify({ error: destErr.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const destinatarios = (destData ?? []) as Destinatario[]
  const emails = destinatarios.map((d) => d.email).filter(Boolean)

  if (emails.length === 0) {
    await supabase.rpc('registrar_extrato_envio', {
      p_destinatarios: [],
      p_qtd_reservas: 0,
      p_ok: true,
      p_erro: 'Nenhum destinatário ativo',
      p_periodo_inicio: hoje,
      p_periodo_fim: fim,
    })

    return new Response(
      JSON.stringify({ ok: true, skipped: true, reason: 'Nenhum destinatário ativo' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const { data: resData, error: resErr } = await supabase.rpc('listar_reservas_extrato', {
    p_inicio: hoje,
    p_fim: fim,
  })

  if (resErr) {
    await supabase.rpc('registrar_extrato_envio', {
      p_destinatarios: emails,
      p_qtd_reservas: 0,
      p_ok: false,
      p_erro: resErr.message,
      p_periodo_inicio: hoje,
      p_periodo_fim: fim,
    })

    return new Response(JSON.stringify({ error: resErr.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const reservas = (resData ?? []) as ReservaExtrato[]
  const { subject, text, html } = buildExtratoContent(hoje, fim, reservas)

  try {
    await sendViaResend(resendKey, resendFrom, emails, subject, text, html)

    await supabase.rpc('registrar_extrato_envio', {
      p_destinatarios: emails,
      p_qtd_reservas: reservas.length,
      p_ok: true,
      p_erro: null,
      p_periodo_inicio: hoje,
      p_periodo_fim: fim,
    })

    return new Response(
      JSON.stringify({
        ok: true,
        destinatarios: emails.length,
        reservas: reservas.length,
        periodo: { inicio: hoje, fim },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)

    await supabase.rpc('registrar_extrato_envio', {
      p_destinatarios: emails,
      p_qtd_reservas: reservas.length,
      p_ok: false,
      p_erro: msg,
      p_periodo_inicio: hoje,
      p_periodo_fim: fim,
    })

    return new Response(JSON.stringify({ error: msg }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

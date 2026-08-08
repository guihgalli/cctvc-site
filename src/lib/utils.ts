/** Remove caracteres não numéricos do CPF */
export function cleanCpf(cpf: string): string {
  return cpf.replace(/\D/g, '')
}

/** Extrai os 3 primeiros dígitos do CPF como senha */
export function cpfToPassword(cpf: string): string {
  const cleaned = cleanCpf(cpf)
  return cleaned.slice(0, 3)
}

/** Valida formato do código de usuário (6 dígitos) */
export function isValidUserCode(code: string): boolean {
  return /^\d{6}$/.test(code)
}

/** Valida formato da senha (3 dígitos) */
export function isValidPassword(password: string): boolean {
  return /^\d{3}$/.test(password)
}

/** Formata CPF para exibição: 000.000.000-00 */
export function formatCpf(cpf: string): string {
  const cleaned = cleanCpf(cpf)
  if (cleaned.length !== 11) return cpf
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

/** Máscara progressiva de CPF durante digitação */
export function maskCpfInput(value: string): string {
  const cleaned = cleanCpf(value).slice(0, 11)
  if (cleaned.length <= 3) return cleaned
  if (cleaned.length <= 6) return cleaned.replace(/(\d{3})(\d+)/, '$1.$2')
  if (cleaned.length <= 9) return cleaned.replace(/(\d{3})(\d{3})(\d+)/, '$1.$2.$3')
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d+)/, '$1.$2.$3-$4')
}

/** Valida se o CPF tem 11 dígitos */
export function isValidCpfLength(cpf: string): boolean {
  return cleanCpf(cpf).length === 11
}

/** Número do WhatsApp da secretaria do clube (E.164 sem +) */
export const CLUBE_WHATSAPP_NUMBER = '5547988080903'

/** Monta URL do WhatsApp solicitando login para o CPF informado */
export function buildWhatsAppLoginRequestUrl(cpf: string): string {
  const formatted = formatCpf(cpf)
  const text = `Olá! Gostaria de solicitar meu login de acesso às reservas do clube. CPF: ${formatted}`
  return `https://wa.me/${CLUBE_WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`
}

/** Formata hora HH:MM */
export function formatTime(time: string): string {
  return time.slice(0, 5)
}

/** Gera slots de horário para um dia */
export function generateTimeSlots(
  startHour = 7,
  endHour = 22,
  intervalMinutes = 60
): { start: string; end: string }[] {
  const slots: { start: string; end: string }[] = []

  for (let hour = startHour; hour < endHour; hour += intervalMinutes / 60) {
    const startH = Math.floor(hour)
    const startM = (hour % 1) * 60
    const endTotal = hour + intervalMinutes / 60
    const endH = Math.floor(endTotal)
    const endM = (endTotal % 1) * 60

    if (endH > endHour || (endH === endHour && endM > 0)) break

    slots.push({
      start: `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`,
      end: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`,
    })
  }

  return slots
}

/** Verifica se data/hora é no passado */
export function isPastDateTime(date: string, time: string): boolean {
  const now = new Date()
  const [year, month, day] = date.split('-').map(Number)
  const [hours, minutes] = time.split(':').map(Number)
  const slotDate = new Date(year, month - 1, day, hours, minutes)
  return slotDate <= now
}

/** Verifica se data é anterior a hoje */
export function isPastDate(date: string): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [year, month, day] = date.split('-').map(Number)
  const checkDate = new Date(year, month - 1, day)
  return checkDate < today
}

/** Formata data para exibição */
export function formatDate(date: string): string {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

const DIAS_SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
const MESES = [
  'JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN',
  'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ',
]

function parseIsoDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** Abreviação do dia da semana (SEX, SÁB, ...) */
export function getWeekdayShort(date: string): string {
  return DIAS_SEMANA[parseIsoDate(date).getDay()]
}

/** Abreviação do mês (AGO, SET, ...) */
export function getMonthShort(date: string): string {
  return MESES[parseIsoDate(date).getMonth()]
}

/** Dia do mês sem zero à esquerda */
export function getDayNumber(date: string): number {
  return parseIsoDate(date).getDate()
}

/** Verifica se a data corresponde ao dia de hoje */
export function isToday(date: string): boolean {
  const today = new Date()
  const d = parseIsoDate(date)
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  )
}

/** Gera uma sequência de datas ISO (YYYY-MM-DD) a partir de hoje */
export function generateDateRange(days: number): string[] {
  const dates: string[] = []
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  for (let i = 0; i < days; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    dates.push(`${y}-${m}-${day}`)
  }
  return dates
}

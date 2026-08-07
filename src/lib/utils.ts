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

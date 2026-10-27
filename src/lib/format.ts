export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

const SCALE = 100000n

// Valori monetari: si lavora sempre in unità da 0,00001 Tosi, senza float.
function units(value: string | number): bigint {
  const match = String(value).trim().match(/^(-?)(\d+)(?:\.(\d+))?$/)
  if (!match) throw new Error('Importo non valido.')
  const fraction = match[3] ?? ''
  const whole = BigInt(match[2]) * SCALE
  const decimals = BigInt(fraction.slice(0, 5).padEnd(5, '0'))
  const rounded = fraction.length > 5 && fraction[5] >= '5' ? 1n : 0n
  return (match[1] ? -1n : 1n) * (whole + decimals + rounded)
}

function fromUnits(value: bigint): string {
  const negative = value < 0n
  const absolute = negative ? -value : value
  const fraction = String(absolute % SCALE).padStart(5, '0').replace(/0+$/, '')
  return `${negative ? '-' : ''}${absolute / SCALE}${fraction ? `.${fraction}` : ''}`
}

// Per i campi digitati: virgola e punto sono separatori decimali, senza separatori delle migliaia.
export function parseTosi(text: string): { value: string; truncated: boolean } | null {
  const match = text.trim().match(/^(?:(\d+)(?:[.,](\d*))?|[.,](\d+))$/)
  if (!match) return null
  const whole = (match[1] ?? '0').replace(/^0+(?=\d)/, '')
  const fraction = match[2] ?? match[3] ?? ''
  const kept = fraction.slice(0, 5).replace(/0+$/, '')
  return { value: `${whole}${kept ? `.${kept}` : ''}`, truncated: fraction.length > 5 }
}

export function exceedsTosiLimit(text: string, wholeLimit: bigint): boolean {
  const match = text.trim().match(/^(?:(\d+)(?:[.,](\d*))?|[.,](\d+))$/)
  if (!match) return false
  const whole = BigInt(match[1] ?? '0')
  const fraction = match[2] ?? match[3] ?? ''
  return whole > wholeLimit || (whole === wholeLimit && /[1-9]/.test(fraction))
}

// Arrotonda a 5 decimali; la quantità opzionale moltiplica senza perdere precisione.
export const money = (value: string | number, quantity = 1): string => fromUnits(units(value) * BigInt(quantity))
export const sumMoney = (values: (string | number)[]): string => fromUnits(values.reduce<bigint>((sum, value) => sum + units(value), 0n))
export const subtractMoney = (left: string | number, right: string | number): string => fromUnits(units(left) - units(right))
// Prezzo di un singolo pezzo di un lotto, arrotondato a 5 decimali come round(x, 5) nel database.
export function perUnit(lotPrice: string | number, lotSize: number): string {
  const amount = units(lotPrice)
  const size = BigInt(lotSize)
  const rounded = (2n * (amount < 0n ? -amount : amount) + size) / (2n * size)
  return fromUnits(amount < 0n ? -rounded : rounded)
}
export const compareMoney = (left: string | number, right: string | number): number => {
  const a = units(left)
  const b = units(right)
  return a < b ? -1 : a > b ? 1 : 0
}

export function fmt(value: string | number): string {
  const normalized = money(value)
  const [whole, fraction] = normalized.split('.')
  const negative = whole.startsWith('-')
  const grouped = (negative ? whole.slice(1) : whole).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${negative ? '-' : ''}${grouped}${fraction ? `,${fraction}` : ''}`
}

export function fmtBalance(value: string | number): string {
  const amount = units(value)
  const negative = amount < 0n
  const absolute = negative ? -amount : amount
  const cents = (absolute + 500n) / 1000n
  const grouped = String(cents / 100n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${negative && cents !== 0n ? '-' : ''}${grouped},${String(cents % 100n).padStart(2, '0')}`
}

export const lots = (n: number): string => `${fmt(n)} ${n === 1 ? 'lotto' : 'lotti'}`

// Come si contano i pezzi in gioco: "2 stack", "1 shulker" (27 stack). Vuoto se non è un numero tondo.
export function stacks(pieces: number, stackSize: number): string {
  const shulker = stackSize * 27
  if (pieces >= shulker && pieces % shulker === 0) return `${fmt(pieces / shulker)} shulker`
  if (stackSize > 1 && pieces % stackSize === 0) return `${fmt(pieces / stackSize)} stack`
  return ''
}

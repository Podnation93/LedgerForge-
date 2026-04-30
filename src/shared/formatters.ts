export function formatAud(cents: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(cents / 100)
}

export function percent(value: number): string {
  return `${Math.round(value)}%`
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

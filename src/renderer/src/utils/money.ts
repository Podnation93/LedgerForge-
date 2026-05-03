export function dollarsToCents(value: string): number {
  const amount = Number(String(value).replace(/[$,]/g, ''))
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0
}

export function centsToDollars(value: number): string {
  return (value / 100).toFixed(2)
}

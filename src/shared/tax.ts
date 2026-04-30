import type { BasFrequency, BasPeriod, TaxCode, Transaction } from './types'

const GST_CODES: TaxCode[] = ['GST_SALES', 'GST_PURCHASES']

export function calculateGstCents(amountCents: number, taxCode: TaxCode): number {
  if (!GST_CODES.includes(taxCode)) return 0
  return Math.round(Math.abs(amountCents) / 11)
}

export function australianFinancialYear(dateIso: string): string {
  const date = new Date(`${dateIso}T00:00:00`)
  const year = date.getFullYear()
  return date.getMonth() >= 6 ? `${year}-${year + 1}` : `${year - 1}-${year}`
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function generateBasPeriods(financialYearStart: number, frequency: BasFrequency): BasPeriod[] {
  const periods: BasPeriod[] = []
  const step = frequency === 'monthly' ? 1 : frequency === 'quarterly' ? 3 : 12
  for (let offset = 0; offset < 12; offset += step) {
    const start = new Date(Date.UTC(financialYearStart, 6 + offset, 1))
    const end = new Date(Date.UTC(financialYearStart, 6 + offset + step, 0))
    periods.push({
      id: `${iso(start)}_${iso(end)}`,
      label:
        frequency === 'annual'
          ? `FY ${financialYearStart}-${financialYearStart + 1}`
          : `${start.toLocaleString('en-AU', { month: 'short' })} ${start.getUTCFullYear()} - ${end.toLocaleString('en-AU', { month: 'short' })} ${end.getUTCFullYear()}`,
      startDate: iso(start),
      endDate: iso(end),
      locked: false,
      gstCollectedCents: 0,
      gstPaidCents: 0,
      netGstCents: 0,
    })
  }
  return periods
}

export function summariseGstForPeriod(transactions: Transaction[], period: BasPeriod): BasPeriod {
  let collected = 0
  let paid = 0
  for (const transaction of transactions) {
    if (transaction.date < period.startDate || transaction.date > period.endDate) continue
    for (const split of transaction.splits) {
      if (split.taxCode === 'GST_SALES') collected += split.gstCents
      if (split.taxCode === 'GST_PURCHASES') paid += split.gstCents
    }
  }
  return {
    ...period,
    gstCollectedCents: collected,
    gstPaidCents: paid,
    netGstCents: collected - paid,
  }
}

export function taxWarnings(transactions: Transaction[]): string[] {
  const warnings: string[] = []
  const uncategorised = transactions.filter((item) => item.splits.length === 0).length
  const missingReceipts = transactions.filter((item) => item.amountCents < 0 && !item.hasReceipt).length
  if (uncategorised) warnings.push(`${uncategorised} transactions still need categories`)
  if (missingReceipts) warnings.push(`${missingReceipts} expense transactions are missing receipts`)
  return warnings
}

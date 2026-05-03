import type { DashboardSummary, TaxCode, Transaction } from '@shared/types'

export const emptySummary: DashboardSummary = {
  revenueCents: 0,
  expensesCents: 0,
  profitCents: 0,
  gstOwedCents: 0,
  cashflow: [],
  categoryBreakdown: [],
  recentTransactions: [],
  warnings: [],
}

export const taxCodes: TaxCode[] = [
  'GST_SALES',
  'GST_PURCHASES',
  'GST_FREE_INCOME',
  'GST_FREE_EXPENSES',
  'INPUT_TAXED',
  'BAS_EXCLUDED',
  'PRIVATE',
]

export const transactionStatuses: Transaction['status'][] = ['imported', 'categorised', 'reconciled']

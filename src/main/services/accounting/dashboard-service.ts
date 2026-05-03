import type Database from 'better-sqlite3'
import type { DashboardSummary } from '@shared/types'
import { generateBasPeriods, summariseGstForPeriod, taxWarnings } from '@shared/tax'
import { SettingsService } from './settings-service'
import { TransactionsService } from './transactions-service'

export class DashboardService {
  private readonly db: Database.Database
  private readonly settingsService: SettingsService
  private readonly transactionsService: TransactionsService

  constructor(db: Database.Database, settingsService: SettingsService, transactionsService: TransactionsService) {
    this.db = db
    this.settingsService = settingsService
    this.transactionsService = transactionsService
  }

  dashboard(): DashboardSummary {
    const transactions = this.transactionsService.listTransactions()
    const revenueCents = transactions.filter((item) => item.amountCents > 0).reduce((sum, item) => sum + item.amountCents, 0)
    const expensesCents = Math.abs(transactions.filter((item) => item.amountCents < 0).reduce((sum, item) => sum + item.amountCents, 0))
    const currentFy = generateBasPeriods(new Date().getFullYear() - (new Date().getMonth() < 6 ? 1 : 0), this.settingsService.getSettings().basFrequency)
    const gstOwedCents = currentFy.map((period) => summariseGstForPeriod(transactions, period)).reduce((sum, period) => sum + period.netGstCents, 0)

    const cashflowMap = new Map<string, { income: number; expenses: number }>()
    for (const txn of transactions) {
      const month = txn.date.slice(0, 7)
      if (!cashflowMap.has(month)) cashflowMap.set(month, { income: 0, expenses: 0 })
      const entry = cashflowMap.get(month)!
      if (txn.amountCents > 0) entry.income += txn.amountCents / 100
      else entry.expenses += Math.abs(txn.amountCents) / 100
    }
    const cashflow = Array.from(cashflowMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, values]) => ({
        month: new Date(`${month}-01T00:00:00`).toLocaleString('en-AU', { month: 'short', year: '2-digit' }),
        ...values,
      }))

    const categoryMap = new Map<string, number>()
    for (const txn of transactions) {
      if (txn.amountCents >= 0) continue
      for (const split of txn.splits) {
        const account = this.db.prepare('SELECT name FROM accounts WHERE id = ?').get(split.accountId) as { name: string } | undefined
        const label = account?.name ?? 'Other'
        categoryMap.set(label, (categoryMap.get(label) ?? 0) + Math.abs(split.amountCents))
      }
    }
    const categoryBreakdown = Array.from(categoryMap.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }))

    return {
      revenueCents,
      expensesCents,
      profitCents: revenueCents - expensesCents,
      gstOwedCents,
      cashflow,
      categoryBreakdown,
      recentTransactions: transactions.slice(0, 6),
      warnings: taxWarnings(transactions),
    }
  }
}

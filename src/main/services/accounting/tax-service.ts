import type Database from 'better-sqlite3'
import type { BasPeriod, BasPeriodReview } from '@shared/types'
import { generateBasPeriods, summariseGstForPeriod, taxWarnings } from '@shared/tax'
import { audit } from '../audit-service'
import { SettingsService } from './settings-service'
import { TransactionsService } from './transactions-service'

export class TaxService {
  private readonly db: Database.Database
  private readonly settingsService: SettingsService
  private readonly transactionsService: TransactionsService

  constructor(db: Database.Database, settingsService: SettingsService, transactionsService: TransactionsService) {
    this.db = db
    this.settingsService = settingsService
    this.transactionsService = transactionsService
  }

  getBasPeriods(): BasPeriod[] {
    const settings = this.settingsService.getSettings()
    const fyStart = new Date().getFullYear() - (new Date().getMonth() < 6 ? 1 : 0)
    const transactions = this.transactionsService.listTransactions()
    const lockedIds = new Set(
      (this.db.prepare('SELECT id FROM bas_periods WHERE locked = 1').all() as Array<{ id: string }>).map((row) => row.id)
    )
    return generateBasPeriods(fyStart, settings.basFrequency).map((period) => ({
      ...summariseGstForPeriod(transactions, period),
      locked: lockedIds.has(period.id),
    }))
  }

  getBasReview(periodId: string): BasPeriodReview {
    const period = this.getBasPeriods().find((candidate) => candidate.id === periodId)
    if (!period) throw new Error('Unknown BAS period')
    const transactions = this.transactionsService.listTransactions().filter((transaction) => transaction.date >= period.startDate && transaction.date <= period.endDate)
    return {
      ...period,
      transactions,
      warnings: taxWarnings(transactions),
    }
  }

  lockBasPeriod(periodId: string): BasPeriod[] {
    const period = this.getBasPeriods().find((candidate) => candidate.id === periodId)
    if (!period) throw new Error('Unknown BAS period')
    this.db
      .prepare('INSERT OR REPLACE INTO bas_periods VALUES (?, ?, ?, ?, ?)')
      .run(period.id, period.label, period.startDate, period.endDate, 1)
    audit(this.db, 'bas.lock', 'bas_period', periodId, period)
    return this.getBasPeriods()
  }
}

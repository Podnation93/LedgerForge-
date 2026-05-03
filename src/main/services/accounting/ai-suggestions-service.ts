import type Database from 'better-sqlite3'
import type { AiSuggestion } from '@shared/types'
import { taxWarnings } from '@shared/tax'
import { audit } from '../audit-service'
import { DashboardService } from './dashboard-service'
import { ReceiptsService } from './receipts-service'
import { SettingsService } from './settings-service'
import { TaxService } from './tax-service'
import { TransactionsService } from './transactions-service'
import type { Row } from './mappers'

export type AiReviewSuggestionInput = Array<{
  targetType: AiSuggestion['targetType']
  targetId: string
  title: string
  rationale: string
  payloadJson: string
}>

export class AiSuggestionsService {
  private readonly db: Database.Database
  private readonly dashboardService: DashboardService
  private readonly receiptsService: ReceiptsService
  private readonly settingsService: SettingsService
  private readonly taxService: TaxService
  private readonly transactionsService: TransactionsService

  constructor(
    db: Database.Database,
    settingsService: SettingsService,
    dashboardService: DashboardService,
    taxService: TaxService,
    transactionsService: TransactionsService,
    receiptsService: ReceiptsService,
  ) {
    this.db = db
    this.settingsService = settingsService
    this.dashboardService = dashboardService
    this.taxService = taxService
    this.transactionsService = transactionsService
    this.receiptsService = receiptsService
  }

  listAiSuggestions(): AiSuggestion[] {
    return (this.db.prepare('SELECT * FROM ai_suggestions ORDER BY created_at DESC').all() as Row[]).map((row) => ({
      id: String(row.id),
      createdAt: String(row.created_at),
      status: row.status as AiSuggestion['status'],
      targetType: row.target_type as AiSuggestion['targetType'],
      targetId: String(row.target_id),
      title: String(row.title),
      rationale: String(row.rationale),
      payloadJson: String(row.payload_json),
    }))
  }

  createAiSuggestion(input: Omit<AiSuggestion, 'id' | 'createdAt' | 'status'>): AiSuggestion {
    const id = crypto.randomUUID()
    this.db
      .prepare('INSERT INTO ai_suggestions VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, new Date().toISOString(), 'PENDING', input.targetType, input.targetId, input.title, input.rationale, input.payloadJson)
    audit(this.db, 'ai_suggestion.create', 'ai_suggestion', id, input)
    return this.listAiSuggestions().find((suggestion) => suggestion.id === id)!
  }

  generateAiReviewSuggestions(): AiSuggestion[] {
    const transactions = this.transactionsService.listTransactions()
    const created: AiSuggestion[] = []
    const missingReceipts = transactions.filter((item) => item.amountCents < 0 && !item.hasReceipt)
    const imported = transactions.filter((item) => item.status === 'imported')

    if (missingReceipts.length > 0) {
      created.push(this.createAiSuggestion({
        targetType: 'transaction',
        targetId: 'missing-receipts',
        title: `${missingReceipts.length} expenses need receipt evidence`,
        rationale: 'Expense transactions without receipts can weaken BAS and deduction support.',
        payloadJson: JSON.stringify({ transactionIds: missingReceipts.map((item) => item.id), recommendedAction: 'attach_receipts' }),
      }))
    }

    if (imported.length > 0) {
      created.push(this.createAiSuggestion({
        targetType: 'transaction',
        targetId: 'imported-transactions',
        title: `${imported.length} imported transactions need categorisation`,
        rationale: 'Imported transactions should be reviewed for account, GST code, and business-use percentage before reports are trusted.',
        payloadJson: JSON.stringify({ transactionIds: imported.map((item) => item.id), recommendedAction: 'categorise' }),
      }))
    }

    for (const warning of taxWarnings(transactions)) {
      created.push(this.createAiSuggestion({
        targetType: 'tax',
        targetId: 'gst-review',
        title: warning,
        rationale: 'Local rule-based review found a tax workflow warning worth checking before export.',
        payloadJson: JSON.stringify({ warning }),
      }))
    }

    return created.length > 0 ? created : [this.createAiSuggestion({
      targetType: 'report',
      targetId: 'review-complete',
      title: 'No urgent local review issues found',
      rationale: 'Current transactions do not show missing receipts or imported-only status warnings.',
      payloadJson: JSON.stringify({ recommendedAction: 'review_reports' }),
    })]
  }

  buildAiReviewContext() {
    return {
      generatedAt: new Date().toISOString(),
      settings: this.settingsService.getSettings(),
      dashboard: this.dashboardService.dashboard(),
      basPeriods: this.taxService.getBasPeriods(),
      transactions: this.transactionsService.listTransactions().slice(0, 100),
      documentImports: this.receiptsService.listDocumentImports().slice(0, 50).map((document) => ({
        id: document.id,
        fileName: document.fileName,
        ocrStatus: document.ocrStatus,
        extractedTextPreview: document.extractedText.slice(0, 1000),
      })),
    }
  }

  createAiSuggestionsFromReview(items: AiReviewSuggestionInput): AiSuggestion[] {
    if (items.length === 0) throw new Error('AI review returned no suggestions')
    return items.map((item) => this.createAiSuggestion(item))
  }

  updateSuggestionStatus(id: string, status: AiSuggestion['status']): AiSuggestion[] {
    this.db.prepare('UPDATE ai_suggestions SET status = ? WHERE id = ?').run(status, id)
    audit(this.db, `ai_suggestion.${status.toLowerCase()}`, 'ai_suggestion', id, {})
    return this.listAiSuggestions()
  }
}

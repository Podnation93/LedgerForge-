import type Database from 'better-sqlite3'
import type {
  Account,
  AiSuggestion,
  AuditLog,
  BasPeriodReview,
  BasPeriod,
  Contact,
  CsvPreview,
  DashboardSummary,
  DocumentImport,
  DocumentImportResult,
  ExportJob,
  Invoice,
  ReceiptAttachment,
  Settings,
  TaxCode,
  Transaction,
} from '@shared/types'
import { AiSuggestionsService, type AiReviewSuggestionInput } from './accounting/ai-suggestions-service'
import { AuditLogService } from './accounting/audit-log-service'
import { ContactsService } from './accounting/contacts-service'
import { DashboardService } from './accounting/dashboard-service'
import { DocumentsService } from './accounting/documents-service'
import { ExportsService } from './accounting/exports-service'
import { ImportsService } from './accounting/imports-service'
import { ReceiptsService } from './accounting/receipts-service'
import { SettingsService } from './accounting/settings-service'
import { TaxService } from './accounting/tax-service'
import { TransactionsService } from './accounting/transactions-service'
import { OcrService } from './ocr-service'

export class AccountingService {
  private readonly ocr = new OcrService()
  private readonly aiSuggestionsService: AiSuggestionsService
  private readonly auditLogService: AuditLogService
  private readonly contactsService: ContactsService
  private readonly dashboardService: DashboardService
  private readonly documentsService: DocumentsService
  private readonly exportsService: ExportsService
  private readonly importsService: ImportsService
  private readonly receiptsService: ReceiptsService
  private readonly settingsService: SettingsService
  private readonly taxService: TaxService
  private readonly transactionsService: TransactionsService

  constructor(db: Database.Database) {
    this.settingsService = new SettingsService(db)
    this.transactionsService = new TransactionsService(db)
    this.auditLogService = new AuditLogService(db)
    this.contactsService = new ContactsService(db)
    this.dashboardService = new DashboardService(db, this.settingsService, this.transactionsService)
    this.documentsService = new DocumentsService(db)
    this.importsService = new ImportsService(db, this.transactionsService)
    this.receiptsService = new ReceiptsService(db, this.ocr)
    this.taxService = new TaxService(db, this.settingsService, this.transactionsService)
    this.aiSuggestionsService = new AiSuggestionsService(db, this.settingsService, this.dashboardService, this.taxService, this.transactionsService, this.receiptsService)
    this.exportsService = new ExportsService(db, this.settingsService, this.dashboardService, this.taxService, this.transactionsService, this.contactsService)
  }

  getSettings(): Settings {
    return this.settingsService.getSettings()
  }

  updateSettings(settings: Partial<Settings>): Settings {
    return this.settingsService.updateSettings(settings)
  }

  listAccounts(): Account[] {
    return this.transactionsService.listAccounts()
  }

  listContacts(): Contact[] {
    return this.contactsService.listContacts()
  }

  upsertContact(input: Omit<Contact, 'id'> & { id?: string }): Contact {
    return this.contactsService.upsertContact(input)
  }

  listTransactions(): Transaction[] {
    return this.transactionsService.listTransactions()
  }

  createTransaction(input: Omit<Transaction, 'id' | 'currency' | 'splits'> & { taxCode: TaxCode; accountId: string }): Transaction {
    return this.transactionsService.createTransaction(input)
  }

  updateTransactionCategorisation(input: {
    id: string
    accountId: string
    taxCode: TaxCode
    hasReceipt: boolean
    businessUsePercent: number
    status: Transaction['status']
  }): Transaction {
    return this.transactionsService.updateTransactionCategorisation(input)
  }

  listDocuments(kind?: Invoice['kind']): Invoice[] {
    return this.documentsService.listDocuments(kind)
  }

  createDocument(input: Omit<Invoice, 'id'>): Invoice {
    return this.documentsService.createDocument(input)
  }

  dashboard(): DashboardSummary {
    return this.dashboardService.dashboard()
  }

  getBasPeriods(): BasPeriod[] {
    return this.taxService.getBasPeriods()
  }

  getBasReview(periodId: string): BasPeriodReview {
    return this.taxService.getBasReview(periodId)
  }

  lockBasPeriod(periodId: string): BasPeriod[] {
    return this.taxService.lockBasPeriod(periodId)
  }

  listAiSuggestions(): AiSuggestion[] {
    return this.aiSuggestionsService.listAiSuggestions()
  }

  createAiSuggestion(input: Omit<AiSuggestion, 'id' | 'createdAt' | 'status'>): AiSuggestion {
    return this.aiSuggestionsService.createAiSuggestion(input)
  }

  generateAiReviewSuggestions(): AiSuggestion[] {
    return this.aiSuggestionsService.generateAiReviewSuggestions()
  }

  buildAiReviewContext() {
    return this.aiSuggestionsService.buildAiReviewContext()
  }

  createAiSuggestionsFromReview(items: AiReviewSuggestionInput): AiSuggestion[] {
    return this.aiSuggestionsService.createAiSuggestionsFromReview(items)
  }

  updateSuggestionStatus(id: string, status: AiSuggestion['status']): AiSuggestion[] {
    return this.aiSuggestionsService.updateSuggestionStatus(id, status)
  }

  importCsv(sourceName: string, csvText: string): { imported: number; duplicates: number } {
    return this.importsService.importCsv(sourceName, csvText)
  }

  previewCsv(sourceName: string, csvText: string): CsvPreview {
    return this.importsService.previewCsv(sourceName, csvText)
  }

  listDocumentImports(): DocumentImport[] {
    return this.receiptsService.listDocumentImports()
  }

  async processDocumentOcr(id: string): Promise<DocumentImport> {
    return this.receiptsService.processDocumentOcr(id)
  }

  async processPendingDocumentOcr(limit = 10): Promise<DocumentImportResult> {
    return this.receiptsService.processPendingDocumentOcr(limit)
  }

  listReceipts(): ReceiptAttachment[] {
    return this.receiptsService.listReceipts()
  }

  attachDocumentToTransaction(input: { transactionId: string; documentImportId: string; notes?: string }): ReceiptAttachment {
    return this.receiptsService.attachDocumentToTransaction(input)
  }

  importDocumentFiles(paths: string[]): DocumentImportResult {
    return this.receiptsService.importDocumentFiles(paths)
  }

  async createExportPack(preset: string): Promise<ExportJob> {
    return this.exportsService.createExportPack(preset)
  }

  listExportJobs(): ExportJob[] {
    return this.exportsService.listExportJobs()
  }

  listAuditLogs(): AuditLog[] {
    return this.auditLogService.listAuditLogs()
  }
}

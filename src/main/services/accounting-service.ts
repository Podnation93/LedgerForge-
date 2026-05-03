import type Database from 'better-sqlite3'
import Papa from 'papaparse'
import JSZip from 'jszip'
import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { createHash } from 'node:crypto'
import { app } from 'electron'
import type {
  Account,
  AiSuggestion,
  AuditLog,
  BasPeriodReview,
  BasPeriod,
  Contact,
  CsvPreview,
  CsvPreviewRow,
  DashboardSummary,
  DocumentImport,
  DocumentImportResult,
  ExportJob,
  Invoice,
  ReceiptAttachment,
  Settings,
  TaxCode,
  Transaction,
  TransactionSplit,
} from '@shared/types'
import { initialOcrStatus, intakeMimeType, isSupportedIntakeFile, sanitizeIntakeFileName } from '@shared/documentIntake'
import { buildExportMetadata, aiExportPrompt } from '@shared/exportPack'
import { normaliseSettings } from '@shared/settingsValidation'
import { generateBasPeriods, summariseGstForPeriod, taxWarnings } from '@shared/tax'
import { audit } from './audit-service'
import { OcrService } from './ocr-service'

type Row = Record<string, unknown>
const MAX_INTAKE_FILES = 500
const MAX_INTAKE_FILE_BYTES = 50 * 1024 * 1024
const TAX_CODES: TaxCode[] = ['GST_SALES', 'GST_PURCHASES', 'GST_FREE_INCOME', 'GST_FREE_EXPENSES', 'INPUT_TAXED', 'BAS_EXCLUDED', 'PRIVATE']
const DOCUMENT_KINDS: Invoice['kind'][] = ['invoice', 'quote', 'bill']
const DOCUMENT_STATUSES: Invoice['status'][] = ['draft', 'sent', 'paid', 'overdue']

function bool(value: unknown): boolean {
  return value === 1 || value === true
}

function mapAccount(row: Row): Account {
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    type: row.type as Account['type'],
    taxCode: row.tax_code as TaxCode,
    balanceCents: Number(row.balance_cents),
  }
}

function mapContact(row: Row): Contact {
  return {
    id: String(row.id),
    type: row.type as Contact['type'],
    name: String(row.name),
    abn: String(row.abn),
    email: String(row.email),
    phone: String(row.phone),
    notes: String(row.notes),
  }
}

function mapDocument(row: Row): Invoice {
  return {
    id: String(row.id),
    kind: row.kind as Invoice['kind'],
    number: String(row.number),
    contactName: String(row.contact_name),
    issueDate: String(row.issue_date),
    dueDate: String(row.due_date),
    status: row.status as Invoice['status'],
    subtotalCents: Number(row.subtotal_cents),
    gstCents: Number(row.gst_cents),
    totalCents: Number(row.total_cents),
  }
}

function mapDocumentImport(row: Row): DocumentImport {
  return {
    id: String(row.id),
    createdAt: String(row.created_at),
    sourcePath: String(row.source_path),
    storedPath: String(row.stored_path),
    fileName: String(row.file_name),
    mimeType: String(row.mime_type),
    sizeBytes: Number(row.size_bytes),
    sha256: String(row.sha256),
    status: row.status as DocumentImport['status'],
    ocrStatus: row.ocr_status as DocumentImport['ocrStatus'],
    extractedText: String(row.extracted_text),
    errorMessage: String(row.error_message),
  }
}

function mapSplit(row: Row): TransactionSplit {
  return {
    id: String(row.id),
    transactionId: String(row.transaction_id),
    accountId: String(row.account_id),
    amountCents: Number(row.amount_cents),
    taxCode: row.tax_code as TaxCode,
    gstCents: Number(row.gst_cents),
    businessUsePercent: Number(row.business_use_percent),
  }
}

function mapTransaction(row: Row, splits: TransactionSplit[]): Transaction {
  return {
    id: String(row.id),
    date: String(row.date),
    description: String(row.description),
    contactName: String(row.contact_name),
    amountCents: Number(row.amount_cents),
    currency: 'AUD',
    status: row.status as Transaction['status'],
    hasReceipt: bool(row.has_receipt),
    reference: String(row.reference),
    splits,
  }
}

function mapReceipt(row: Row): ReceiptAttachment {
  return {
    id: String(row.id),
    transactionId: String(row.transaction_id),
    filePath: String(row.file_path),
    sha256: String(row.sha256),
    notes: String(row.notes),
  }
}

export class AccountingService {
  private readonly db: Database.Database
  private readonly ocr = new OcrService()

  constructor(db: Database.Database) {
    this.db = db
  }

  getSettings(): Settings {
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>
    return Object.fromEntries(rows.map((row) => [row.key, JSON.parse(row.value)])) as unknown as Settings
  }

  updateSettings(settings: Partial<Settings>): Settings {
    const nextSettings = normaliseSettings(settings)
    const insert = this.db.prepare('INSERT OR REPLACE INTO settings VALUES (?, ?)')
    for (const [key, value] of Object.entries(nextSettings)) insert.run(key, JSON.stringify(value))
    audit(this.db, 'settings.update', 'settings', 'app', nextSettings)
    return this.getSettings()
  }

  listAccounts(): Account[] {
    return (this.db.prepare('SELECT * FROM accounts ORDER BY code').all() as Row[]).map(mapAccount)
  }

  listContacts(): Contact[] {
    return (this.db.prepare('SELECT * FROM contacts ORDER BY name').all() as Row[]).map(mapContact)
  }

  upsertContact(input: Omit<Contact, 'id'> & { id?: string }): Contact {
    const id = input.id ?? crypto.randomUUID()
    this.db
      .prepare('INSERT OR REPLACE INTO contacts VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, input.type, input.name, input.abn, input.email, input.phone, input.notes)
    audit(this.db, input.id ? 'contact.update' : 'contact.create', 'contact', id, input)
    return this.listContacts().find((contact) => contact.id === id)!
  }

  listTransactions(): Transaction[] {
    const rows = this.db.prepare('SELECT * FROM transactions ORDER BY date DESC').all() as Row[]
    const splitRows = this.db.prepare('SELECT * FROM transaction_splits').all() as Row[]
    const splits = splitRows.map(mapSplit)
    return rows.map((row) => mapTransaction(row, splits.filter((split) => split.transactionId === row.id)))
  }

  createTransaction(input: Omit<Transaction, 'id' | 'currency' | 'splits'> & { taxCode: TaxCode; accountId: string }): Transaction {
    const id = crypto.randomUUID()
    const gstCents = input.taxCode === 'GST_SALES' || input.taxCode === 'GST_PURCHASES' ? Math.round(Math.abs(input.amountCents) / 11) : 0
    this.db.transaction(() => {
      this.db
        .prepare('INSERT INTO transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, input.date, input.description, input.contactName, input.amountCents, 'AUD', input.status, input.hasReceipt ? 1 : 0, input.reference ?? '')
      this.db
        .prepare('INSERT INTO transaction_splits VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(crypto.randomUUID(), id, input.accountId, input.amountCents, input.taxCode, gstCents, 100)
      audit(this.db, 'transaction.create', 'transaction', id, input)
    })()
    return this.listTransactions().find((transaction) => transaction.id === id)!
  }

  updateTransactionCategorisation(input: {
    id: string
    accountId: string
    taxCode: TaxCode
    hasReceipt: boolean
    businessUsePercent: number
    status: Transaction['status']
  }): Transaction {
    if (!input.id) throw new Error('Transaction id is required')
    const transaction = this.listTransactions().find((item) => item.id === input.id)
    if (!transaction) throw new Error('Unknown transaction')
    if (!TAX_CODES.includes(input.taxCode)) throw new Error('Unknown tax code')
    const account = this.db.prepare('SELECT id FROM accounts WHERE id = ?').get(input.accountId)
    if (!account) throw new Error('Unknown account')
    if (!['imported', 'categorised', 'reconciled'].includes(input.status)) throw new Error('Unknown transaction status')
    const businessUsePercent = Math.max(0, Math.min(100, Math.round(Number(input.businessUsePercent))))
    const gstCents = input.taxCode === 'GST_SALES' || input.taxCode === 'GST_PURCHASES'
      ? Math.round((Math.abs(transaction.amountCents) * businessUsePercent) / 100 / 11)
      : 0

    this.db.transaction(() => {
      this.db.prepare('UPDATE transactions SET status = ?, has_receipt = ? WHERE id = ?').run(input.status, input.hasReceipt ? 1 : 0, input.id)
      this.db.prepare('DELETE FROM transaction_splits WHERE transaction_id = ?').run(input.id)
      this.db
        .prepare('INSERT INTO transaction_splits VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(crypto.randomUUID(), input.id, input.accountId, transaction.amountCents, input.taxCode, gstCents, businessUsePercent)
      audit(this.db, 'transaction.categorise', 'transaction', input.id, { ...input, businessUsePercent, gstCents })
    })()

    return this.listTransactions().find((item) => item.id === input.id)!
  }

  listDocuments(kind?: Invoice['kind']): Invoice[] {
    const sql = kind ? 'SELECT * FROM documents WHERE kind = ? ORDER BY issue_date DESC' : 'SELECT * FROM documents ORDER BY issue_date DESC'
    const rows = (kind ? this.db.prepare(sql).all(kind) : this.db.prepare(sql).all()) as Row[]
    return rows.map(mapDocument)
  }

  createDocument(input: Omit<Invoice, 'id'>): Invoice {
    if (!DOCUMENT_KINDS.includes(input.kind)) throw new Error('Unknown document type')
    if (!DOCUMENT_STATUSES.includes(input.status)) throw new Error('Unknown document status')
    if (!String(input.number).trim()) throw new Error('Document number is required')
    if (!String(input.contactName).trim()) throw new Error('Contact name is required')
    if (Number.isNaN(Date.parse(`${input.issueDate}T00:00:00`))) throw new Error('Issue date is invalid')
    if (Number.isNaN(Date.parse(`${input.dueDate}T00:00:00`))) throw new Error('Due date is invalid')
    if (!Number.isInteger(input.subtotalCents) || input.subtotalCents < 0) throw new Error('Subtotal must be a positive amount')
    if (!Number.isInteger(input.gstCents) || input.gstCents < 0) throw new Error('GST must be a positive amount')
    if (input.totalCents !== input.subtotalCents + input.gstCents) throw new Error('Document total does not match subtotal plus GST')
    const id = crypto.randomUUID()
    this.db
      .prepare('INSERT INTO documents VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, input.kind, input.number.trim(), input.contactName.trim(), input.issueDate, input.dueDate, input.status, input.subtotalCents, input.gstCents, input.totalCents)
    audit(this.db, `${input.kind}.create`, input.kind, id, input)
    return this.listDocuments(input.kind).find((document) => document.id === id)!
  }

  dashboard(): DashboardSummary {
    const transactions = this.listTransactions()
    const revenueCents = transactions.filter((item) => item.amountCents > 0).reduce((sum, item) => sum + item.amountCents, 0)
    const expensesCents = Math.abs(transactions.filter((item) => item.amountCents < 0).reduce((sum, item) => sum + item.amountCents, 0))
    const currentFy = generateBasPeriods(new Date().getFullYear() - (new Date().getMonth() < 6 ? 1 : 0), this.getSettings().basFrequency)
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

  getBasPeriods(): BasPeriod[] {
    const settings = this.getSettings()
    const fyStart = new Date().getFullYear() - (new Date().getMonth() < 6 ? 1 : 0)
    const transactions = this.listTransactions()
    const lockedIds = new Set(
      (this.db.prepare('SELECT id FROM bas_periods WHERE locked = 1').all() as Array<{ id: string }>).map((r) => r.id)
    )
    return generateBasPeriods(fyStart, settings.basFrequency).map((period) => ({
      ...summariseGstForPeriod(transactions, period),
      locked: lockedIds.has(period.id),
    }))
  }

  getBasReview(periodId: string): BasPeriodReview {
    const period = this.getBasPeriods().find((candidate) => candidate.id === periodId)
    if (!period) throw new Error('Unknown BAS period')
    const transactions = this.listTransactions().filter((transaction) => transaction.date >= period.startDate && transaction.date <= period.endDate)
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
    const transactions = this.listTransactions()
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
      settings: this.getSettings(),
      dashboard: this.dashboard(),
      basPeriods: this.getBasPeriods(),
      transactions: this.listTransactions().slice(0, 100),
      documentImports: this.listDocumentImports().slice(0, 50).map((document) => ({
        id: document.id,
        fileName: document.fileName,
        ocrStatus: document.ocrStatus,
        extractedTextPreview: document.extractedText.slice(0, 1000),
      })),
    }
  }

  createAiSuggestionsFromReview(items: Array<{ targetType: AiSuggestion['targetType']; targetId: string; title: string; rationale: string; payloadJson: string }>): AiSuggestion[] {
    if (items.length === 0) throw new Error('AI review returned no suggestions')
    return items.map((item) => this.createAiSuggestion(item))
  }

  updateSuggestionStatus(id: string, status: AiSuggestion['status']): AiSuggestion[] {
    this.db.prepare('UPDATE ai_suggestions SET status = ? WHERE id = ?').run(status, id)
    audit(this.db, `ai_suggestion.${status.toLowerCase()}`, 'ai_suggestion', id, {})
    return this.listAiSuggestions()
  }

  importCsv(sourceName: string, csvText: string): { imported: number; duplicates: number } {
    const preview = this.previewCsv(sourceName, csvText)
    let imported = 0
    let duplicates = 0
    for (const row of preview.rows) {
      if (row.duplicate) {
        duplicates += 1
        continue
      }
      if (row.error) continue
      this.createTransaction({
        date: row.date,
        description: row.description,
        contactName: row.contactName,
        amountCents: row.amountCents,
        status: 'imported',
        hasReceipt: false,
        reference: sourceName,
        accountId: row.amountCents >= 0
          ? ((this.db.prepare("SELECT id FROM accounts WHERE type = 'income' LIMIT 1").get() as { id: string } | undefined)?.id ?? 'acct-sales')
          : ((this.db.prepare("SELECT id FROM accounts WHERE type = 'expense' LIMIT 1").get() as { id: string } | undefined)?.id ?? 'acct-office'),
        taxCode: row.amountCents >= 0 ? 'GST_SALES' : 'GST_PURCHASES',
      })
      imported += 1
    }
    this.db.prepare('INSERT INTO import_jobs VALUES (?, ?, ?, ?, ?)').run(crypto.randomUUID(), new Date().toISOString(), sourceName, imported, duplicates)
    return { imported, duplicates }
  }

  previewCsv(sourceName: string, csvText: string): CsvPreview {
    if (!csvText.trim()) throw new Error('CSV text is required')
    const parsed = Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: true })
    if (parsed.errors.length > 0) throw new Error(parsed.errors[0].message)
    const rows: CsvPreviewRow[] = parsed.data.map((row) => {
      const date = String(row.date ?? row.Date ?? row.transaction_date ?? row['Transaction Date'] ?? '').slice(0, 10)
      const description = String(row.description ?? row.Description ?? row.memo ?? row.Memo ?? '').trim()
      const contactName = String(row.contact ?? row.Contact ?? row.payee ?? row.Payee ?? '').trim()
      const amountRaw = String(row.amount ?? row.Amount ?? row.value ?? row.Value ?? '').replace(/[$,]/g, '')
      const amount = Number(amountRaw)
      const amountCents = Math.round(amount * 100)
      let error = ''
      if (!date || Number.isNaN(Date.parse(`${date}T00:00:00`))) error = 'Missing or invalid date'
      else if (!description) error = 'Missing description'
      else if (!Number.isFinite(amount)) error = 'Missing or invalid amount'
      const duplicate = !error && Boolean(this.db.prepare('SELECT id FROM transactions WHERE date = ? AND description = ? AND amount_cents = ?').get(date, description, amountCents))
      return { date, description, contactName, amountCents, duplicate, error }
    })
    return {
      sourceName,
      rowCount: rows.length,
      importable: rows.filter((row) => !row.duplicate && !row.error).length,
      duplicates: rows.filter((row) => row.duplicate).length,
      errors: rows.filter((row) => row.error).length,
      rows: rows.slice(0, 100),
    }
  }

  listDocumentImports(): DocumentImport[] {
    return (this.db.prepare('SELECT * FROM document_imports ORDER BY created_at DESC LIMIT 250').all() as Row[]).map(mapDocumentImport)
  }

  async processDocumentOcr(id: string): Promise<DocumentImport> {
    const row = this.db.prepare('SELECT * FROM document_imports WHERE id = ?').get(id) as Row | undefined
    if (!row) throw new Error('Unknown imported document')
    const document = mapDocumentImport(row)
    if (document.status !== 'IMPORTED') throw new Error('Only imported documents can be OCR processed')
    if (document.ocrStatus === 'COMPLETE') return document
    this.db.prepare('UPDATE document_imports SET ocr_status = ?, error_message = ? WHERE id = ?').run('PROCESSING', '', id)
    try {
      const result = await this.ocr.extractText(document.storedPath, document.mimeType)
      this.db
        .prepare('UPDATE document_imports SET ocr_status = ?, extracted_text = ?, error_message = ? WHERE id = ?')
        .run('COMPLETE', result.text, `OCR engine: ${result.engine}`, id)
      audit(this.db, 'document_import.ocr_complete', 'document_import', id, { engine: result.engine, textLength: result.text.length })
    } catch (error) {
      this.db
        .prepare('UPDATE document_imports SET ocr_status = ?, error_message = ? WHERE id = ?')
        .run('FAILED', error instanceof Error ? error.message : 'OCR failed', id)
      audit(this.db, 'document_import.ocr_failed', 'document_import', id, { message: error instanceof Error ? error.message : 'OCR failed' })
    }
    return this.listDocumentImports().find((record) => record.id === id)!
  }

  async processPendingDocumentOcr(limit = 10): Promise<DocumentImportResult> {
    const rows = this.db
      .prepare("SELECT * FROM document_imports WHERE status = 'IMPORTED' AND ocr_status IN ('PENDING', 'FAILED') ORDER BY created_at ASC LIMIT ?")
      .all(Math.max(1, Math.min(50, Math.round(Number(limit))))) as Row[]
    const records: DocumentImport[] = []
    let failed = 0
    for (const row of rows) {
      const processed = await this.processDocumentOcr(String(row.id))
      if (processed.ocrStatus === 'FAILED') failed += 1
      records.push(processed)
    }
    return { imported: 0, duplicates: 0, skipped: 0, failed, records }
  }

  listReceipts(): ReceiptAttachment[] {
    return (this.db.prepare('SELECT * FROM receipts ORDER BY id DESC LIMIT 250').all() as Row[]).map(mapReceipt)
  }

  attachDocumentToTransaction(input: { transactionId: string; documentImportId: string; notes?: string }): ReceiptAttachment {
    const transaction = this.db.prepare('SELECT id FROM transactions WHERE id = ?').get(input.transactionId)
    if (!transaction) throw new Error('Unknown transaction')
    const document = this.db.prepare('SELECT * FROM document_imports WHERE id = ?').get(input.documentImportId) as Row | undefined
    if (!document) throw new Error('Unknown imported document')
    const id = crypto.randomUUID()
    this.db.transaction(() => {
      const intakedDir = join(app.getPath('userData'), 'document-intake')
      if (!document.stored_path || typeof document.stored_path !== 'string') {
        throw new Error('Invalid stored path for document')
      }
      if (!document.stored_path.includes(intakedDir)) {
        throw new Error('Stored path is outside allowed directory')
      }
      this.db
        .prepare('INSERT INTO receipts VALUES (?, ?, ?, ?, ?)')
        .run(id, input.transactionId, String(document.stored_path), String(document.sha256), String(input.notes ?? ''))
      this.db.prepare('UPDATE transactions SET has_receipt = 1 WHERE id = ?').run(input.transactionId)
      audit(this.db, 'receipt.attach', 'transaction', input.transactionId, { documentImportId: input.documentImportId })
    })()
    return this.listReceipts().find((receipt) => receipt.id === id)!
  }

  importDocumentFiles(paths: string[]): DocumentImportResult {
    const candidates = this.collectDocumentCandidates(paths)
    const outputDir = join(app.getPath('userData'), 'document-intake')
    mkdirSync(outputDir, { recursive: true })

    const records: DocumentImport[] = []
    let imported = 0
    let duplicates = 0
    let skipped = 0
    let failed = 0

    for (const filePath of candidates) {
      try {
        const stats = statSync(filePath)
        if (!stats.isFile() || !isSupportedIntakeFile(filePath)) {
          skipped += 1
          continue
        }
        if (stats.size > MAX_INTAKE_FILE_BYTES) {
          skipped += 1
          records.push(this.recordSkippedImport(filePath, stats.size, 'File exceeds the 50 MB import limit'))
          continue
        }

        const sha256 = createHash('sha256').update(readFileSync(filePath)).digest('hex')
        const existing = this.db.prepare('SELECT * FROM document_imports WHERE sha256 = ?').get(sha256) as Row | undefined
        if (existing) {
          duplicates += 1
          records.push(mapDocumentImport(existing))
          continue
        }

        const originalName = sanitizeIntakeFileName(basename(filePath))
        const storedName = `${sha256.slice(0, 16)}-${originalName}`
        const storedPath = join(outputDir, storedName)
        copyFileSync(filePath, storedPath)

        const id = crypto.randomUUID()
        const createdAt = new Date().toISOString()
        this.db
          .prepare('INSERT INTO document_imports VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(
            id,
            createdAt,
            filePath,
            storedPath,
            originalName,
            intakeMimeType(originalName),
            stats.size,
            sha256,
            'IMPORTED',
            initialOcrStatus(originalName),
            '',
            '',
          )
        audit(this.db, 'document_import.create', 'document_import', id, { fileName: originalName, sha256, sizeBytes: stats.size })
        imported += 1
        records.push(this.listDocumentImports().find((record) => record.id === id)!)
      } catch (error) {
        failed += 1
        records.push(this.recordFailedImport(filePath, error instanceof Error ? error.message : 'Unable to import file'))
      }
    }

    this.db
      .prepare('INSERT INTO import_jobs VALUES (?, ?, ?, ?, ?)')
      .run(crypto.randomUUID(), new Date().toISOString(), `document-intake:${paths.length}`, imported, duplicates)

    return { imported, duplicates, skipped, failed, records }
  }

  private collectDocumentCandidates(paths: string[]): string[] {
    const queue = [...new Set(paths.filter((path) => typeof path === 'string' && path.trim()))]
    const files: string[] = []
    while (queue.length > 0 && files.length < MAX_INTAKE_FILES) {
      const current = queue.shift()!
      const stats = statSync(current)
      if (stats.isDirectory()) {
        for (const entry of readdirSync(current)) queue.push(join(current, entry))
        continue
      }
      if (stats.isFile()) files.push(current)
    }
    return files
  }

  private recordSkippedImport(filePath: string, sizeBytes: number, reason: string): DocumentImport {
    return {
      id: '',
      createdAt: new Date().toISOString(),
      sourcePath: filePath,
      storedPath: '',
      fileName: sanitizeIntakeFileName(basename(filePath)),
      mimeType: intakeMimeType(filePath),
      sizeBytes,
      sha256: '',
      status: 'SKIPPED',
      ocrStatus: 'UNSUPPORTED',
      extractedText: '',
      errorMessage: reason,
    }
  }

  private recordFailedImport(filePath: string, message: string): DocumentImport {
    return {
      id: '',
      createdAt: new Date().toISOString(),
      sourcePath: filePath,
      storedPath: '',
      fileName: sanitizeIntakeFileName(basename(filePath)),
      mimeType: intakeMimeType(filePath),
      sizeBytes: 0,
      sha256: '',
      status: 'FAILED',
      ocrStatus: 'FAILED',
      extractedText: '',
      errorMessage: message,
    }
  }

  async createExportPack(preset: string): Promise<ExportJob> {
    const settings = this.getSettings()
    const summary = this.dashboard()
    const zip = new JSZip()
    zip.file('metadata/export-info.json', JSON.stringify(buildExportMetadata(settings, summary, preset), null, 2))
    zip.file('data/transactions.json', JSON.stringify(this.listTransactions(), null, 2))
    zip.file('data/contacts.json', JSON.stringify(this.listContacts(), null, 2))
    zip.file('reports/gst-summary.md', this.getBasPeriods().map((period) => `## ${period.label}\nNet GST: ${period.netGstCents}`).join('\n\n'))
    zip.file('ai/prompt.md', aiExportPrompt)
    zip.file('ai/warnings.md', summary.warnings.join('\n'))
    zip.file('audit/export-log.md', `Export preset: ${preset}\nGenerated: ${new Date().toISOString()}`)
    const outputDir = join(app.getPath('documents'), 'LedgerForge AI Exports')
    mkdirSync(outputDir, { recursive: true })
    const filePath = join(outputDir, `${preset.toLowerCase().replace(/\W+/g, '-')}-${Date.now()}.zip`)
    writeFileSync(filePath, await zip.generateAsync({ type: 'nodebuffer' }))
    const id = crypto.randomUUID()
    this.db.prepare('INSERT INTO export_jobs VALUES (?, ?, ?, ?, ?, ?)').run(id, new Date().toISOString(), preset, 'current', filePath, JSON.stringify(summary.warnings))
    audit(this.db, 'export.create', 'export_job', id, { preset, filePath })
    return { id, createdAt: new Date().toISOString(), preset, dateRange: 'current', filePath, warnings: summary.warnings }
  }

  listExportJobs(): ExportJob[] {
    return (this.db.prepare('SELECT * FROM export_jobs ORDER BY created_at DESC LIMIT 100').all() as Row[]).map((row) => ({
      id: String(row.id),
      createdAt: String(row.created_at),
      preset: String(row.preset),
      dateRange: String(row.date_range),
      filePath: String(row.file_path),
      warnings: JSON.parse(String(row.warnings_json)) as string[],
    }))
  }

  listAuditLogs(): AuditLog[] {
    return (this.db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100').all() as Row[]).map((row) => ({
      id: String(row.id),
      createdAt: String(row.created_at),
      actor: String(row.actor),
      action: String(row.action),
      entityType: String(row.entity_type),
      entityId: String(row.entity_id),
      detailsJson: String(row.details_json),
    }))
  }
}

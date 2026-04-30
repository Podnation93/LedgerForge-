import type Database from 'better-sqlite3'
import Papa from 'papaparse'
import JSZip from 'jszip'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import type {
  Account,
  AiSuggestion,
  AuditLog,
  BasPeriod,
  Contact,
  DashboardSummary,
  ExportJob,
  Invoice,
  Settings,
  TaxCode,
  Transaction,
  TransactionSplit,
} from '@shared/types'
import { buildExportMetadata, aiExportPrompt } from '@shared/exportPack'
import { generateBasPeriods, summariseGstForPeriod, taxWarnings } from '@shared/tax'
import { audit } from './audit-service'

type Row = Record<string, unknown>

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

export class AccountingService {
  private readonly db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  getSettings(): Settings {
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>
    return Object.fromEntries(rows.map((row) => [row.key, JSON.parse(row.value)])) as unknown as Settings
  }

  updateSettings(settings: Partial<Settings>): Settings {
    const insert = this.db.prepare('INSERT OR REPLACE INTO settings VALUES (?, ?)')
    for (const [key, value] of Object.entries(settings)) insert.run(key, JSON.stringify(value))
    audit(this.db, 'settings.update', 'settings', 'app', settings)
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

  listDocuments(kind?: Invoice['kind']): Invoice[] {
    const sql = kind ? 'SELECT * FROM documents WHERE kind = ? ORDER BY issue_date DESC' : 'SELECT * FROM documents ORDER BY issue_date DESC'
    const rows = (kind ? this.db.prepare(sql).all(kind) : this.db.prepare(sql).all()) as Row[]
    return rows.map(mapDocument)
  }

  createDocument(input: Omit<Invoice, 'id'>): Invoice {
    const id = crypto.randomUUID()
    this.db
      .prepare('INSERT INTO documents VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, input.kind, input.number, input.contactName, input.issueDate, input.dueDate, input.status, input.subtotalCents, input.gstCents, input.totalCents)
    audit(this.db, `${input.kind}.create`, input.kind, id, input)
    return this.listDocuments(input.kind).find((document) => document.id === id)!
  }

  dashboard(): DashboardSummary {
    const transactions = this.listTransactions()
    const revenueCents = transactions.filter((item) => item.amountCents > 0).reduce((sum, item) => sum + item.amountCents, 0)
    const expensesCents = Math.abs(transactions.filter((item) => item.amountCents < 0).reduce((sum, item) => sum + item.amountCents, 0))
    const currentFy = generateBasPeriods(new Date().getFullYear() - (new Date().getMonth() < 6 ? 1 : 0), this.getSettings().basFrequency)
    const gstOwedCents = currentFy.map((period) => summariseGstForPeriod(transactions, period)).reduce((sum, period) => sum + period.netGstCents, 0)
    return {
      revenueCents,
      expensesCents,
      profitCents: revenueCents - expensesCents,
      gstOwedCents,
      cashflow: [
        { month: 'Jan', income: 18000, expenses: 9000 },
        { month: 'Feb', income: 24000, expenses: 12000 },
        { month: 'Mar', income: 21000, expenses: 8800 },
        { month: 'Apr', income: revenueCents / 100, expenses: expensesCents / 100 },
      ],
      categoryBreakdown: [
        { name: 'Software', value: 9900 },
        { name: 'Office', value: 24200 },
        { name: 'Sales', value: revenueCents },
      ],
      recentTransactions: transactions.slice(0, 6),
      warnings: taxWarnings(transactions),
    }
  }

  getBasPeriods(): BasPeriod[] {
    const settings = this.getSettings()
    const fyStart = new Date().getFullYear() - (new Date().getMonth() < 6 ? 1 : 0)
    const transactions = this.listTransactions()
    return generateBasPeriods(fyStart, settings.basFrequency).map((period) => summariseGstForPeriod(transactions, period))
  }

  lockBasPeriod(periodId: string): BasPeriod[] {
    const period = this.getBasPeriods().find((candidate) => candidate.id === periodId)
    if (!period) throw new Error('Unknown BAS period')
    this.db
      .prepare('INSERT OR REPLACE INTO bas_periods VALUES (?, ?, ?, ?, ?)')
      .run(period.id, period.label, period.startDate, period.endDate, 1)
    audit(this.db, 'bas.lock', 'bas_period', periodId, period)
    return this.getBasPeriods().map((candidate) => (candidate.id === periodId ? { ...candidate, locked: true } : candidate))
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

  updateSuggestionStatus(id: string, status: AiSuggestion['status']): AiSuggestion[] {
    this.db.prepare('UPDATE ai_suggestions SET status = ? WHERE id = ?').run(status, id)
    audit(this.db, `ai_suggestion.${status.toLowerCase()}`, 'ai_suggestion', id, {})
    return this.listAiSuggestions()
  }

  importCsv(sourceName: string, csvText: string): { imported: number; duplicates: number } {
    const parsed = Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: true })
    let imported = 0
    let duplicates = 0
    for (const row of parsed.data) {
      const date = row.date ?? row.Date
      const description = row.description ?? row.Description ?? ''
      const amount = Number(row.amount ?? row.Amount ?? '0')
      const existing = this.db.prepare('SELECT id FROM transactions WHERE date = ? AND description = ? AND amount_cents = ?').get(date, description, Math.round(amount * 100))
      if (existing) {
        duplicates += 1
        continue
      }
      this.createTransaction({
        date,
        description,
        contactName: row.contact ?? row.Contact ?? '',
        amountCents: Math.round(amount * 100),
        status: 'imported',
        hasReceipt: false,
        reference: sourceName,
        accountId: amount >= 0 ? 'acct-sales' : 'acct-office',
        taxCode: amount >= 0 ? 'GST_SALES' : 'GST_PURCHASES',
      })
      imported += 1
    }
    this.db.prepare('INSERT INTO import_jobs VALUES (?, ?, ?, ?, ?)').run(crypto.randomUUID(), new Date().toISOString(), sourceName, imported, duplicates)
    return { imported, duplicates }
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

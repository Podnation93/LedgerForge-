import type Database from 'better-sqlite3'
import Papa from 'papaparse'
import type { CsvPreview, CsvPreviewRow } from '@shared/types'
import { TransactionsService } from './transactions-service'

export class ImportsService {
  private readonly db: Database.Database
  private readonly transactionsService: TransactionsService

  constructor(db: Database.Database, transactionsService: TransactionsService) {
    this.db = db
    this.transactionsService = transactionsService
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
      this.transactionsService.createTransaction({
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
}

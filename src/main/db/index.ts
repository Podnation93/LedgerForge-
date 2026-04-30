import { app } from 'electron'
import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

let connection: Database.Database | null = null

export function getDatabase(): Database.Database {
  if (connection) return connection
  const dataDir = app.isPackaged ? app.getPath('userData') : join(process.cwd(), '.ledgerforge-dev')
  mkdirSync(dataDir, { recursive: true })
  connection = new Database(join(dataDir, 'ledgerforge.db'))
  connection.pragma('journal_mode = WAL')
  connection.pragma('foreign_keys = ON')
  migrate(connection)
  seedDefaults(connection)
  return connection
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      tax_code TEXT NOT NULL,
      balance_cents INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS bank_accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      bsb TEXT NOT NULL DEFAULT '',
      account_number TEXT NOT NULL DEFAULT '',
      balance_cents INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      abn TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      contact_name TEXT NOT NULL DEFAULT '',
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'AUD',
      status TEXT NOT NULL DEFAULT 'imported',
      has_receipt INTEGER NOT NULL DEFAULT 0,
      reference TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS transaction_splits (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      account_id TEXT NOT NULL REFERENCES accounts(id),
      amount_cents INTEGER NOT NULL,
      tax_code TEXT NOT NULL,
      gst_cents INTEGER NOT NULL,
      business_use_percent INTEGER NOT NULL DEFAULT 100
    );
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      number TEXT NOT NULL,
      contact_name TEXT NOT NULL,
      issue_date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      status TEXT NOT NULL,
      subtotal_cents INTEGER NOT NULL,
      gst_cents INTEGER NOT NULL,
      total_cents INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY,
      transaction_id TEXT,
      file_path TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS products_services (
      id TEXT PRIMARY KEY,
      sku TEXT NOT NULL,
      name TEXT NOT NULL,
      price_cents INTEGER NOT NULL,
      tax_code TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tax_codes (
      code TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      rate_basis_points INTEGER NOT NULL,
      bas_treatment TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS bas_periods (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      locked INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS ai_suggestions (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      title TEXT NOT NULL,
      rationale TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ai_messages (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      sources_json TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS import_jobs (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      source_name TEXT NOT NULL,
      row_count INTEGER NOT NULL,
      duplicate_count INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS export_jobs (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      preset TEXT NOT NULL,
      date_range TEXT NOT NULL,
      file_path TEXT NOT NULL,
      warnings_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS backup_jobs (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      file_path TEXT NOT NULL,
      status TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      details_json TEXT NOT NULL
    );
  `)
}

function seedDefaults(db: Database.Database): void {
  const settings = {
    businessName: 'LedgerForge Demo Co',
    abn: '',
    gstRegistered: true,
    gstBasis: 'cash',
    basFrequency: 'quarterly',
    ollamaBaseUrl: 'http://localhost:11434',
    cloudAiEnabled: false,
  }
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
  for (const [key, value] of Object.entries(settings)) insertSetting.run(key, JSON.stringify(value))

  const taxCodes = [
    ['GST_SALES', 'GST on Income / Sales', 1000, 'collected'],
    ['GST_PURCHASES', 'GST on Expenses / Purchases', 1000, 'paid'],
    ['GST_FREE_INCOME', 'GST Free Income', 0, 'excluded'],
    ['GST_FREE_EXPENSES', 'GST Free Expenses', 0, 'excluded'],
    ['INPUT_TAXED', 'Input Taxed', 0, 'excluded'],
    ['BAS_EXCLUDED', 'BAS Excluded / Out of Scope', 0, 'excluded'],
    ['PRIVATE', 'Private / Non-Business', 0, 'private'],
  ]
  const insertTax = db.prepare('INSERT OR IGNORE INTO tax_codes VALUES (?, ?, ?, ?)')
  for (const row of taxCodes) insertTax.run(...row)

  const accounts = [
    ['acct-bank', '100', 'Business Bank Account', 'asset', 'BAS_EXCLUDED', 1245000],
    ['acct-sales', '400', 'Sales Revenue', 'income', 'GST_SALES', 0],
    ['acct-office', '610', 'Office Expenses', 'expense', 'GST_PURCHASES', 0],
    ['acct-software', '620', 'Software Subscriptions', 'expense', 'GST_PURCHASES', 0],
    ['acct-gst', '220', 'GST Clearing', 'liability', 'BAS_EXCLUDED', 0],
  ]
  const insertAccount = db.prepare('INSERT OR IGNORE INTO accounts VALUES (?, ?, ?, ?, ?, ?)')
  for (const row of accounts) insertAccount.run(...row)

  const existingTransactions = db.prepare('SELECT COUNT(*) as count FROM transactions').get() as { count: number }
  if (existingTransactions.count === 0) {
    const insertTransaction = db.prepare('INSERT INTO transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    const insertSplit = db.prepare('INSERT INTO transaction_splits VALUES (?, ?, ?, ?, ?, ?, ?)')
    const samples = [
      ['txn-1', '2026-04-03', 'Website project deposit', 'Northbank Studio', 660000, 'AUD', 'reconciled', 1, 'INV-1001', 'acct-sales', 'GST_SALES'],
      ['txn-2', '2026-04-08', 'Design software subscription', 'Figma', -9900, 'AUD', 'categorised', 0, 'CARD', 'acct-software', 'GST_PURCHASES'],
      ['txn-3', '2026-04-18', 'Office supplies', 'Officeworks', -24200, 'AUD', 'categorised', 0, 'CARD', 'acct-office', 'GST_PURCHASES'],
      ['txn-4', '2026-04-21', 'Consulting income', 'Valiant Kahn', 330000, 'AUD', 'reconciled', 1, 'INV-1002', 'acct-sales', 'GST_SALES'],
    ]
    for (const row of samples) {
      insertTransaction.run(...row.slice(0, 9))
      const amount = row[4] as number
      const taxCode = row[10] as string
      const gst = taxCode === 'GST_SALES' || taxCode === 'GST_PURCHASES' ? Math.round(Math.abs(amount) / 11) : 0
      insertSplit.run(`${row[0]}-split`, row[0], row[9], amount, taxCode, gst, 100)
    }
  }

  const existingDocs = db.prepare('SELECT COUNT(*) as count FROM documents').get() as { count: number }
  if (existingDocs.count === 0) {
    db.prepare('INSERT INTO documents VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      'doc-inv-1001',
      'invoice',
      'INV-1001',
      'Northbank Studio',
      '2026-04-01',
      '2026-04-15',
      'paid',
      600000,
      60000,
      660000,
    )
  }
}

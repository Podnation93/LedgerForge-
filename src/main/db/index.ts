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
  removeBundledDemoData(connection)
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
    CREATE TABLE IF NOT EXISTS document_imports (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      source_path TEXT NOT NULL,
      stored_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      status TEXT NOT NULL,
      ocr_status TEXT NOT NULL,
      extracted_text TEXT NOT NULL DEFAULT '',
      error_message TEXT NOT NULL DEFAULT ''
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_document_imports_sha256 ON document_imports (sha256);
    CREATE INDEX IF NOT EXISTS idx_document_imports_created_at ON document_imports (created_at);
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
    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS budget_lines (
      id TEXT PRIMARY KEY,
      budget_id TEXT NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
      account_id TEXT NOT NULL REFERENCES accounts(id),
      amount_cents INTEGER NOT NULL,
      spent_cents INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_budgets_active ON budgets (is_active);
    CREATE INDEX IF NOT EXISTS idx_budget_lines_budget ON budget_lines (budget_id);
    CREATE INDEX IF NOT EXISTS idx_budget_lines_account ON budget_lines (account_id);
  `)
}

function seedDefaults(db: Database.Database): void {
  const settings = {
    businessName: 'LedgerForge',
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
    ['acct-bank', '100', 'Business Bank Account', 'asset', 'BAS_EXCLUDED', 0],
    ['acct-sales', '400', 'Sales Revenue', 'income', 'GST_SALES', 0],
    ['acct-office', '610', 'Office Expenses', 'expense', 'GST_PURCHASES', 0],
    ['acct-software', '620', 'Software Subscriptions', 'expense', 'GST_PURCHASES', 0],
    ['acct-gst', '220', 'GST Clearing', 'liability', 'BAS_EXCLUDED', 0],
  ]
  const insertAccount = db.prepare('INSERT OR IGNORE INTO accounts VALUES (?, ?, ?, ?, ?, ?)')
  for (const row of accounts) insertAccount.run(...row)
}

function removeBundledDemoData(db: Database.Database): void {
  db.prepare("UPDATE settings SET value = ? WHERE key = 'businessName' AND value = ?").run(JSON.stringify('LedgerForge'), JSON.stringify('LedgerForge Demo Co'))
  db.prepare("UPDATE accounts SET balance_cents = 0 WHERE id = 'acct-bank' AND balance_cents = 1245000").run()
  db.prepare("DELETE FROM transactions WHERE id IN ('txn-1', 'txn-2', 'txn-3', 'txn-4')").run()
  db.prepare("DELETE FROM documents WHERE id = 'doc-inv-1001'").run()
}

import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  taxCode: text('tax_code').notNull(),
  balanceCents: integer('balance_cents').notNull().default(0),
})

export const bankAccounts = sqliteTable('bank_accounts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  bsb: text('bsb').notNull().default(''),
  accountNumber: text('account_number').notNull().default(''),
  balanceCents: integer('balance_cents').notNull().default(0),
})

export const contacts = sqliteTable('contacts', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  name: text('name').notNull(),
  abn: text('abn').notNull().default(''),
  email: text('email').notNull().default(''),
  phone: text('phone').notNull().default(''),
  notes: text('notes').notNull().default(''),
})

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  date: text('date').notNull(),
  description: text('description').notNull(),
  contactName: text('contact_name').notNull().default(''),
  amountCents: integer('amount_cents').notNull(),
  currency: text('currency').notNull().default('AUD'),
  status: text('status').notNull().default('imported'),
  hasReceipt: integer('has_receipt').notNull().default(0),
  reference: text('reference').notNull().default(''),
})

export const transactionSplits = sqliteTable('transaction_splits', {
  id: text('id').primaryKey(),
  transactionId: text('transaction_id').notNull().references(() => transactions.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull().references(() => accounts.id),
  amountCents: integer('amount_cents').notNull(),
  taxCode: text('tax_code').notNull(),
  gstCents: integer('gst_cents').notNull(),
  businessUsePercent: integer('business_use_percent').notNull().default(100),
})

export const documents = sqliteTable('documents', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(),
  number: text('number').notNull(),
  contactName: text('contact_name').notNull(),
  issueDate: text('issue_date').notNull(),
  dueDate: text('due_date').notNull(),
  status: text('status').notNull(),
  subtotalCents: integer('subtotal_cents').notNull(),
  gstCents: integer('gst_cents').notNull(),
  totalCents: integer('total_cents').notNull(),
})

export const receipts = sqliteTable('receipts', {
  id: text('id').primaryKey(),
  transactionId: text('transaction_id'),
  filePath: text('file_path').notNull(),
  sha256: text('sha256').notNull(),
  notes: text('notes').notNull().default(''),
})

export const documentImports = sqliteTable('document_imports', {
  id: text('id').primaryKey(),
  createdAt: text('created_at').notNull(),
  sourcePath: text('source_path').notNull(),
  storedPath: text('stored_path').notNull(),
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  sha256: text('sha256').notNull(),
  status: text('status').notNull(),
  ocrStatus: text('ocr_status').notNull(),
  extractedText: text('extracted_text').notNull().default(''),
  errorMessage: text('error_message').notNull().default(''),
}, (table) => [
  uniqueIndex('idx_document_imports_sha256').on(table.sha256),
  index('idx_document_imports_created_at').on(table.createdAt),
])

export const productsServices = sqliteTable('products_services', {
  id: text('id').primaryKey(),
  sku: text('sku').notNull(),
  name: text('name').notNull(),
  priceCents: integer('price_cents').notNull(),
  taxCode: text('tax_code').notNull(),
})

export const taxCodes = sqliteTable('tax_codes', {
  code: text('code').primaryKey(),
  label: text('label').notNull(),
  rateBasisPoints: integer('rate_basis_points').notNull(),
  basTreatment: text('bas_treatment').notNull(),
})

export const basPeriods = sqliteTable('bas_periods', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  locked: integer('locked').notNull().default(0),
})

export const aiSuggestions = sqliteTable('ai_suggestions', {
  id: text('id').primaryKey(),
  createdAt: text('created_at').notNull(),
  status: text('status').notNull(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id').notNull(),
  title: text('title').notNull(),
  rationale: text('rationale').notNull(),
  payloadJson: text('payload_json').notNull(),
})

export const aiMessages = sqliteTable('ai_messages', {
  id: text('id').primaryKey(),
  createdAt: text('created_at').notNull(),
  role: text('role').notNull(),
  content: text('content').notNull(),
  sourcesJson: text('sources_json').notNull().default('[]'),
})

export const importJobs = sqliteTable('import_jobs', {
  id: text('id').primaryKey(),
  createdAt: text('created_at').notNull(),
  sourceName: text('source_name').notNull(),
  rowCount: integer('row_count').notNull(),
  duplicateCount: integer('duplicate_count').notNull(),
})

export const exportJobs = sqliteTable('export_jobs', {
  id: text('id').primaryKey(),
  createdAt: text('created_at').notNull(),
  preset: text('preset').notNull(),
  dateRange: text('date_range').notNull(),
  filePath: text('file_path').notNull(),
  warningsJson: text('warnings_json').notNull(),
})

export const backupJobs = sqliteTable('backup_jobs', {
  id: text('id').primaryKey(),
  createdAt: text('created_at').notNull(),
  filePath: text('file_path').notNull(),
  status: text('status').notNull(),
})

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  createdAt: text('created_at').notNull(),
  actor: text('actor').notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  detailsJson: text('details_json').notNull(),
})

export const budgets = sqliteTable('budgets', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  isActive: integer('is_active').notNull().default(1),
}, (table) => [
  index('idx_budgets_active').on(table.isActive),
])

export const budgetLines = sqliteTable('budget_lines', {
  id: text('id').primaryKey(),
  budgetId: text('budget_id').notNull().references(() => budgets.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull().references(() => accounts.id),
  amountCents: integer('amount_cents').notNull(),
  spentCents: integer('spent_cents').notNull().default(0),
}, (table) => [
  index('idx_budget_lines_budget').on(table.budgetId),
  index('idx_budget_lines_account').on(table.accountId),
])

export const ledgerforgeTables = [
  settings,
  accounts,
  bankAccounts,
  contacts,
  transactions,
  transactionSplits,
  documents,
  receipts,
  documentImports,
  productsServices,
  taxCodes,
  basPeriods,
  aiSuggestions,
  aiMessages,
  importJobs,
  exportJobs,
  backupJobs,
  auditLogs,
  budgets,
  budgetLines,
] as const

export const schema = {
  settings,
  accounts,
  bankAccounts,
  contacts,
  transactions,
  transactionSplits,
  documents,
  receipts,
  documentImports,
  productsServices,
  taxCodes,
  basPeriods,
  aiSuggestions,
  aiMessages,
  importJobs,
  exportJobs,
  backupJobs,
  auditLogs,
  budgets,
  budgetLines,
}

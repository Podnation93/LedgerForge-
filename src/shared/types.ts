export type IpcResult<T> = { data: T } | { error: string }

export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense'
export type TaxCode =
  | 'GST_SALES'
  | 'GST_PURCHASES'
  | 'GST_FREE_INCOME'
  | 'GST_FREE_EXPENSES'
  | 'INPUT_TAXED'
  | 'BAS_EXCLUDED'
  | 'PRIVATE'

export type BasFrequency = 'monthly' | 'quarterly' | 'annual'
export type GstBasis = 'cash' | 'accrual'
export type SuggestionStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface Account {
  id: string
  code: string
  name: string
  type: AccountType
  taxCode: TaxCode
  balanceCents: number
}

export interface TransactionSplit {
  id: string
  transactionId: string
  accountId: string
  amountCents: number
  taxCode: TaxCode
  gstCents: number
  businessUsePercent: number
}

export interface ReceiptAttachment {
  id: string
  transactionId: string
  filePath: string
  sha256: string
  notes: string
}

export interface Transaction {
  id: string
  date: string
  description: string
  contactName: string
  amountCents: number
  currency: 'AUD'
  status: 'imported' | 'categorised' | 'reconciled'
  hasReceipt: boolean
  reference?: string
  splits: TransactionSplit[]
}

export interface Contact {
  id: string
  type: 'customer' | 'supplier' | 'both'
  name: string
  abn: string
  email: string
  phone: string
  notes: string
}

export interface Invoice {
  id: string
  kind: 'invoice' | 'quote' | 'bill'
  number: string
  contactName: string
  issueDate: string
  dueDate: string
  status: 'draft' | 'sent' | 'paid' | 'overdue'
  subtotalCents: number
  gstCents: number
  totalCents: number
}

export interface Settings {
  businessName: string
  abn: string
  gstRegistered: boolean
  gstBasis: GstBasis
  basFrequency: BasFrequency
  ollamaBaseUrl: string
  cloudAiEnabled: boolean
}

export interface BasPeriod {
  id: string
  label: string
  startDate: string
  endDate: string
  locked: boolean
  gstCollectedCents: number
  gstPaidCents: number
  netGstCents: number
}

export interface BasPeriodReview extends BasPeriod {
  transactions: Transaction[]
  warnings: string[]
}

export interface DashboardSummary {
  revenueCents: number
  expensesCents: number
  profitCents: number
  gstOwedCents: number
  cashflow: Array<{ month: string; income: number; expenses: number }>
  categoryBreakdown: Array<{ name: string; value: number }>
  recentTransactions: Transaction[]
  warnings: string[]
}

export interface AiSuggestion {
  id: string
  createdAt: string
  status: SuggestionStatus
  targetType: 'transaction' | 'tax' | 'report'
  targetId: string
  title: string
  rationale: string
  payloadJson: string
}

export interface AuditLog {
  id: string
  createdAt: string
  actor: string
  action: string
  entityType: string
  entityId: string
  detailsJson: string
}

export interface ExportJob {
  id: string
  createdAt: string
  preset: string
  dateRange: string
  filePath: string
  warnings: string[]
}

export interface CsvPreviewRow {
  date: string
  description: string
  contactName: string
  amountCents: number
  duplicate: boolean
  error: string
}

export interface CsvPreview {
  sourceName: string
  rowCount: number
  importable: number
  duplicates: number
  errors: number
  rows: CsvPreviewRow[]
}

export type { DocumentImport, DocumentImportResult, IntakeStatus, OcrStatus } from './documentIntake'

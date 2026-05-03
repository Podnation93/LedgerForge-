import type {
  Account,
  AiSuggestion,
  AuditLog,
  BasPeriod,
  BasPeriodReview,
  Contact,
  CsvPreview,
  DashboardSummary,
  ExportJob,
  Invoice,
  ReceiptAttachment,
  Settings,
  TaxCode,
  Transaction,
} from './types'
import type { DocumentImport, DocumentImportResult } from './documentIntake'

export const ipcInvokeChannels = [
  'settings:get',
  'settings:update',
  'dashboard:summary',
  'accounts:list',
  'contacts:list',
  'contacts:upsert',
  'transactions:list',
  'transactions:create',
  'transactions:update-categorisation',
  'documents:list',
  'documents:create',
  'documents:pick-files',
  'documents:pick-folder',
  'documents:imports:list',
  'documents:imports:create',
  'documents:ocr:process',
  'documents:ocr:process-pending',
  'tax:get-bas-periods',
  'tax:get-bas-review',
  'tax:lock-bas-period',
  'ai:test-connection',
  'ai:stream-chat',
  'ai:suggestions:list',
  'ai:suggestions:create',
  'ai:suggestions:generate-review',
  'ai:suggestions:generate-ai-review',
  'ai:suggestions:update-status',
  'imports:pick-csv',
  'imports:csv-preview',
  'imports:csv',
  'receipts:list',
  'receipts:attach',
  'exports:create-pack',
  'exports:list',
  'exports:show-in-folder',
  'audit:list',
] as const

export const ipcEventChannels = ['ai:token-stream'] as const

export type IpcInvokeChannel = typeof ipcInvokeChannels[number]
export type IpcEventChannel = typeof ipcEventChannels[number]

export interface IpcInvokePayloads {
  'settings:get': { args: undefined; result: Settings }
  'settings:update': { args: Partial<Settings>; result: Settings }
  'dashboard:summary': { args: undefined; result: DashboardSummary }
  'accounts:list': { args: undefined; result: Account[] }
  'contacts:list': { args: undefined; result: Contact[] }
  'contacts:upsert': { args: Omit<Contact, 'id'> & { id?: string }; result: Contact }
  'transactions:list': { args: undefined; result: Transaction[] }
  'transactions:create': {
    args: Omit<Transaction, 'id' | 'currency' | 'splits'> & { taxCode: TaxCode; accountId: string }
    result: Transaction
  }
  'transactions:update-categorisation': {
    args: {
      id: string
      accountId: string
      taxCode: TaxCode
      businessUsePercent: number
      hasReceipt: boolean
      status: Transaction['status']
    }
    result: Transaction
  }
  'documents:list': { args: { kind?: Invoice['kind'] } | undefined; result: Invoice[] }
  'documents:create': { args: Omit<Invoice, 'id'>; result: Invoice }
  'documents:pick-files': { args: undefined; result: string[] }
  'documents:pick-folder': { args: undefined; result: string[] }
  'documents:imports:list': { args: undefined; result: DocumentImport[] }
  'documents:imports:create': { args: { paths?: string[] }; result: DocumentImportResult }
  'documents:ocr:process': { args: { id: string }; result: DocumentImport }
  'documents:ocr:process-pending': { args: { limit?: number } | undefined; result: DocumentImportResult }
  'tax:get-bas-periods': { args: undefined; result: BasPeriod[] }
  'tax:get-bas-review': { args: { periodId: string }; result: BasPeriodReview }
  'tax:lock-bas-period': { args: { periodId: string }; result: BasPeriod[] }
  'ai:test-connection': { args: { baseUrl: string }; result: { ok: boolean; models: string[]; message: string } }
  'ai:stream-chat': { args: { baseUrl: string; model: string; prompt: string }; result: void }
  'ai:suggestions:list': { args: undefined; result: AiSuggestion[] }
  'ai:suggestions:create': { args: Omit<AiSuggestion, 'id' | 'createdAt' | 'status'>; result: AiSuggestion }
  'ai:suggestions:generate-review': { args: undefined; result: AiSuggestion[] }
  'ai:suggestions:generate-ai-review': { args: { baseUrl: string; model: string }; result: AiSuggestion[] }
  'ai:suggestions:update-status': {
    args: { id: string; status: AiSuggestion['status'] }
    result: AiSuggestion[]
  }
  'imports:pick-csv': { args: undefined; result: { sourceName: string; csvText: string } | null }
  'imports:csv-preview': { args: { sourceName: string; csvText: string }; result: CsvPreview }
  'imports:csv': { args: { sourceName: string; csvText: string }; result: { imported: number; duplicates: number } }
  'receipts:list': { args: undefined; result: ReceiptAttachment[] }
  'receipts:attach': { args: { transactionId: string; documentImportId: string; notes?: string }; result: ReceiptAttachment }
  'exports:create-pack': { args: { preset: string }; result: ExportJob }
  'exports:list': { args: undefined; result: ExportJob[] }
  'exports:show-in-folder': { args: { filePath: string }; result: boolean }
  'audit:list': { args: undefined; result: AuditLog[] }
}

export interface IpcEventPayloads {
  'ai:token-stream': string
}

export type IpcInvokeArgs<C extends IpcInvokeChannel> = IpcInvokePayloads[C]['args']
export type IpcInvokeResult<C extends IpcInvokeChannel> = IpcInvokePayloads[C]['result']
export type IpcEventPayload<C extends IpcEventChannel> = IpcEventPayloads[C]

export type IpcInvokeArgsTuple<C extends IpcInvokeChannel> = undefined extends IpcInvokeArgs<C>
  ? [args?: IpcInvokeArgs<C>]
  : [args: IpcInvokeArgs<C>]

import type { Invoice, TaxCode } from '@shared/types'

export const MAX_INTAKE_FILES = 500
export const MAX_INTAKE_FILE_BYTES = 50 * 1024 * 1024

export const TAX_CODES: TaxCode[] = [
  'GST_SALES',
  'GST_PURCHASES',
  'GST_FREE_INCOME',
  'GST_FREE_EXPENSES',
  'INPUT_TAXED',
  'BAS_EXCLUDED',
  'PRIVATE',
]

export const DOCUMENT_KINDS: Invoice['kind'][] = ['invoice', 'quote', 'bill']
export const DOCUMENT_STATUSES: Invoice['status'][] = ['draft', 'sent', 'paid', 'overdue']

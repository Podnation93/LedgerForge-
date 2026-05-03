import type {
  Account,
  AuditLog,
  Contact,
  DocumentImport,
  ExportJob,
  Invoice,
  ReceiptAttachment,
  TaxCode,
  Transaction,
  TransactionSplit,
} from '@shared/types'

export type Row = Record<string, unknown>

export function bool(value: unknown): boolean {
  return value === 1 || value === true
}

export function mapAccount(row: Row): Account {
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    type: row.type as Account['type'],
    taxCode: row.tax_code as TaxCode,
    balanceCents: Number(row.balance_cents),
  }
}

export function mapContact(row: Row): Contact {
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

export function mapDocument(row: Row): Invoice {
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

export function mapDocumentImport(row: Row): DocumentImport {
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

export function mapSplit(row: Row): TransactionSplit {
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

export function mapTransaction(row: Row, splits: TransactionSplit[]): Transaction {
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

export function mapReceipt(row: Row): ReceiptAttachment {
  return {
    id: String(row.id),
    transactionId: String(row.transaction_id),
    filePath: String(row.file_path),
    sha256: String(row.sha256),
    notes: String(row.notes),
  }
}

export function mapExportJob(row: Row): ExportJob {
  return {
    id: String(row.id),
    createdAt: String(row.created_at),
    preset: String(row.preset),
    dateRange: String(row.date_range),
    filePath: String(row.file_path),
    warnings: JSON.parse(String(row.warnings_json)) as string[],
  }
}

export function mapAuditLog(row: Row): AuditLog {
  return {
    id: String(row.id),
    createdAt: String(row.created_at),
    actor: String(row.actor),
    action: String(row.action),
    entityType: String(row.entity_type),
    entityId: String(row.entity_id),
    detailsJson: String(row.details_json),
  }
}

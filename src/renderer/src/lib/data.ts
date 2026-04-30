import type { Contact, Invoice, Transaction } from '@shared/types'

export const exportPresets = [
  'BAS Review Pack',
  'GST Summary Pack',
  'End of Financial Year Pack',
  'Expense Deduction Review',
  'Accountant Handover Pack',
  'AI Analysis Pack',
  'Full Local Backup',
]

export function exampleTransaction(): Omit<Transaction, 'id' | 'currency' | 'splits'> & { taxCode: 'GST_PURCHASES'; accountId: string } {
  return {
    date: new Date().toISOString().slice(0, 10),
    description: 'Imported expense awaiting review',
    contactName: 'New Supplier',
    amountCents: -15400,
    status: 'imported',
    hasReceipt: false,
    reference: 'manual',
    taxCode: 'GST_PURCHASES',
    accountId: 'acct-office',
  }
}

export function exampleContact(): Omit<Contact, 'id'> {
  return {
    type: 'supplier',
    name: 'Harbour Advisory',
    abn: '12 345 678 901',
    email: 'accounts@harbour.example',
    phone: '0412 345 678',
    notes: 'Accountant review contact',
  }
}

export function exampleDocument(kind: Invoice['kind']): Omit<Invoice, 'id'> {
  const prefix = kind === 'bill' ? 'BILL' : kind === 'quote' ? 'QUO' : 'INV'
  return {
    kind,
    number: `${prefix}-${Math.floor(Math.random() * 8000 + 2000)}`,
    contactName: kind === 'bill' ? 'Supplier Pty Ltd' : 'Client Pty Ltd',
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    status: 'draft',
    subtotalCents: 120000,
    gstCents: 12000,
    totalCents: 132000,
  }
}

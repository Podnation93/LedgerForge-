import type Database from 'better-sqlite3'
import type { Account, TaxCode, Transaction } from '@shared/types'
import { audit } from '../audit-service'
import { TAX_CODES } from './constants'
import { mapAccount, mapSplit, mapTransaction, type Row } from './mappers'

export class TransactionsService {
  private readonly db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  listAccounts(): Account[] {
    return (this.db.prepare('SELECT * FROM accounts ORDER BY code').all() as Row[]).map(mapAccount)
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

  updateTransactionCategorisation(input: {
    id: string
    accountId: string
    taxCode: TaxCode
    hasReceipt: boolean
    businessUsePercent: number
    status: Transaction['status']
  }): Transaction {
    if (!input.id) throw new Error('Transaction id is required')
    const transaction = this.listTransactions().find((item) => item.id === input.id)
    if (!transaction) throw new Error('Unknown transaction')
    if (!TAX_CODES.includes(input.taxCode)) throw new Error('Unknown tax code')
    const account = this.db.prepare('SELECT id FROM accounts WHERE id = ?').get(input.accountId)
    if (!account) throw new Error('Unknown account')
    if (!['imported', 'categorised', 'reconciled'].includes(input.status)) throw new Error('Unknown transaction status')
    const businessUsePercent = Math.max(0, Math.min(100, Math.round(Number(input.businessUsePercent))))
    const gstCents = input.taxCode === 'GST_SALES' || input.taxCode === 'GST_PURCHASES'
      ? Math.round((Math.abs(transaction.amountCents) * businessUsePercent) / 100 / 11)
      : 0

    this.db.transaction(() => {
      this.db.prepare('UPDATE transactions SET status = ?, has_receipt = ? WHERE id = ?').run(input.status, input.hasReceipt ? 1 : 0, input.id)
      this.db.prepare('DELETE FROM transaction_splits WHERE transaction_id = ?').run(input.id)
      this.db
        .prepare('INSERT INTO transaction_splits VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(crypto.randomUUID(), input.id, input.accountId, transaction.amountCents, input.taxCode, gstCents, businessUsePercent)
      audit(this.db, 'transaction.categorise', 'transaction', input.id, { ...input, businessUsePercent, gstCents })
    })()

    return this.listTransactions().find((item) => item.id === input.id)!
  }
}

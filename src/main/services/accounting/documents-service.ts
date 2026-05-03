import type Database from 'better-sqlite3'
import type { Invoice } from '@shared/types'
import { audit } from '../audit-service'
import { DOCUMENT_KINDS, DOCUMENT_STATUSES } from './constants'
import { mapDocument, type Row } from './mappers'

export class DocumentsService {
  private readonly db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  listDocuments(kind?: Invoice['kind']): Invoice[] {
    const sql = kind ? 'SELECT * FROM documents WHERE kind = ? ORDER BY issue_date DESC' : 'SELECT * FROM documents ORDER BY issue_date DESC'
    const rows = (kind ? this.db.prepare(sql).all(kind) : this.db.prepare(sql).all()) as Row[]
    return rows.map(mapDocument)
  }

  createDocument(input: Omit<Invoice, 'id'>): Invoice {
    if (!DOCUMENT_KINDS.includes(input.kind)) throw new Error('Unknown document type')
    if (!DOCUMENT_STATUSES.includes(input.status)) throw new Error('Unknown document status')
    if (!String(input.number).trim()) throw new Error('Document number is required')
    if (!String(input.contactName).trim()) throw new Error('Contact name is required')
    if (Number.isNaN(Date.parse(`${input.issueDate}T00:00:00`))) throw new Error('Issue date is invalid')
    if (Number.isNaN(Date.parse(`${input.dueDate}T00:00:00`))) throw new Error('Due date is invalid')
    if (!Number.isInteger(input.subtotalCents) || input.subtotalCents < 0) throw new Error('Subtotal must be a positive amount')
    if (!Number.isInteger(input.gstCents) || input.gstCents < 0) throw new Error('GST must be a positive amount')
    if (input.totalCents !== input.subtotalCents + input.gstCents) throw new Error('Document total does not match subtotal plus GST')
    const id = crypto.randomUUID()
    this.db
      .prepare('INSERT INTO documents VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, input.kind, input.number.trim(), input.contactName.trim(), input.issueDate, input.dueDate, input.status, input.subtotalCents, input.gstCents, input.totalCents)
    audit(this.db, `${input.kind}.create`, input.kind, id, input)
    return this.listDocuments(input.kind).find((document) => document.id === id)!
  }
}

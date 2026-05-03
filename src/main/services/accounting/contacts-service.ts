import type Database from 'better-sqlite3'
import type { Contact } from '@shared/types'
import { audit } from '../audit-service'
import { mapContact, type Row } from './mappers'

export class ContactsService {
  private readonly db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  listContacts(): Contact[] {
    return (this.db.prepare('SELECT * FROM contacts ORDER BY name').all() as Row[]).map(mapContact)
  }

  upsertContact(input: Omit<Contact, 'id'> & { id?: string }): Contact {
    const id = input.id ?? crypto.randomUUID()
    this.db
      .prepare('INSERT OR REPLACE INTO contacts VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, input.type, input.name, input.abn, input.email, input.phone, input.notes)
    audit(this.db, input.id ? 'contact.update' : 'contact.create', 'contact', id, input)
    return this.listContacts().find((contact) => contact.id === id)!
  }
}

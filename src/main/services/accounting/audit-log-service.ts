import type Database from 'better-sqlite3'
import type { AuditLog } from '@shared/types'
import { mapAuditLog, type Row } from './mappers'

export class AuditLogService {
  private readonly db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  listAuditLogs(): AuditLog[] {
    return (this.db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100').all() as Row[]).map(mapAuditLog)
  }
}

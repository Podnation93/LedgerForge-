import type Database from 'better-sqlite3'

export function audit(db: Database.Database, action: string, entityType: string, entityId: string, details: unknown): void {
  db.prepare('INSERT INTO audit_logs VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    crypto.randomUUID(),
    new Date().toISOString(),
    'local-user',
    action,
    entityType,
    entityId,
    JSON.stringify(details),
  )
}

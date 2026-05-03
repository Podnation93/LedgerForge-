import type Database from 'better-sqlite3'
import type { Settings } from '@shared/types'
import { normaliseSettings } from '@shared/settingsValidation'
import { audit } from '../audit-service'

export class SettingsService {
  private readonly db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  getSettings(): Settings {
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>
    return Object.fromEntries(rows.map((row) => [row.key, JSON.parse(row.value)])) as unknown as Settings
  }

  updateSettings(settings: Partial<Settings>): Settings {
    const nextSettings = normaliseSettings(settings)
    const insert = this.db.prepare('INSERT OR REPLACE INTO settings VALUES (?, ?)')
    for (const [key, value] of Object.entries(nextSettings)) insert.run(key, JSON.stringify(value))
    audit(this.db, 'settings.update', 'settings', 'app', nextSettings)
    return this.getSettings()
  }
}

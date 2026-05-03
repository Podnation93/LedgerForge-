import type Database from 'better-sqlite3'
import { app } from 'electron'
import JSZip from 'jszip'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ExportJob } from '@shared/types'
import { buildExportMetadata, aiExportPrompt } from '@shared/exportPack'
import { audit } from '../audit-service'
import { ContactsService } from './contacts-service'
import { DashboardService } from './dashboard-service'
import { mapExportJob, type Row } from './mappers'
import { SettingsService } from './settings-service'
import { TaxService } from './tax-service'
import { TransactionsService } from './transactions-service'

export class ExportsService {
  private readonly db: Database.Database
  private readonly contactsService: ContactsService
  private readonly dashboardService: DashboardService
  private readonly settingsService: SettingsService
  private readonly taxService: TaxService
  private readonly transactionsService: TransactionsService

  constructor(
    db: Database.Database,
    settingsService: SettingsService,
    dashboardService: DashboardService,
    taxService: TaxService,
    transactionsService: TransactionsService,
    contactsService: ContactsService,
  ) {
    this.db = db
    this.settingsService = settingsService
    this.dashboardService = dashboardService
    this.taxService = taxService
    this.transactionsService = transactionsService
    this.contactsService = contactsService
  }

  async createExportPack(preset: string): Promise<ExportJob> {
    const settings = this.settingsService.getSettings()
    const summary = this.dashboardService.dashboard()
    const zip = new JSZip()
    zip.file('metadata/export-info.json', JSON.stringify(buildExportMetadata(settings, summary, preset), null, 2))
    zip.file('data/transactions.json', JSON.stringify(this.transactionsService.listTransactions(), null, 2))
    zip.file('data/contacts.json', JSON.stringify(this.contactsService.listContacts(), null, 2))
    zip.file('reports/gst-summary.md', this.taxService.getBasPeriods().map((period) => `## ${period.label}\nNet GST: ${period.netGstCents}`).join('\n\n'))
    zip.file('ai/prompt.md', aiExportPrompt)
    zip.file('ai/warnings.md', summary.warnings.join('\n'))
    zip.file('audit/export-log.md', `Export preset: ${preset}\nGenerated: ${new Date().toISOString()}`)
    const outputDir = join(app.getPath('documents'), 'LedgerForge AI Exports')
    mkdirSync(outputDir, { recursive: true })
    const filePath = join(outputDir, `${preset.toLowerCase().replace(/\W+/g, '-')}-${Date.now()}.zip`)
    writeFileSync(filePath, await zip.generateAsync({ type: 'nodebuffer' }))
    const id = crypto.randomUUID()
    this.db.prepare('INSERT INTO export_jobs VALUES (?, ?, ?, ?, ?, ?)').run(id, new Date().toISOString(), preset, 'current', filePath, JSON.stringify(summary.warnings))
    audit(this.db, 'export.create', 'export_job', id, { preset, filePath })
    return { id, createdAt: new Date().toISOString(), preset, dateRange: 'current', filePath, warnings: summary.warnings }
  }

  listExportJobs(): ExportJob[] {
    return (this.db.prepare('SELECT * FROM export_jobs ORDER BY created_at DESC LIMIT 100').all() as Row[]).map(mapExportJob)
  }
}

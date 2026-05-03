import type Database from 'better-sqlite3'
import { app } from 'electron'
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { DocumentImport, DocumentImportResult, ReceiptAttachment } from '@shared/types'
import { initialOcrStatus, intakeMimeType, isSupportedIntakeFile, sanitizeIntakeFileName } from '@shared/documentIntake'
import { audit } from '../audit-service'
import { OcrService } from '../ocr-service'
import { MAX_INTAKE_FILE_BYTES, MAX_INTAKE_FILES } from './constants'
import { mapDocumentImport, mapReceipt, type Row } from './mappers'

export class ReceiptsService {
  private readonly db: Database.Database
  private readonly ocr: OcrService

  constructor(db: Database.Database, ocr: OcrService) {
    this.db = db
    this.ocr = ocr
  }

  listDocumentImports(): DocumentImport[] {
    return (this.db.prepare('SELECT * FROM document_imports ORDER BY created_at DESC LIMIT 250').all() as Row[]).map(mapDocumentImport)
  }

  async processDocumentOcr(id: string): Promise<DocumentImport> {
    const row = this.db.prepare('SELECT * FROM document_imports WHERE id = ?').get(id) as Row | undefined
    if (!row) throw new Error('Unknown imported document')
    const document = mapDocumentImport(row)
    if (document.status !== 'IMPORTED') throw new Error('Only imported documents can be OCR processed')
    if (document.ocrStatus === 'COMPLETE') return document
    this.db.prepare('UPDATE document_imports SET ocr_status = ?, error_message = ? WHERE id = ?').run('PROCESSING', '', id)
    try {
      const result = await this.ocr.extractText(document.storedPath, document.mimeType)
      this.db
        .prepare('UPDATE document_imports SET ocr_status = ?, extracted_text = ?, error_message = ? WHERE id = ?')
        .run('COMPLETE', result.text, `OCR engine: ${result.engine}`, id)
      audit(this.db, 'document_import.ocr_complete', 'document_import', id, { engine: result.engine, textLength: result.text.length })
    } catch (error) {
      this.db
        .prepare('UPDATE document_imports SET ocr_status = ?, error_message = ? WHERE id = ?')
        .run('FAILED', error instanceof Error ? error.message : 'OCR failed', id)
      audit(this.db, 'document_import.ocr_failed', 'document_import', id, { message: error instanceof Error ? error.message : 'OCR failed' })
    }
    return this.listDocumentImports().find((record) => record.id === id)!
  }

  async processPendingDocumentOcr(limit = 10): Promise<DocumentImportResult> {
    const rows = this.db
      .prepare("SELECT * FROM document_imports WHERE status = 'IMPORTED' AND ocr_status IN ('PENDING', 'FAILED') ORDER BY created_at ASC LIMIT ?")
      .all(Math.max(1, Math.min(50, Math.round(Number(limit))))) as Row[]
    const records: DocumentImport[] = []
    let failed = 0
    for (const row of rows) {
      const processed = await this.processDocumentOcr(String(row.id))
      if (processed.ocrStatus === 'FAILED') failed += 1
      records.push(processed)
    }
    return { imported: 0, duplicates: 0, skipped: 0, failed, records }
  }

  listReceipts(): ReceiptAttachment[] {
    return (this.db.prepare('SELECT * FROM receipts ORDER BY id DESC LIMIT 250').all() as Row[]).map(mapReceipt)
  }

  attachDocumentToTransaction(input: { transactionId: string; documentImportId: string; notes?: string }): ReceiptAttachment {
    const transaction = this.db.prepare('SELECT id FROM transactions WHERE id = ?').get(input.transactionId)
    if (!transaction) throw new Error('Unknown transaction')
    const document = this.db.prepare('SELECT * FROM document_imports WHERE id = ?').get(input.documentImportId) as Row | undefined
    if (!document) throw new Error('Unknown imported document')
    const id = crypto.randomUUID()
    this.db.transaction(() => {
      const intakedDir = join(app.getPath('userData'), 'document-intake')
      if (!document.stored_path || typeof document.stored_path !== 'string') {
        throw new Error('Invalid stored path for document')
      }
      if (!document.stored_path.includes(intakedDir)) {
        throw new Error('Stored path is outside allowed directory')
      }
      this.db
        .prepare('INSERT INTO receipts VALUES (?, ?, ?, ?, ?)')
        .run(id, input.transactionId, String(document.stored_path), String(document.sha256), String(input.notes ?? ''))
      this.db.prepare('UPDATE transactions SET has_receipt = 1 WHERE id = ?').run(input.transactionId)
      audit(this.db, 'receipt.attach', 'transaction', input.transactionId, { documentImportId: input.documentImportId })
    })()
    return this.listReceipts().find((receipt) => receipt.id === id)!
  }

  importDocumentFiles(paths: string[]): DocumentImportResult {
    const candidates = this.collectDocumentCandidates(paths)
    const outputDir = join(app.getPath('userData'), 'document-intake')
    mkdirSync(outputDir, { recursive: true })

    const records: DocumentImport[] = []
    let imported = 0
    let duplicates = 0
    let skipped = 0
    let failed = 0

    for (const filePath of candidates) {
      try {
        const stats = statSync(filePath)
        if (!stats.isFile() || !isSupportedIntakeFile(filePath)) {
          skipped += 1
          continue
        }
        if (stats.size > MAX_INTAKE_FILE_BYTES) {
          skipped += 1
          records.push(this.recordSkippedImport(filePath, stats.size, 'File exceeds the 50 MB import limit'))
          continue
        }

        const sha256 = createHash('sha256').update(readFileSync(filePath)).digest('hex')
        const existing = this.db.prepare('SELECT * FROM document_imports WHERE sha256 = ?').get(sha256) as Row | undefined
        if (existing) {
          duplicates += 1
          records.push(mapDocumentImport(existing))
          continue
        }

        const originalName = sanitizeIntakeFileName(basename(filePath))
        const storedName = `${sha256.slice(0, 16)}-${originalName}`
        const storedPath = join(outputDir, storedName)
        copyFileSync(filePath, storedPath)

        const id = crypto.randomUUID()
        const createdAt = new Date().toISOString()
        this.db
          .prepare('INSERT INTO document_imports VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(
            id,
            createdAt,
            filePath,
            storedPath,
            originalName,
            intakeMimeType(originalName),
            stats.size,
            sha256,
            'IMPORTED',
            initialOcrStatus(originalName),
            '',
            '',
          )
        audit(this.db, 'document_import.create', 'document_import', id, { fileName: originalName, sha256, sizeBytes: stats.size })
        imported += 1
        records.push(this.listDocumentImports().find((record) => record.id === id)!)
      } catch (error) {
        failed += 1
        records.push(this.recordFailedImport(filePath, error instanceof Error ? error.message : 'Unable to import file'))
      }
    }

    this.db
      .prepare('INSERT INTO import_jobs VALUES (?, ?, ?, ?, ?)')
      .run(crypto.randomUUID(), new Date().toISOString(), `document-intake:${paths.length}`, imported, duplicates)

    return { imported, duplicates, skipped, failed, records }
  }

  private collectDocumentCandidates(paths: string[]): string[] {
    const queue = [...new Set(paths.filter((path) => typeof path === 'string' && path.trim()))]
    const files: string[] = []
    while (queue.length > 0 && files.length < MAX_INTAKE_FILES) {
      const current = queue.shift()!
      const stats = statSync(current)
      if (stats.isDirectory()) {
        for (const entry of readdirSync(current)) queue.push(join(current, entry))
        continue
      }
      if (stats.isFile()) files.push(current)
    }
    return files
  }

  private recordSkippedImport(filePath: string, sizeBytes: number, reason: string): DocumentImport {
    return {
      id: '',
      createdAt: new Date().toISOString(),
      sourcePath: filePath,
      storedPath: '',
      fileName: sanitizeIntakeFileName(basename(filePath)),
      mimeType: intakeMimeType(filePath),
      sizeBytes,
      sha256: '',
      status: 'SKIPPED',
      ocrStatus: 'UNSUPPORTED',
      extractedText: '',
      errorMessage: reason,
    }
  }

  private recordFailedImport(filePath: string, message: string): DocumentImport {
    return {
      id: '',
      createdAt: new Date().toISOString(),
      sourcePath: filePath,
      storedPath: '',
      fileName: sanitizeIntakeFileName(basename(filePath)),
      mimeType: intakeMimeType(filePath),
      sizeBytes: 0,
      sha256: '',
      status: 'FAILED',
      ocrStatus: 'FAILED',
      extractedText: '',
      errorMessage: message,
    }
  }
}

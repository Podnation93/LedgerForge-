import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { recognize } from 'tesseract.js'

const MAX_PDF_OCR_PAGES = 10

export interface OcrResult {
  text: string
  engine: string
}

export class OcrService {
  async extractText(filePath: string, mimeType: string): Promise<OcrResult> {
    if (mimeType === 'application/pdf') return this.extractPdfText(filePath)
    if (mimeType.startsWith('image/')) return this.extractImageText(filePath)
    throw new Error(`OCR is not supported for ${mimeType}`)
  }

  private async extractImageText(filePath: string): Promise<OcrResult> {
    const result = await recognize(filePath, 'eng')
    return { text: normaliseOcrText(result.data.text), engine: 'tesseract.js' }
  }

  private async extractPdfText(filePath: string): Promise<OcrResult> {
    const embedded = this.extractEmbeddedPdfText(filePath)
    if (embedded.trim().length >= 20) return { text: normaliseOcrText(embedded), engine: 'pdftotext' }
    return this.ocrRenderedPdf(filePath)
  }

  private extractEmbeddedPdfText(filePath: string): string {
    if (!hasExecutable('pdftotext')) return ''
    try {
      return execFileSync('pdftotext', ['-layout', filePath, '-'], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
    } catch {
      return ''
    }
  }

  private async ocrRenderedPdf(filePath: string): Promise<OcrResult> {
    if (!hasExecutable('pdftoppm')) throw new Error('PDF OCR requires Poppler pdftoppm to render scanned pages')
    const dir = mkdtempSync(join(tmpdir(), 'ledgerforge-ocr-'))
    try {
      const prefix = join(dir, sanitizePrefix(basename(filePath)))
      execFileSync('pdftoppm', ['-png', '-r', '200', '-f', '1', '-l', String(MAX_PDF_OCR_PAGES), filePath, prefix], { maxBuffer: 10 * 1024 * 1024 })
      const pages = readdirSync(dir)
        .filter((file) => file.endsWith('.png'))
        .sort()
        .map((file) => join(dir, file))
      if (pages.length === 0) throw new Error('Unable to render PDF pages for OCR')
      const chunks: string[] = []
      for (const page of pages) {
        const result = await recognize(page, 'eng')
        chunks.push(result.data.text)
      }
      return { text: normaliseOcrText(chunks.join('\n\n')), engine: `pdftoppm+tesseract.js:first-${MAX_PDF_OCR_PAGES}-pages` }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }
}

function normaliseOcrText(text: string): string {
  return text.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').trim()
}

function hasExecutable(name: string): boolean {
  const paths = String(process.env.PATH ?? '').split(':')
  return paths.some((path) => existsSync(join(path, name)))
}

function sanitizePrefix(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 48) || 'document'
}

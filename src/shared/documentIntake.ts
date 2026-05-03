export const supportedIntakeExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff'] as const

export type IntakeStatus = 'IMPORTED' | 'DUPLICATE' | 'SKIPPED' | 'FAILED'
export type OcrStatus = 'PENDING' | 'PROCESSING' | 'UNSUPPORTED' | 'FAILED' | 'COMPLETE'

export interface DocumentImport {
  id: string
  createdAt: string
  sourcePath: string
  storedPath: string
  fileName: string
  mimeType: string
  sizeBytes: number
  sha256: string
  status: IntakeStatus
  ocrStatus: OcrStatus
  extractedText: string
  errorMessage: string
}

export interface DocumentImportResult {
  imported: number
  duplicates: number
  skipped: number
  failed: number
  records: DocumentImport[]
}

export function isSupportedIntakeFile(filePath: string): boolean {
  const lower = filePath.toLowerCase()
  return supportedIntakeExtensions.some((extension) => lower.endsWith(extension))
}

export function intakeMimeType(fileName: string): string {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.tif') || lower.endsWith('.tiff')) return 'image/tiff'
  return 'application/octet-stream'
}

export function sanitizeIntakeFileName(fileName: string): string {
  const cleaned = fileName
    .split('')
    .map((character) => (character.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(character) ? '-' : character))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned || 'document'
}

export function initialOcrStatus(fileName: string): OcrStatus {
  return isSupportedIntakeFile(fileName) ? 'PENDING' : 'UNSUPPORTED'
}
